# Freelens Product Navigation Extension

Product-oriented navigation for Freelens **1.10.0 and newer**, extracted from
the original Freelens fork into an independently installable extension.

## Features

- a global **Products** page, opened with the `account_tree` button in the
  application top bar;
- the same page inside every cluster under **Products** in the sidebar;
- product/service/component filtering and persistent hidden components;
- one-click cross-cluster navigation which activates the selected catalog
  cluster, selects the component namespace, and opens **Workloads → Pods**;
- a validated JSON editor in **Preferences → Extensions → Product navigation**.

The global page and cross-frame hand-off use only public Freelens extension
points: `globalPages`, `topBarItems`, Catalog entities, extension IPC,
`namespaceStore`, and renderer navigation. No Freelens fork or private source
import is required.

## Configuration format

The format is intentionally identical to the `productNavigation` preference in
the original fork. Cluster IDs in component `clusters` refer to entries in the
top-level `clusters` array. A configured cluster ID is resolved against either
the catalog entity ID or its name.

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
          "namespace": "checkout",
          "clusters": ["development", "production"]
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

`id` and `name` are required on clusters, products, services, and components.
`productId` is optional. Every referenced product, cluster, service, and hidden
component is validated before **Apply** is enabled.

## Build and install

```sh
corepack enable
pnpm install
pnpm test
pnpm typecheck
pnpm pack:extension
```

Install `freelens-product-navigation-extension-0.2.0.tgz` from the Freelens
**Extensions** screen. The package contains self-contained CommonJS main and
renderer entries and has no runtime npm dependencies, so installation does not
need registry access. Freelens validates its engine field more narrowly than
npm semver; keep `engines.freelens` in the `^major.minor.patch` form.

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
```

The smoke test drives the actual Freelens renderer through the Chrome DevTools
Protocol. It opens the global page and verifies both complete flows:
`Cluster A → team-a → cluster-a-pod` and
`Cluster B → team-b → cluster-b-pod`.

## Architecture

- `src/common/products.ts` defines the fork-compatible schema and validation.
- `src/common/store.ts` persists it through `ExtensionStore` in every process.
- `src/main/index.ts` relays namespaced extension IPC messages between frames.
- `src/renderer/index.tsx` registers global/cluster pages, menus, top bar, and
  preferences.
- `src/renderer/navigation.ts` performs catalog activation and the readiness
  handshake needed when a cluster frame has not been created yet.

The renderer deliberately distinguishes the application window from cluster
frames before accessing Kubernetes stores: those stores are unavailable in the
global renderer. Request and delivery IPC channels are also distinct so a main
process relay cannot receive and rebroadcast its own message recursively.
