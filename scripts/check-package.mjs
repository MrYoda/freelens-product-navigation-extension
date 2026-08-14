import { access, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const runtimeDependencyFields = ["dependencies", "optionalDependencies", "peerDependencies"];

if (!/^\^\d+\.\d+\.\d+$/.test(manifest.engines?.freelens ?? "")) {
  throw new Error("package.json.engines.freelens must use the ^major.minor.patch format accepted by Freelens");
}

for (const field of runtimeDependencyFields) {
  const dependencies = Object.keys(manifest[field] ?? {});
  if (dependencies.length > 0) {
    throw new Error(`${field} must be empty for an offline-installable Freelens extension: ${dependencies.join(", ")}`);
  }
}

for (const field of ["main", "renderer"]) {
  if (typeof manifest[field] !== "string") {
    throw new Error(`package.json.${field} must point to a built entry point`);
  }
  if (!manifest[field].endsWith(".cjs")) {
    throw new Error(`package.json.${field} must point to an explicit CommonJS (.cjs) entry point`);
  }

  const entryPoint = new URL(`../${manifest[field]}`, import.meta.url);
  await access(entryPoint);

  const source = await readFile(entryPoint, "utf8");
  if (/^\s*import\s/m.test(source)) {
    throw new Error(`${manifest[field]} contains an ESM import but Freelens 1.10 expects a CommonJS entry point`);
  }

  const allowedRuntimeModules = new Set(["electron", ...builtinModules, ...builtinModules.map(name => `node:${name}`)]);
  const bareRequires = [...source.matchAll(/require\(["']([^./][^"']*)["']\)/g)].map(match => match[1]);
  const unresolvedModules = [...new Set(bareRequires.filter(name => !allowedRuntimeModules.has(name)))];
  if (unresolvedModules.length > 0) {
    throw new Error(`${manifest[field]} has unresolved runtime modules: ${unresolvedModules.join(", ")}`);
  }
}

console.log(`Package ${manifest.name}@${manifest.version} has main and renderer entry points and no runtime dependencies.`);
