import { Common, Main } from "@freelensapp/extensions";
import { action, makeObservable, observable } from "mobx";
import { defaultConfig, normalizeConfig, type ProductNavigationPreferences } from "./products";

export class ProductNavigationStore extends Common.Store.ExtensionStore<ProductNavigationPreferences> {
  navigation = defaultConfig;
  loaded = false;

  constructor() {
    super({ configName: "product-navigation", defaults: defaultConfig });
    makeObservable(this, {
      navigation: observable,
      loaded: observable,
      fromStore: action,
      setNavigation: action,
    });
  }

  loadExtension(extension: InstanceType<typeof Main.LensExtension>): void {
    super.loadExtension(extension);
  }

  fromStore(data: ProductNavigationPreferences): void {
    this.navigation = normalizeConfig(data);
    this.loaded = true;
  }

  toJSON(): ProductNavigationPreferences {
    // PersistentStorage uses a MobX reaction around toJSON(). Returning the
    // observable object itself does not observe its nested values reliably and
    // also gives the reaction the same object identity. A plain deep snapshot
    // both tracks every JSON field and gives persistence/IPC an immutable model.
    return JSON.parse(JSON.stringify(this.navigation)) as ProductNavigationPreferences;
  }

  setNavigation(navigation: ProductNavigationPreferences): void {
    this.navigation = navigation;
  }
}

export const getProductNavigationStore = () => (
  ProductNavigationStore as unknown as { getInstanceOrCreate(): ProductNavigationStore }
).getInstanceOrCreate();
