import { Renderer } from "@freelensapp/extensions";
import type { ProductNavigationBlock, ProductNavigationPreferences } from "../common/products";
import { getAutomaticUpdateNotification, type ProductNavigationAutomaticUpdateReport } from "../common/updates";
import { getProductNavigationStore } from "../common/store";

let ipc: Renderer.Ipc | undefined;
const listeners = new Set<() => void>();

export const activateUpdates = (extension: Renderer.LensExtension) => {
  ipc = Renderer.Ipc.createInstance<Renderer.Ipc, [Renderer.LensExtension]>(extension);
  ipc.listen("configuration:delivery", (_event: unknown, navigation: ProductNavigationPreferences) => {
    getProductNavigationStore().setNavigation(navigation);
    listeners.forEach(listener => listener());
  });
  ipc.listen("automatic-update:delivery", (_event: unknown, report: ProductNavigationAutomaticUpdateReport) => {
    // IPC is delivered to both the application renderer and cluster frames.
    // The application renderer owns notifications; showing them in every frame duplicates the toast.
    if (location.hostname.endsWith(".renderer.freelens.app")) return;
    const notification = getAutomaticUpdateNotification(report);
    if (notification?.success) Renderer.Component.Notifications.ok(notification.message);
    else if (notification) Renderer.Component.Notifications.error(notification.message);
  });
};

export const requestBlockUpdate = (block: ProductNavigationBlock, source: string) => ipc?.broadcast("update-block:request", { block, source });
export const subscribeToConfigurationUpdates = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
