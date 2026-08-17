import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { normalizeConfig } from "../common/products.ts";
import type { ProductNavigationStore } from "../common/store.ts";
import { ProductNavigationUpdater, readUpdateSource } from "./updater.ts";

test("reads update JSON from local paths, file URLs, and HTTP URLs", async () => {
  const path = `/tmp/product-navigation-update-${process.pid}.json`;
  await writeFile(path, '[{"id":"local","name":"Local"}]');
  assert.match(await readUpdateSource(path), /Local/);
  assert.match(await readUpdateSource(new URL(`file://${path}`).href), /Local/);
  const server = createServer((_request, response) => response.end('[{"id":"remote","name":"Remote"}]'));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  assert.match(await readUpdateSource(`http://127.0.0.1:${address.port}/clusters.json`), /Remote/);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("applies a valid block and records success or failure without changing other blocks", async () => {
  const path = `/tmp/product-navigation-clusters-${process.pid}.json`;
  await writeFile(path, '[{"id":"new-cluster","name":"New Cluster"}]');
  const navigation = normalizeConfig({ products: [{ id: "product", name: "Product" }] });
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
