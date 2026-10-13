import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig, normalizeConfig } from "./products.ts";
import { getAutomaticUpdateNotification, shouldUpdateBlock, summarizeNavigationChanges, updateIntervalMilliseconds } from "./updates.ts";

test("disables automatic updates by default", () => {
  const updates = normalizeConfig().updates;
  assert.equal(updates.interval, "never");
  assert.deepEqual(updates.notifications, { failures: true, successes: false });
  assert.equal(updateIntervalMilliseconds["ten-minutes"], 10 * 60 * 1_000);
  assert.equal(updateIntervalMilliseconds.day, 24 * 60 * 60 * 1_000);
});

test("adds notification defaults to saved settings from older versions", () => {
  const saved: unknown = structuredClone(defaultConfig);
  delete (saved as { updates: { notifications?: unknown } }).updates.notifications;
  assert.deepEqual(normalizeConfig(saved).updates.notifications, { failures: true, successes: false });
});

test("never prevents updates even for enabled sources", () => {
  const navigation = structuredClone(defaultConfig);
  navigation.updates.blocks.clusters = { enabled: true, url: "/tmp/clusters.json" };
  assert.equal(shouldUpdateBlock(navigation, "clusters"), false);
});

test("only schedules enabled configured blocks after the selected interval", () => {
  const now = Date.parse("2026-08-17T12:00:00Z");
  const navigation = normalizeConfig({
    updates: {
      interval: "six-hours",
      blocks: {
        ...defaultConfig.updates.blocks,
        clusters: { enabled: true, url: "/tmp/clusters.json", lastStatus: { attemptedAt: "2026-08-17T07:00:01Z", success: true, message: "ok" } },
      },
    },
  });
  assert.equal(shouldUpdateBlock(navigation, "clusters", now), false);
  navigation.updates.blocks.clusters.lastStatus = { attemptedAt: "2026-08-17T05:59:59Z", success: false, message: "failed" };
  assert.equal(shouldUpdateBlock(navigation, "clusters", now), true);
  navigation.updates.blocks.clusters.enabled = false;
  assert.equal(shouldUpdateBlock(navigation, "clusters", now), false);
});

test("summarizes cluster, service, and component additions and removals by id", () => {
  const before = normalizeConfig({
    ...defaultConfig,
    clusters: [{ id: "old", name: "Old" }],
    services: [{ id: "kept", name: "Kept", components: [{ id: "old-component", name: "Old", targets: [] }] }, { id: "removed", name: "Removed", components: [] }],
  });
  const after = normalizeConfig({
    ...defaultConfig,
    clusters: [{ id: "new", name: "New" }],
    services: [{ id: "kept", name: "Kept", components: [{ id: "new-component", name: "New", targets: [] }] }, { id: "added", name: "Added", components: [] }],
  });
  assert.deepEqual(summarizeNavigationChanges(before, after), {
    clusters: { added: 1, removed: 1 },
    services: { added: 1, removed: 1 },
    components: { added: 1, removed: 1 },
  });
});

test("formats built-in success and multi-file failure notifications", () => {
  const changes = {
    clusters: { added: 2, removed: 1 },
    services: { added: 3, removed: 0 },
    components: { added: 4, removed: 2 },
  };
  assert.equal(getAutomaticUpdateNotification({ failures: [], changes, notifications: { failures: true, successes: false } }), undefined);
  assert.deepEqual(getAutomaticUpdateNotification({ failures: [], changes, notifications: { failures: true, successes: true } }), {
    success: true,
    message: "Automatic update completed: clusters +2/-1, services +3/-0, components +4/-2",
  });
  const failed = getAutomaticUpdateNotification({
    failures: [
      { block: "products", source: "https://example.test/products.json", message: "HTTP 503 Service Unavailable" },
      { block: "services", source: "/missing/services.json", message: "ENOENT" },
    ],
    changes,
    notifications: { failures: true, successes: true },
  });
  assert.equal(failed?.success, false);
  assert.match(failed?.message ?? "", /products \(https:\/\/example\.test\/products\.json\): HTTP 503/);
  assert.match(failed?.message ?? "", /services \(\/missing\/services\.json\): ENOENT/);
});
