# Freelens Product Navigation Extension

Product-oriented navigation for Freelens **1.10.0 and newer**. The extension is
installed from a locally built `.tgz`; it is not intended for npm publication.

## Compatibility audit

The domain model, validation, preferences UI, product filtering, hidden
components, namespace selection and Pods navigation can be implemented with the
public extension API. Freelens 1.10.0 does not expose public extension points for
an application-level top-bar button/global page or for activating and messaging
another cluster frame. Consequently this extension uses the supported cluster
page and cluster sidebar menu APIs. It displays targets belonging to the active
cluster; selecting a namespace updates that cluster's namespace context and
opens Pods.

This is deliberately an API-only extension: it does not import Freelens source
internals, use Electron `sendToFrame`, or rely on cross-origin local storage. A
future exact reproduction of the fork's cross-cluster UX requires upstream,
general-purpose APIs for app pages/menu items and cluster activation/navigation.

## Configuration

Open **Preferences → Extensions → Product navigation** and enter JSON:

```json
{
  "products": [{
    "name": "Storefront",
    "description": "Customer-facing services",
    "components": [{
      "name": "API",
      "description": "HTTP API",
      "targets": [
        { "cluster": "development", "namespace": "storefront-dev" },
        { "cluster": "production", "namespace": "storefront" }
      ]
    }]
  }]
}
```

`cluster` must exactly equal the catalog cluster name. Set `hidden: true` on a
component to hide it unless **Show hidden** is enabled.

## Build and install

```sh
corepack enable
pnpm install
pnpm test
pnpm pack:extension
```

The build has two library entry points and intentionally has no renderer
`index.html`: `dist/main/index.cjs` runs in the main process and
`dist/renderer/index.cjs` is loaded by the Freelens renderer. Freelens and React
are build-time development dependencies and remain external, so a normal build
must not bundle the Freelens application into the extension. Both entry points
are emitted as CommonJS because Freelens 1.10 loads installed extensions with
`require()`. An ESM module may unpack successfully and then fail during loading;
the UI surfaces that failure as a generic installation timeout. Dependencies are
deliberately **not** declared as package runtime or peer dependencies: otherwise
the Freelens installer invokes its package manager to resolve them from npm and
an offline or restricted installation eventually reports a timeout.

In Freelens, open **Extensions**, select the generated
`freelens-product-navigation-extension-0.1.3.tgz`, and install it. Open a cluster
and choose **Products** in its sidebar.

If an earlier version timed out, remove that failed installation and use the
`0.1.3` archive. The version bump prevents a package-manager cache entry for
the failed archive from being reused.

Freelens validates its engine field more narrowly than npm semver: use
`"engines": { "freelens": "^1.10.0" }`. Although `>=1.10.0` is a valid npm
range, Freelens rejects that manifest during discovery. Its installer then waits
for the rejected extension to appear and eventually shows the misleading
installation timeout.

## Architecture

- `src/common/products.ts` contains the portable schema, validation and filter.
- `src/common/store.ts` persists preferences through `ExtensionStore`.
- `src/main/index.ts` loads the extension store in the main process.
- `src/renderer` registers preferences and the cluster page/menu.

## Development constraints

The implementation targets the documented public surface of
`@freelensapp/extensions`. The repository's tests intentionally exercise the
domain layer without Electron, Freelens, or network access.
