import { Renderer } from "@freelensapp/extensions";
interface NavigationTarget { clusterId: string; namespace: string }
const pendingTargets = new Map<string, NavigationTarget>();
let ipc: Renderer.Ipc | undefined;

const resolveCluster = (configuredId: string) => {
  const entities = [...Renderer.Catalog.catalogEntities.entities.values()];
  return entities.find(entity => entity.getId() === configuredId || entity.getName() === configuredId);
};

const getClusterFrameId = () => {
  if (typeof location === "undefined") return undefined;
  const suffix = ".renderer.freelens.app";
  return location.hostname.endsWith(suffix) ? location.hostname.slice(0, -suffix.length) : undefined;
};

const applyTarget = (target: NavigationTarget) => {
  // The renderer entry runs in both the application window and cluster frames.
  // K8s stores deliberately throw when accessed from the application window.
  if (getClusterFrameId() !== target.clusterId) return;
  Renderer.K8sApi.namespaceStore.selectSingle(target.namespace);
  Renderer.Navigation.navigate("/pods");
  ipc?.broadcast("applied:request", target.clusterId);
};

export const activateNavigation = (extension: Renderer.LensExtension) => {
  ipc = Renderer.Ipc.createInstance<Renderer.Ipc, [Renderer.LensExtension]>(extension);
  ipc.listen("target:delivery", (_event: unknown, target: NavigationTarget) => applyTarget(target));
  ipc.listen("ready:delivery", (_event: unknown, clusterId: string) => {
    const pending = pendingTargets.get(clusterId);
    if (pending) ipc?.broadcast("target:request", pending);
  });
  ipc.listen("applied:delivery", (_event: unknown, clusterId: string) => pendingTargets.delete(clusterId));

  const frameClusterId = getClusterFrameId();
  if (frameClusterId) setTimeout(() => ipc?.broadcast("ready:request", frameClusterId), 0);
};

export const navigateToProductTarget = async (namespace: string, configuredClusterId: string) => {
  const entity = resolveCluster(configuredClusterId);
  if (!entity?.onRun) throw new Error(`Cannot find Kubernetes cluster "${configuredClusterId}"`);
  const target = { clusterId: entity.getId(), namespace };
  pendingTargets.set(target.clusterId, target);
  ipc?.broadcast("target:request", target);
  await entity.onRun({ navigate: Renderer.Navigation.navigate, setCommandPaletteContext: () => undefined });
};
