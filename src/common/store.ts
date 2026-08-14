import { Common } from "./freelens-api";
import { defaultConfig, type ProductNavigationConfig } from "./products";

export class ProductNavigationStore extends Common.Store.ExtensionStore<ProductNavigationConfig> {
  defaults = defaultConfig;
}

export const productNavigationStore = new ProductNavigationStore({ configName: "product-navigation" });
