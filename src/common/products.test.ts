import assert from "node:assert/strict";
import test from "node:test";
import { parseConfig, productsForCluster } from "./products.ts";

const json = JSON.stringify({ products: [{ name: "Shop", components: [
  { name: "API", targets: [{ cluster: "dev", namespace: "shop" }] },
  { name: "Jobs", hidden: true, targets: [{ cluster: "dev", namespace: "jobs" }] },
] }] });

test("parses and filters product configuration", () => {
  const config = parseConfig(json);
  assert.deepEqual(productsForCluster(config, "dev").map(p => p.components.map(c => c.name)), [["API"]]);
  assert.equal(productsForCluster(config, "prod").length, 0);
  assert.equal(productsForCluster(config, "dev", true)[0].components.length, 2);
});

test("reports a precise validation path", () => {
  assert.throws(() => parseConfig('{"products":[{"name":"x","components":[{"name":"x","targets":[]}]}]}'),
    /products\[0\]\.components\[0\]\.targets/);
});
