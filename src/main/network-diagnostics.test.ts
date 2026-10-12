import assert from "node:assert/strict";
import test from "node:test";
import { getProxyRouteDiagnostics } from "./network-diagnostics.ts";

test("reports both Freelens and isolated-session proxy routes", async () => {
  assert.equal(await getProxyRouteDiagnostics(
    async () => "PROXY stale-proxy.example.test:8080",
    async () => "DIRECT",
  ), 'Proxy routes: Freelens default session="PROXY stale-proxy.example.test:8080"; isolated system session="DIRECT"');
});

test("keeps diagnostics available when resolving one route fails", async () => {
  assert.equal(await getProxyRouteDiagnostics(
    async () => { throw new Error("session unavailable"); },
    async () => "DIRECT",
  ), 'Proxy routes: Freelens default session=<resolve failed: session unavailable>; isolated system session="DIRECT"');
});
