import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";
import { defaultConfig, normalizeConfig } from "../common/products.ts";
import type { ProductNavigationStore } from "../common/store.ts";
import { fetchWithProxyFallback, formatUpdateError, ProductNavigationUpdater, readUpdateSource } from "./updater.ts";

test("reads update JSON from local paths, file URLs, and HTTP URLs", async () => {
  const path = `/tmp/product-navigation-update-${process.pid}.json`;
  await writeFile(path, '[{"id":"local","name":"Local"}]');
  assert.match(await readUpdateSource(path), /Local/);
  assert.match(await readUpdateSource(new URL(`file://${path}`).href), /Local/);
  let requestedUrl = "";
  assert.match(await readUpdateSource("https://updates.example.test/clusters.json", async url => {
    requestedUrl = url;
    return new Response('[{"id":"remote","name":"Remote"}]');
  }), /Remote/);
  assert.equal(requestedUrl, "https://updates.example.test/clusters.json");
});

test("includes nested network error details", () => {
  const cause = Object.assign(new Error("self-signed certificate in certificate chain"), { code: "SELF_SIGNED_CERT_IN_CHAIN" });
  assert.equal(formatUpdateError(new Error("fetch failed", { cause })), "fetch failed: self-signed certificate in certificate chain (SELF_SIGNED_CERT_IN_CHAIN)");
});

test("retries a broken system proxy directly without disabling TLS validation", async () => {
  let directCalls = 0;
  const response = await fetchWithProxyFallback(
    "https://updates.example.test/services.json",
    async () => { throw new Error("net::ERR_PROXY_CONNECTION_FAILED"); },
    async () => { directCalls += 1; return new Response("[]"); },
  );
  assert.equal(await response.text(), "[]");
  assert.equal(directCalls, 1);
});

test("does not bypass the system route for certificate or HTTP errors", async () => {
  let directCalls = 0;
  await assert.rejects(() => fetchWithProxyFallback(
    "https://updates.example.test/services.json",
    async () => { throw new Error("net::ERR_CERT_AUTHORITY_INVALID"); },
    async () => { directCalls += 1; return new Response("[]"); },
  ), /ERR_CERT_AUTHORITY_INVALID/);
  assert.equal(directCalls, 0);
});

test("applies a valid block and records success or failure without changing other blocks", async () => {
  const path = `/tmp/product-navigation-clusters-${process.pid}.json`;
  await writeFile(path, '[{"id":"new-cluster","name":"New Cluster"}]');
  const navigation = normalizeConfig({ ...defaultConfig, products: [{ id: "product", name: "Product" }] });
  navigation.updates.blocks.clusters = { enabled: true, url: path };
  let storedNavigation = navigation;
  const fakeStore = {
    loaded: true,
    get navigation() { return storedNavigation; },
    setNavigation(value: typeof navigation) { storedNavigation = value; },
  } as unknown as ProductNavigationStore;
  let delivered = navigation;
  const updater = new ProductNavigationUpdater(fakeStore, value => { delivered = value; });
  await updater.updateBlock("clusters");
  assert.equal(delivered.clusters[0].name, "New Cluster");
  assert.deepEqual(delivered.products, navigation.products);
  assert.equal(delivered.updates.blocks.clusters.lastStatus?.success, true);
  delivered.updates.blocks.clusters.url = "/missing/product-navigation.json";
  await updater.updateBlock("clusters");
  assert.equal(delivered.updates.blocks.clusters.lastStatus?.success, false);
  assert.match(delivered.updates.blocks.clusters.lastStatus?.message ?? "", /ENOENT/);
});

test("manual updates use and persist the source passed by the settings form", async () => {
  const path = `/tmp/product-navigation-manual-${process.pid}.json`;
  await writeFile(path, '[{"id":"manual","name":"Manual"}]');
  const navigation = normalizeConfig(defaultConfig);
  let storedNavigation = navigation;
  const fakeStore = {
    loaded: true,
    get navigation() { return storedNavigation; },
    setNavigation(value: typeof navigation) { storedNavigation = value; },
  } as unknown as ProductNavigationStore;
  const updater = new ProductNavigationUpdater(fakeStore, () => undefined);
  const result = await updater.updateBlock("clusters", `  ${path}  `);
  assert.equal(result.success, true);
  assert.equal(storedNavigation.updates.blocks.clusters.url, path);
  assert.equal(storedNavigation.clusters[0].name, "Manual");
});

test("automatic update downloads every enabled source when any one is due and validates them together", async () => {
  const servicesPath = `/tmp/product-navigation-automatic-services-${process.pid}.json`;
  const hiddenPath = `/tmp/product-navigation-automatic-hidden-${process.pid}.json`;
  await writeFile(servicesPath, '[{"id":"new-service","name":"New Service","components":[]}]');
  await writeFile(hiddenPath, '{"services":{}}');
  const navigation = normalizeConfig({
    ...defaultConfig,
    services: [{ id: "old-service", name: "Old Service", components: [{ id: "old-component", name: "Old Component", targets: [] }] }],
    hidden: { services: { "old-service": { components: ["old-component"] } } },
  });
  navigation.updates.interval = "hour";
  navigation.updates.blocks.services = { enabled: true, url: servicesPath };
  navigation.updates.blocks.hidden = {
    enabled: true,
    url: hiddenPath,
    lastStatus: { attemptedAt: new Date().toISOString(), success: true, message: "recent" },
  };
  let storedNavigation = navigation;
  const fakeStore = {
    loaded: true,
    get navigation() { return storedNavigation; },
    setNavigation(value: typeof navigation) { storedNavigation = value; },
  } as unknown as ProductNavigationStore;
  let report: Parameters<NonNullable<ConstructorParameters<typeof ProductNavigationUpdater>[2]>>[0] | undefined;
  let changes = 0;
  const updater = new ProductNavigationUpdater(fakeStore, () => { changes += 1; }, value => { report = value; });
  await updater.updateDueBlocks();
  assert.equal(changes, 1);
  assert.deepEqual(report?.failures, []);
  assert.equal(storedNavigation.services[0].id, "new-service");
  assert.deepEqual(storedNavigation.hidden, { services: {} });
  assert.equal(storedNavigation.updates.blocks.services.lastStatus?.success, true);
  assert.equal(storedNavigation.updates.blocks.hidden.lastStatus?.success, true);
  assert.equal(storedNavigation.updates.blocks.services.lastStatus?.attemptedAt, storedNavigation.updates.blocks.hidden.lastStatus?.attemptedAt);
  assert.deepEqual(report?.changes.services, { added: 1, removed: 1 });
  assert.deepEqual(report?.changes.components, { added: 0, removed: 1 });
});

test("automatic update rolls back every block when one enabled source cannot be loaded", async () => {
  const clustersPath = `/tmp/product-navigation-automatic-clusters-${process.pid}.json`;
  await writeFile(clustersPath, '[{"id":"new-cluster","name":"New Cluster"}]');
  const navigation = normalizeConfig({ ...defaultConfig, clusters: [{ id: "old-cluster", name: "Old Cluster" }] });
  navigation.updates.interval = "hour";
  navigation.updates.blocks.clusters = { enabled: true, url: clustersPath };
  navigation.updates.blocks.products = { enabled: true, url: "/missing/products.json" };
  let storedNavigation = navigation;
  const fakeStore = {
    loaded: true,
    get navigation() { return storedNavigation; },
    setNavigation(value: typeof navigation) { storedNavigation = value; },
  } as unknown as ProductNavigationStore;
  let report: Parameters<NonNullable<ConstructorParameters<typeof ProductNavigationUpdater>[2]>>[0] | undefined;
  const updater = new ProductNavigationUpdater(fakeStore, () => undefined, value => { report = value; });
  await updater.updateDueBlocks();
  assert.equal(storedNavigation.clusters[0].id, "old-cluster");
  assert.equal(report?.failures.length, 2);
  assert.match(report?.failures.find(failure => failure.block === "products")?.message ?? "", /ENOENT/);
  assert.match(report?.failures.find(failure => failure.block === "clusters")?.message ?? "", /Not applied because another automatic update source failed/);
  assert.equal(storedNavigation.updates.blocks.clusters.lastStatus?.success, false);
  assert.equal(storedNavigation.updates.blocks.products.lastStatus?.success, false);
});

test("automatic update rolls back downloaded blocks when their combined configuration is invalid", async () => {
  const servicesPath = `/tmp/product-navigation-invalid-services-${process.pid}.json`;
  const hiddenPath = `/tmp/product-navigation-invalid-hidden-${process.pid}.json`;
  await writeFile(servicesPath, '[{"id":"new-service","name":"New Service","components":[]}]');
  await writeFile(hiddenPath, '{"services":{"new-service":{"components":["missing-component"]}}}');
  const navigation = normalizeConfig(defaultConfig);
  navigation.updates.interval = "ten-minutes";
  navigation.updates.blocks.services = { enabled: true, url: servicesPath };
  navigation.updates.blocks.hidden = { enabled: true, url: hiddenPath };
  let storedNavigation = navigation;
  const fakeStore = {
    loaded: true,
    get navigation() { return storedNavigation; },
    setNavigation(value: typeof navigation) { storedNavigation = value; },
  } as unknown as ProductNavigationStore;
  let report: Parameters<NonNullable<ConstructorParameters<typeof ProductNavigationUpdater>[2]>>[0] | undefined;
  const updater = new ProductNavigationUpdater(fakeStore, () => undefined, value => { report = value; });
  await updater.updateDueBlocks();
  assert.deepEqual(storedNavigation.services, []);
  assert.deepEqual(storedNavigation.hidden, { services: {} });
  assert.equal(report?.failures.length, 2);
  assert.match(report?.failures[0].message ?? "", /Combined validation failed/);
  assert.match(report?.failures[0].message ?? "", /must reference a component/);
});
