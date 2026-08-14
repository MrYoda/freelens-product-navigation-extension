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

  await access(new URL(`../${manifest[field]}`, import.meta.url));
}

console.log(`Package ${manifest.name}@${manifest.version} has main and renderer entry points and no runtime dependencies.`);
