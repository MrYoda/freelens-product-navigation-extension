import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const runtimeDependencyFields = ["dependencies", "optionalDependencies", "peerDependencies"];

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
}

console.log(`Package ${manifest.name}@${manifest.version} has main and renderer entry points and no runtime dependencies.`);
