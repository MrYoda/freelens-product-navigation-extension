import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig, parseConfig } from "./products.ts";

const valid = {
  clusters: [{ id: "cluster-a", name: "Cluster A" }],
  products: [{ id: "product-a", name: "Product A" }],
  services: [{ id: "service-a", name: "Service A", productId: "product-a", components: [
    { id: "component-a", name: "API", targets: [{ namespace: "shop", clusters: ["cluster-a"] }] },
  ] }],
  hidden: { services: { "service-a": { components: ["component-a"] } } },
};

test("accepts the explicit target format unchanged", () => {
  assert.deepEqual(parseConfig(JSON.stringify(valid)), { errors: [], value: valid });
});

test("normalizes omitted nested collections", () => {
  assert.deepEqual(normalizeConfig(), { clusters: [], products: [], services: [], hidden: { services: {} } });
});

test("accepts explicit namespace and cluster target pairs", () => {
  const multiple = structuredClone(valid);
  multiple.services[0].components[0].targets = [
    { namespace: "shop-dev", clusters: ["cluster-a"] },
    { namespace: "shop-stage", clusters: ["cluster-a"] },
  ];
  const result = parseConfig(JSON.stringify(multiple));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value?.services[0].components[0].targets, multiple.services[0].components[0].targets);
});

test("rejects empty targets, duplicate namespaces, and empty cluster lists", () => {
  const multiple = structuredClone(valid);
  multiple.services[0].components[0].targets = [
    { namespace: "shop", clusters: ["cluster-a"] },
    { namespace: "shop", clusters: [] },
  ];
  const errors = parseConfig(JSON.stringify(multiple)).errors.join("\n");
  assert.match(errors, /Duplicate id "shop"/);
  assert.match(errors, /clusters must contain at least one cluster/);
});

test("requires targets on every component", () => {
  const missingTargets = structuredClone(valid) as unknown as { services: Array<{ components: Array<Record<string, unknown>> }> };
  missingTargets.services[0].components[0] = { id: "component-a", name: "API" };
  assert.match(parseConfig(JSON.stringify(missingTargets)).errors.join("\n"), /targets must be an array/);
});

test("validates duplicate ids and cross references", () => {
  const invalid = structuredClone(valid);
  invalid.clusters.push({ id: "cluster-a", name: "Duplicate" });
  invalid.services[0].components[0].targets[0].clusters = ["missing"];
  invalid.hidden.services["service-a"].components = ["missing"];
  const errors = parseConfig(JSON.stringify(invalid)).errors.join("\n");
  assert.match(errors, /Duplicate id "cluster-a"/);
  assert.match(errors, /must reference an existing cluster/);
  assert.match(errors, /must reference a component/);
});
