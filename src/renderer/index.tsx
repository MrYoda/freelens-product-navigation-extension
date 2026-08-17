import React from "react";
import { Renderer } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";
import { activateNavigation } from "./navigation";
import { Preferences } from "./preferences";
import { ProductsIcon, ProductsPage } from "./products-page";
import styles from "./styles.css?inline";

const styleId = "freelens-product-navigation-extension-styles";
if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = styles;
  document.head.append(style);
}

export default class ProductNavigationRendererExtension extends Renderer.LensExtension {
  private async openGlobalProducts() {
    await (this as unknown as { navigate: (pageId: string) => Promise<void> }).navigate("product-navigation-global");
  }

  globalPages = [{ id: "product-navigation-global", components: { Page: ProductsPage } }];
  clusterPages = [{ id: "product-navigation-cluster", components: { Page: ProductsPage } }];
  clusterPageMenus = [{ id: "product-navigation-cluster", target: { pageId: "product-navigation-cluster" }, title: "Products", components: { Icon: ProductsIcon } }];
  topBarItems = [{ components: { Item: () => {
    const ref = React.useRef<HTMLButtonElement>(null);
    React.useLayoutEffect(() => {
      const item = ref.current?.parentElement;
      const home = document.querySelector('[data-testid="home-button"]')?.parentElement;
      if (item && home?.parentElement) home.after(item);
    }, []);
    return <button ref={ref}
    aria-label="Products"
    className="ProductNavigationTopBarButton"
    data-testid="product-navigation-top-bar-button"
    onClick={() => void this.openGlobalProducts()}
    title="Products"
    type="button"
    ><Renderer.Component.Icon material="account_tree" /></button>;
  } } }];
  welcomeMenus = [{
    title: "Products",
    icon: "account_tree",
    click: () => this.openGlobalProducts(),
  }];
  appPreferences = [{
    title: "Product navigation",
    components: { Hint: () => <span>Configure clusters, products, services, components, and hidden components as JSON.</span>, Input: () => <Preferences /> },
  }];

  onActivate() {
    getProductNavigationStore().loadExtension(this);
    activateNavigation(this);
  }
}
