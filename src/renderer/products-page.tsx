import React, { useMemo, useState } from "react";
import { Renderer } from "@freelensapp/extensions";
import { productsForCluster } from "../common/products";
import { productNavigationStore } from "../common/store";

export function ProductsIcon() {
  return <Renderer.Component.Icon material="apps" />;
}

export function ProductsPage() {
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const cluster = Renderer.K8sApi.clusterContext.getActiveCluster()?.getName() ?? "";
  const products = useMemo(() => productsForCluster(productNavigationStore.get(), cluster, showHidden)
    .filter(product => `${product.name} ${product.description ?? ""} ${product.components.map(c => c.name).join(" ")}`
      .toLowerCase().includes(filter.toLowerCase())), [cluster, filter, showHidden]);

  const openPods = (namespace: string) => {
    Renderer.K8sApi.namespaceStore.context.setSelectedNamespaces([namespace]);
    Renderer.Navigation.navigate("/workloads/pods");
  };

  return <div className="ProductNavigationPage">
    <header><h2>Products</h2><span>{cluster}</span></header>
    <div className="ProductNavigationToolbar">
      <Renderer.Component.Input placeholder="Filter products" value={filter} onChange={setFilter} />
      <label><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.target.checked)} /> Show hidden</label>
    </div>
    {products.length === 0 && <p>No products are configured for this cluster.</p>}
    {products.map(product => <section key={product.name}>
      <h3>{product.name}</h3><p>{product.description}</p>
      <table><thead><tr><th>Component</th><th>Description</th><th>Namespace</th></tr></thead>
        <tbody>{product.components.map(component => component.targets.filter(target => target.cluster === cluster).map(target =>
          <tr key={`${component.name}:${target.namespace}`}><td>{component.name}</td><td>{component.description}</td><td>
            <Renderer.Component.Button label={target.namespace} onClick={() => openPods(target.namespace)} />
          </td></tr>))}</tbody></table>
    </section>)}
  </div>;
}
