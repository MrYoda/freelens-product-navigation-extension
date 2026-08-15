import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig, parseConfig } from "./products.ts";

const valid = {
  clusters: [{ id: "cluster-a", name: "Cluster A" }],
  products: [{ id: "product-a", name: "Product A" }],
  services: [{ id: "service-a", name: "Service A", productId: "product-a", components: [
    { id: "component-a", name: "API", namespace: "shop", clusters: ["cluster-a"] },
  ] }],
  hidden: { services: { "service-a": { components: ["component-a"] } } },
};

test("accepts the original Freelens product navigation format unchanged", () => {
  assert.deepEqual(parseConfig(JSON.stringify(valid)), { errors: [], value: valid });
});

test("normalizes omitted nested collections", () => {
  assert.deepEqual(normalizeConfig(), { clusters: [], products: [], services: [], hidden: { services: {} } });
});

test("validates duplicate ids and cross references", () => {
  const invalid = structuredClone(valid);
  invalid.clusters.push({ id: "cluster-a", name: "Duplicate" });
  invalid.services[0].components[0].clusters = ["missing"];
  invalid.hidden.services["service-a"].components = ["missing"];
  const errors = parseConfig(JSON.stringify(invalid)).errors.join("\n");
  assert.match(errors, /Duplicate id "cluster-a"/);
  assert.match(errors, /must reference an existing cluster/);
  assert.match(errors, /must reference a component/);
});
