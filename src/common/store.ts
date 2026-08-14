import { Common, Main } from "./freelens-api";
import { defaultConfig, type ProductNavigationConfig } from "./products";

export class ProductNavigationStore extends Common.Store.ExtensionStore<ProductNavigationConfig> {
  private config = defaultConfig;

  constructor() {
    super({ configName: "product-navigation" });
  }

  loadExtension(extension: InstanceType<typeof Main.LensExtension>): void {
    super.loadExtension(extension);
  }

  fromStore(data: Partial<ProductNavigationConfig>): void {
    this.config = { products: data.products ?? [] };
  }

  toJSON(): ProductNavigationConfig {
    return this.config;
  }

  get(): ProductNavigationConfig {
    return this.config;
  }

  set(config: ProductNavigationConfig): void {
    this.config = config;
  }
}

export const productNavigationStore = new ProductNavigationStore();
