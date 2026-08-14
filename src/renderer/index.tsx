import React from "react";
import { Renderer } from "@freelensapp/extensions";
import { ProductsPage, ProductsIcon } from "./products-page";
import { Preferences } from "./preferences";
import styles from "./styles.css?inline";

const styleId = "freelens-product-navigation-extension-styles";
if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = styles;
  document.head.append(style);
}

export default class ProductNavigationRendererExtension extends Renderer.LensExtension {
  clusterPages = [{ id: "product-navigation", components: { Page: ProductsPage } }];
  clusterPageMenus = [{
    target: { pageId: "product-navigation" },
    title: "Products",
    components: { Icon: ProductsIcon },
  }];
  appPreferences = [{
    title: "Product navigation",
    components: { Hint: () => <span>Configure products, components, clusters and namespaces as JSON.</span>, Input: Preferences },
  }];
}
