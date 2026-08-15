import { Common, Main } from "@freelensapp/extensions";
import { makeObservable, observable } from "mobx";
import { defaultConfig, normalizeConfig, type ProductNavigationPreferences } from "./products";

export class ProductNavigationStore extends Common.Store.ExtensionStore<ProductNavigationPreferences> {
  navigation = defaultConfig;

  constructor() {
    super({ configName: "product-navigation", defaults: defaultConfig });
    makeObservable(this, { navigation: observable });
  }

  loadExtension(extension: InstanceType<typeof Main.LensExtension>): void {
    super.loadExtension(extension);
  }

  fromStore(data: Partial<ProductNavigationPreferences>): void {
    this.navigation = normalizeConfig(data);
  }

  toJSON(): ProductNavigationPreferences {
    return this.navigation;
  }

  setNavigation(navigation: ProductNavigationPreferences): void {
    this.navigation = navigation;
  }
}

let instance: ProductNavigationStore | undefined;
export const getProductNavigationStore = () => instance ??= new ProductNavigationStore();
