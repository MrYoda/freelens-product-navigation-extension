import assert from "node:assert/strict";
import test from "node:test";
import { componentMatchesText, componentMatchesTokens, getSearchTokens, suggestSearchTokens, type SearchToken } from "./search.ts";
import { defaultConfig, type ProductNavigationPreferences } from "./products.ts";

const navigation: ProductNavigationPreferences = {
  clusters: [{ id: "cluster-a", name: "Production Europe" }, { id: "cluster-b", name: "Development US" }],
  products: [{ id: "commerce", name: "Commerce" }],
  services: [
    { id: "checkout", name: "Checkout", productId: "commerce", components: [
      { id: "checkout-api", name: "API", targets: [{ namespace: "shop", clusters: ["cluster-a"] }] },
      { id: "checkout-worker", name: "Worker", targets: [{ namespace: "jobs", clusters: ["cluster-b"] }] },
    ] },
    { id: "catalog", name: "Catalog", components: [
      { id: "catalog-api", name: "API", targets: [{ namespace: "shop", clusters: ["cluster-b"] }] },
    ] },
  ], hidden: { services: {} }, updates: defaultConfig.updates, customButtons: [], openProductsOnStartup: false,
};
const checkoutApi = navigation.services[0].components[0];

test("suggests unique typed entities after two characters and excludes selected tokens", () => {
  const all = getSearchTokens(navigation);
  assert.deepEqual(suggestSearchTokens(all, "a", []), []);
  assert.deepEqual(suggestSearchTokens(all, "api", []).map(token => [token.type, token.value]), [
    ["component", "checkout-api"], ["component", "catalog-api"],
  ]);
  assert.deepEqual(suggestSearchTokens(all, "shop", [{ type: "namespace", value: "shop", label: "shop" }]), []);
});

test("groups suggestions by service, namespace, component, then cluster", () => {
  const tokens: SearchToken[] = [
    { type: "cluster", value: "match-cluster", label: "Match cluster" },
    { type: "component", value: "match-component", label: "Match component" },
    { type: "namespace", value: "match-namespace", label: "Match namespace" },
    { type: "service", value: "match-service", label: "Match service" },
  ];
  assert.deepEqual(suggestSearchTokens(tokens, "match", []).map(token => token.type), ["service", "namespace", "component", "cluster"]);
});

test("combines values of one entity type with OR and different types with AND", () => {
  const tokens: SearchToken[] = [
    { type: "service", value: "checkout", label: "Checkout" },
    { type: "service", value: "catalog", label: "Catalog" },
    { type: "cluster", value: "cluster-a", label: "Production Europe" },
  ];
  assert.equal(componentMatchesTokens(navigation.services[0], checkoutApi, tokens), true);
  assert.equal(componentMatchesTokens(navigation.services[0], navigation.services[0].components[1], tokens), false);
  assert.equal(componentMatchesTokens(navigation.services[1], navigation.services[1].components[0], tokens), false);
});

test("keeps free-text filtering across products and target metadata", () => {
  assert.equal(componentMatchesText(navigation, navigation.services[0], checkoutApi, "commerce"), true);
  assert.equal(componentMatchesText(navigation, navigation.services[0], checkoutApi, "europe"), true);
  assert.equal(componentMatchesText(navigation, navigation.services[0], checkoutApi, "missing"), false);
});
