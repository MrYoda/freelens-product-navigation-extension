import React from "react";
import { Renderer } from "../common/freelens-api";
import { productsForCluster } from "../common/products";
import { productNavigationStore } from "../common/store";

export function ProductsIcon() {
  return <Renderer.Component.Icon material="apps" />;
}

export function ProductsPage() {
  let page: HTMLDivElement | null = null;
  const cluster = Renderer.K8sApi.clusterContext.getActiveCluster()?.getName() ?? "";
  const products = productsForCluster(productNavigationStore.get(), cluster || undefined, true);
  const openPods = (namespace: string) => {
    Renderer.K8sApi.namespaceStore.context.setSelectedNamespaces([namespace]);
    Renderer.Navigation.navigate("/workloads/pods");
  };
  const filterProducts = (filter: string) => {
    page?.querySelectorAll<HTMLElement>("[data-product-search]").forEach(section => {
      section.hidden = !section.dataset.productSearch?.includes(filter.toLowerCase());
    });
  };
  const toggleHidden = (show: boolean) => {
    page?.querySelectorAll<HTMLElement>("[data-component-hidden='true']").forEach(row => row.hidden = !show);
  };

  return <div className="ProductNavigationPage" ref={element => page = element}>
    <header><h2>Products</h2><span>{cluster || "All clusters"}</span></header>
    <div className="ProductNavigationToolbar">
      <input placeholder="Filter products" onInput={event => filterProducts(event.currentTarget.value)} />
      <label><input type="checkbox" onChange={event => toggleHidden(event.currentTarget.checked)} /> Show hidden</label>
    </div>
    {products.length === 0 && <p>No products are configured for this cluster.</p>}
    {products.map(product => <section key={product.name} data-product-search={`${product.name} ${product.description ?? ""} ${product.components.map(component => component.name).join(" ")}`.toLowerCase()}>
      <h3>{product.name}</h3><p>{product.description}</p>
      <table><thead><tr><th>Component</th><th>Description</th><th>Namespace</th></tr></thead>
        <tbody>{product.components.map(component => component.targets.filter(target => !cluster || target.cluster === cluster).map(target =>
          <tr key={`${component.name}:${target.cluster}:${target.namespace}`} data-component-hidden={String(Boolean(component.hidden))} hidden={component.hidden}><td>{component.name}</td><td>{component.description}</td><td>
            {cluster
              ? <Renderer.Component.Button label={target.namespace} onClick={() => openPods(target.namespace)} />
              : <span>{target.cluster} / {target.namespace}</span>}
          </td></tr>))}</tbody></table>
    </section>)}
    </div>;
}
