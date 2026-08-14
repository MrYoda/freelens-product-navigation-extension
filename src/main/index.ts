import { Main } from "../common/freelens-api";
import { productNavigationStore } from "../common/store";

export default class ProductNavigationMainExtension extends Main.LensExtension {
  async onActivate(): Promise<void> {
    await productNavigationStore.loadExtension(this);
  }
}
