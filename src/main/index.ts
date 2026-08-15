import { Main } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";

const channels = ["target", "ready", "applied"] as const;

export default class ProductNavigationMainExtension extends Main.LensExtension {
  async onActivate(): Promise<void> {
    getProductNavigationStore().loadExtension(this);
    const ipc = Main.Ipc.createInstance<Main.Ipc, [Main.LensExtension]>(this);
    for (const channel of channels) {
      ipc.listen(`${channel}:request`, (_event: unknown, payload: unknown) => ipc.broadcast(`${channel}:delivery`, payload));
    }
  }
}
