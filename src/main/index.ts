import { Main } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";
import type { ProductNavigationBlock } from "../common/products";
import { ProductNavigationUpdater } from "./updater";

const channels = ["target", "ready", "applied"] as const;

export default class ProductNavigationMainExtension extends Main.LensExtension {
  private updater?: ProductNavigationUpdater;

  async onActivate(): Promise<void> {
    const store = getProductNavigationStore();
    store.loadExtension(this);
    const ipc = Main.Ipc.createInstance<Main.Ipc, [Main.LensExtension]>(this);
    for (const channel of channels) {
      ipc.listen(`${channel}:request`, (_event: unknown, payload: unknown) => ipc.broadcast(`${channel}:delivery`, payload));
    }
    this.updater = new ProductNavigationUpdater(
      store,
      navigation => ipc.broadcast("configuration:delivery", navigation),
      report => ipc.broadcast("automatic-update:delivery", report),
    );
    ipc.listen("update-block:request", (_event: unknown, request: { block?: ProductNavigationBlock; source?: string } | ProductNavigationBlock) => {
      const block = typeof request === "string" ? request : request?.block;
      const source = typeof request === "object" && typeof request?.source === "string" ? request.source : undefined;
      if (block && ["clusters", "products", "services", "hidden"].includes(block)) void this.updater?.updateBlock(block, source);
    });
    this.updater.start();
  }

  onDeactivate(): void { this.updater?.stop(); }
}
