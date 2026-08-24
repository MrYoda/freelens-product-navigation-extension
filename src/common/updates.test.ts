import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig, normalizeConfig } from "./products.ts";
import { shouldUpdateBlock, updateIntervalMilliseconds } from "./updates.ts";

test("disables automatic updates by default", () => {
  assert.equal(normalizeConfig().updates.interval, "never");
  assert.equal(updateIntervalMilliseconds.day, 24 * 60 * 60 * 1_000);
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
