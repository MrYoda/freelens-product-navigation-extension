# Freelens UX extension-point research

Research target: Freelens 1.10.3. The links below are pinned to that tag so the
conclusions do not silently change when Freelens `main` changes.

## What the supported renderer API exposes

`LensRendererExtension` exposes pages and menus, cluster-frame components,
status-bar items, commands, welcome actions, catalog customizations, and
top-bar items. It does **not** expose a registration for a Hotbar cell, an
application-layout region, a second Hotbar, or a second simultaneously visible
cluster frame. See the complete [renderer extension registration
surface](https://github.com/freelensapp/freelens/blob/v1.10.3/packages/core/src/extensions/lens-renderer-extension.ts#L60-L78).

The extension author guide also recommends staying on the extension API and
using components it exposes instead of relying on Freelens global styles or
private imports. See [HOWTO: Creating an
Extension](https://github.com/freelensapp/freelens/discussions/2296).

## Existing Hotbar: possible, but only through Catalog entities

The Hotbar stores references to Catalog entities. It resolves each reference
through the Catalog registry and clicking the icon invokes the entity's
`onRun`; there is no generic `HotbarItem` extension registration. See
[HotbarMenu](https://github.com/freelensapp/freelens/blob/v1.10.3/packages/core/src/renderer/components/hotbar/hotbar-menu.tsx#L65-L163).

This gives us a viable, supported-adjacent experiment:

1. represent each service as a custom Catalog entity;
2. let users pin those entities to the normal Hotbar;
3. make `onRun` open the Products page filtered to that service;
4. add component/target actions to the entity's Catalog context menu.

It cannot provide the exact proposed hover popover. A Hotbar entity gets an
icon click and the standard context menu, not an arbitrary child component.
It would also mix services and clusters in the same finite Hotbar and require a
Catalog category/entity implementation in both main and renderer processes.
Therefore this is useful as an **opt-in shortcut**, not as the primary product
navigator.

## A second or right-side Hotbar

There is no supported layout slot for it. A DOM insertion like the current
small top-bar ordering shim would be much riskier for a full-height interactive
panel because it would depend on private layout structure, drag/drop and frame
stacking.

The supported alternative is a compact Products launcher in the top or status
bar which opens an extension-owned drawer/palette. Status-bar registrations can
choose left or right placement; see [StatusBarRegistration](https://github.com/freelensapp/freelens/blob/v1.10.3/packages/core/src/renderer/components/status-bar/status-bar-registration.ts#L16-L48).
Inside a cluster, `clusterFrameComponents` can host an extension component with
computed visibility, as demonstrated by the upstream [cluster-frame extension
test](https://github.com/freelensapp/freelens/blob/v1.10.3/packages/core/src/features/cluster/legacy-extension-adding-cluster-frame-components.test.tsx#L29-L73).

Recommendation: build a keyboard-accessible **Products quick palette**, opened
from a right-side status-bar item and a command-palette command. It can show
service → component → target in one searchable surface without cloning the
Hotbar or patching the application layout.

## Multiple clusters at the same time

Freelens renders Kubernetes stores in a cluster-frame context. The public API
exports stores for Pods, Deployments, Services and other objects, including
`podsStore`; see the [renderer K8s API](https://github.com/freelensapp/freelens/blob/v1.10.3/packages/core/src/extensions/renderer-api/k8s-api.ts#L110-L139).
The application layout, however, has no extension registration for a split
view or multiple visible cluster frames. Creating Electron `BrowserWindow`s
would bypass supported navigation, lifecycle, security and persistence APIs,
so it is not a maintainable extension feature.

The feasible high-value solution is an extension-owned **multi-cluster
workload dashboard**:

1. activate every target cluster so its cluster-frame renderer and stores are
   available;
2. in each frame, load/watch Pods only for the configured target namespaces;
3. relay plain Pod snapshots through the existing extension IPC bridge;
4. merge them on a global extension page and add explicit Cluster and Namespace
   columns;
5. delegate actions such as opening Pods/logs back to the owning cluster frame.

This preserves Freelens authentication and Kubernetes store behavior and does
not import private host code. The first slice should be read-only and include
name, cluster, namespace, phase/readiness, restarts and age. Later slices can
add Deployments, Services, logs and controlled actions. Partial failures must
be shown per cluster rather than failing the whole dashboard.

## Recommended roadmap

1. **Next:** tags and dynamic facets on the Products page. Put tags on services,
   components and targets so the same model drives both filtering and the
   future workload dashboard.
2. **Then:** Products quick palette via a command plus right-side status item.
   This is supported and delivers most of the desired second-Hotbar speed.
3. **Then:** read-only multi-cluster Pods dashboard using cluster-frame
   collectors and IPC aggregation.
4. **Optional experiment:** service Catalog entities that users may pin to the
   existing Hotbar.
5. **Do not pursue:** DOM-injected second Hotbar, split private cluster frames,
   or unmanaged Electron windows; all have a high breakage and security cost.

