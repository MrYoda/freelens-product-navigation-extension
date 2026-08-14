import React from "react";
import { Renderer } from "../common/freelens-api";
import { productsForCluster } from "../common/products";
import { productNavigationStore } from "../common/store";

export function ProductsIcon() {
  return <Renderer.Component.Icon material="apps" />;
}

interface ProductsPageState { filter: string; showHidden: boolean }

export class ProductsPage extends React.Component<Record<string, never>, ProductsPageState> {
  state: ProductsPageState = { filter: "", showHidden: false };

  openPods = (namespace: string) => {
    Renderer.K8sApi.namespaceStore.context.setSelectedNamespaces([namespace]);
    Renderer.Navigation.navigate("/workloads/pods");
  };

  render() {
    const { filter, showHidden } = this.state;
    const cluster = Renderer.K8sApi.clusterContext.getActiveCluster()?.getName() ?? "";
    const products = productsForCluster(productNavigationStore.get(), cluster, showHidden)
      .filter(product => `${product.name} ${product.description ?? ""} ${product.components.map(c => c.name).join(" ")}`
        .toLowerCase().includes(filter.toLowerCase()));

    return <div className="ProductNavigationPage">
    <header><h2>Products</h2><span>{cluster}</span></header>
    <div className="ProductNavigationToolbar">
      <Renderer.Component.Input placeholder="Filter products" value={filter} onChange={value => this.setState({ filter: value })} />
      <label><input type="checkbox" checked={showHidden} onChange={event => this.setState({ showHidden: event.target.checked })} /> Show hidden</label>
    </div>
    {products.length === 0 && <p>No products are configured for this cluster.</p>}
    {products.map(product => <section key={product.name}>
      <h3>{product.name}</h3><p>{product.description}</p>
      <table><thead><tr><th>Component</th><th>Description</th><th>Namespace</th></tr></thead>
        <tbody>{product.components.map(component => component.targets.filter(target => target.cluster === cluster).map(target =>
          <tr key={`${component.name}:${target.namespace}`}><td>{component.name}</td><td>{component.description}</td><td>
            <Renderer.Component.Button label={target.namespace} onClick={() => this.openPods(target.namespace)} />
          </td></tr>))}</tbody></table>
    </section>)}
    </div>;
  }
}
