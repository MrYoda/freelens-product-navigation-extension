import { Renderer } from "@freelensapp/extensions";
import type { ProductNavigationBlock, ProductNavigationPreferences } from "../common/products";
import { getProductNavigationStore } from "../common/store";

let ipc: Renderer.Ipc | undefined;
const listeners = new Set<() => void>();

export const activateUpdates = (extension: Renderer.LensExtension) => {
  ipc = Renderer.Ipc.createInstance<Renderer.Ipc, [Renderer.LensExtension]>(extension);
  ipc.listen("configuration:delivery", (_event: unknown, navigation: ProductNavigationPreferences) => {
    getProductNavigationStore().setNavigation(navigation);
    listeners.forEach(listener => listener());
  });
};

export const requestBlockUpdate = (block: ProductNavigationBlock) => ipc?.broadcast("update-block:request", block);
export const subscribeToConfigurationUpdates = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
