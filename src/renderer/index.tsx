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
  globalPages = [{ id: "product-navigation-global", components: { Page: ProductsPage } }];
  clusterPages = [{ id: "product-navigation-cluster", components: { Page: ProductsPage } }];
  clusterPageMenus = [{ id: "product-navigation-cluster", target: { pageId: "product-navigation-cluster" }, title: "Products", components: { Icon: ProductsIcon } }];
  topBarItems = [{ components: { Item: () => <button
    aria-label="Products"
    className="ProductNavigationTopBarButton"
    data-testid="product-navigation-top-bar-button"
    onClick={() => void (this as unknown as { navigate: (pageId: string) => Promise<void> }).navigate("product-navigation-global")}
    title="Products"
    type="button"
  ><Renderer.Component.Icon material="account_tree" /></button> } }];
  appPreferences = [{
    title: "Product navigation",
    components: { Hint: () => <span>Configure clusters, products, services, components, and hidden components as JSON.</span>, Input: () => <Preferences /> },
  }];

  onActivate() {
    getProductNavigationStore().loadExtension(this);
    activateNavigation(this);
  }
}
