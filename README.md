# Freelens Product Navigation Extension

Product-oriented navigation for Freelens **1.10.0 and newer**, extracted from
the original Freelens fork into an independently installable extension.

## Features

- a global **Products** page, opened with the `account_tree` button in the
  application top bar or the **Products** action on Welcome;
- the same page inside every cluster under **Products** in the sidebar;
- free-text filtering plus autocomplete for service, component, cluster, and
  namespace labels, with OR within a label type and AND between types;
- selected labels, unfinished search text, hidden-toggle, and scroll state
  preserved while visiting targets;
- multiple namespaces per component, without duplicating table rows;
- one-click cross-cluster navigation which activates the selected catalog
  cluster, selects the component namespace, and opens **Workloads → Pods**;
- separate validated JSON editors for clusters, products, services, and hidden
  components in **Preferences → Extensions → Product navigation**;
- optional scheduled updates of each JSON block from an HTTPS URL, `file://`
  URL, or local path, with per-block status and manual refresh.

The global page and cross-frame hand-off use Freelens extension points:
`globalPages`, `topBarItems`, Catalog entities, extension IPC, `namespaceStore`,
and renderer navigation. A small DOM placement shim moves the legacy
`topBarItems` registration beside Home because that API currently registers
all extension items on the right and exposes no side/order option. No Freelens
fork or private source import is required.

## Configuration format

Preferences presents the four root blocks as independent options. This lets a
team update frequently changing services without replacing cluster names or a
user's hidden-component choices. The four domain blocks are shown together
below for reference; each editor contains only its own root value (`clusters`,
`products`, `services`, or `hidden`), while refresh settings and statuses are
managed by the controls beside it. Every component uses an explicit `targets`
array. Cluster IDs in each target
refer to entries in the top-level `clusters` array. A configured cluster ID is
resolved against either the catalog entity ID or its name.

```json
{
  "clusters": [
    { "id": "development", "name": "Development" },
    { "id": "production", "name": "Production" }
  ],
  "products": [
    { "id": "storefront", "name": "Storefront" }
  ],
  "services": [
    {
      "id": "checkout",
      "name": "Checkout",
      "productId": "storefront",
      "components": [
        {
          "id": "checkout-api",
          "name": "API",
          "targets": [
            { "namespace": "checkout-dev", "clusters": ["development"] },
            { "namespace": "checkout-stage", "clusters": ["production"] }
          ]
        }
      ]
    }
  ],
  "hidden": {
    "services": {
      "checkout": { "components": ["checkout-api"] }
    }
  }
}
```

Each block can optionally be refreshed from a local path, a `file://` URL, or
an `http://`/`https://` URL. The source must return the block value itself: an
array for `clusters`, `products`, and `services`, or an object containing the
`services` map for `hidden`. Automatic refresh can run every hour, six hours,
day (the default), or week. Freelens checks every five minutes and refreshes a
block when at least that interval has elapsed since its last attempt. Attempt
time and success/error information are persisted and displayed beside the
block. **Update now** uses the same validation and status path even when
automatic refresh is disabled.

Updates are applied in dependency order (`clusters`, `products`, `services`,
then `hidden`) and each candidate is validated against the currently stored
other blocks. Invalid or unreachable content never replaces a valid block.

`id` and `name` are required on clusters, products, services, and components.
`productId` is optional. Every referenced product, cluster, service, and hidden
component is validated before **Apply** is enabled. Each component has a
`targets` array; every target explicitly binds one `namespace` to the clusters
where that namespace exists. Targets are shown in the same component row, so
different environments do not create duplicate component rows or accidental
namespace × cluster combinations.

## Build and install

```sh
corepack enable
pnpm install
pnpm test
pnpm typecheck
pnpm pack:extension
```

Install `mryoda-freelens-product-navigation-extension-0.3.1.tgz` from the Freelens
**Extensions** screen. The package contains self-contained CommonJS main and
renderer entries and has no runtime npm dependencies, so installation does not
need registry access. Freelens validates its engine field more narrowly than
npm semver; keep `engines.freelens` in the `^major.minor.patch` form.

After the first npm publication, users can instead enter the lowercase package
name directly in Freelens:

```text
@mryoda/freelens-product-navigation-extension
```

Package scopes on npm are lowercase, so `@MrYoda/...` is not a valid npm package
name even though GitHub account names are case-insensitive. npm does not allow a
trusted publisher to create a brand-new package: publish the first version once
with `npm publish --access public` from a machine authenticated as an npm user
that owns the `mryoda` scope. Complete the interactive 2FA challenge if npm asks
for it; do not create a granular access token (GAT) that bypasses 2FA for this
workflow.

Then, on the npm package's **Settings → Trusted Publisher** page, select GitHub
Actions and configure organization/user `MrYoda`, repository
`freelens-product-navigation-extension`, workflow `publish.yml`, environment
`npm`, and allow the `npm publish` action. The names are case-sensitive, and the
workflow file field is a filename rather than `.github/workflows/publish.yml`.
Keep `id-token: write` in the workflow and enable 2FA on the maintainer account.

Subsequent workflow runs need neither `NPM_TOKEN` nor any other long-lived npm
token: npm exchanges GitHub's short-lived OIDC identity for publish access. This
is unaffected by the 2026 removal of direct publishing from 2FA-bypass GATs. The
workflow pins a compatible npm 11 release, publishes the package as public, and
attaches provenance. The npm 12 install-time restrictions also do not affect the
build because dependencies are installed with pnpm. Then set
`package.json.version` to an unpublished version and publish a GitHub Release;
the workflow builds, validates, and publishes the public package with npm
provenance. A maintainer can also run it manually from **Actions**.

## Real Freelens GUI smoke test

`scripts/gui/mock-kubernetes.mjs` implements enough of the Kubernetes HTTP API
for two independent clusters, each with two namespaces and mock Pods:

| context | endpoint | namespaces |
| --- | --- | --- |
| `cluster-a` | `127.0.0.1:16443` | `team-a`, `shared` |
| `cluster-b` | `127.0.0.1:16444` | `team-b`, `shared` |

Start it with a disposable kubeconfig path:

```sh
pnpm mock:kubernetes -- /tmp/product-navigation-kubeconfig
```

Put `scripts/gui/product-navigation.json` into the extension preference store,
start Freelens 1.10.3 with Chromium remote debugging enabled, and run:

```sh
CDP_PORT=9222 pnpm smoke:gui
EXPECT_PRODUCT_NAME="Commerce" SET_PRODUCT_NAME="Commerce persisted" pnpm smoke:settings
```

The smoke test drives the actual Freelens renderer through the Chrome DevTools
Protocol. It opens the global page and verifies both complete flows:
`Cluster A → team-a → cluster-a-pod` and
`Cluster B → team-b → cluster-b-pod`.
The settings smoke test edits the actual Preferences textarea and presses
**Apply**. Restart Freelens and run it again with only
`EXPECT_PRODUCT_NAME="Commerce persisted"` to verify disk persistence and UI
rehydration across application launches.

## Architecture

- `src/common/products.ts` defines the fork-compatible schema and validation.
- `src/common/store.ts` persists it through `ExtensionStore` in every process.
- `src/main/index.ts` relays namespaced extension IPC messages between frames.
- `src/renderer/index.tsx` registers global/cluster pages, menus, top bar, and
  preferences.
- `src/renderer/navigation.ts` performs catalog activation and the readiness
  handshake needed when a cluster frame has not been created yet.
- `docs/freelens-ux-research.md` evaluates Hotbar, quick-palette, and
  multi-cluster dashboard options against the Freelens 1.10.3 extension API.

The renderer deliberately distinguishes the application window from cluster
frames before accessing Kubernetes stores: those stores are unavailable in the
global renderer. Request and delivery IPC channels are also distinct so a main
process relay cannot receive and rebroadcast its own message recursively.
