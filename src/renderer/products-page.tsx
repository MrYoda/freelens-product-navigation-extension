import React from "react";
import { Renderer } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";
import { navigateToProductTarget } from "./navigation";

export const ProductsIcon = () => <Renderer.Component.Icon material="account_tree" />;

export const ProductsPage = () => {
  const store = getProductNavigationStore();
  const navigation = store.navigation;
  const [filter, setFilter] = React.useState("");
  const [showHidden, setShowHidden] = React.useState(false);
  const [error, setError] = React.useState("");
  const query = filter.trim().toLocaleLowerCase();
  const clustersById = new Map(navigation.clusters.map(cluster => [cluster.id, cluster]));
  const productsById = new Map(navigation.products.map(product => [product.id, product]));
  const isHidden = (serviceId: string, componentId: string) => navigation.hidden.services[serviceId]?.components.includes(componentId) ?? false;
  const setHidden = (serviceId: string, componentId: string, hidden: boolean) => {
    const previous = navigation.hidden.services[serviceId]?.components ?? [];
    const components = hidden ? [...new Set([...previous, componentId])] : previous.filter(id => id !== componentId);
    const services = { ...navigation.hidden.services };
    if (components.length) services[serviceId] = { components }; else delete services[serviceId];
    store.setNavigation({ ...navigation, hidden: { services } });
  };
  const visibleServices = navigation.services.map(service => {
    const product = service.productId ? productsById.get(service.productId) : undefined;
    const components = service.components.filter(component => {
      if (isHidden(service.id, component.id) && !showHidden) return false;
      if (!query) return true;
      const clusterTerms = component.clusters.flatMap(id => [id, clustersById.get(id)?.name]);
      return [service.id, service.name, product?.id, product?.name, component.id, component.name, component.namespace, ...clusterTerms]
        .some(term => term?.toLocaleLowerCase().includes(query));
    });
    return { service, components };
  }).filter(item => item.components.length > 0);
  const count = visibleServices.reduce((sum, item) => sum + item.components.length, 0);

  return <div className="ProductNavigationPage" data-testid="product-navigation-page">
    <header><div><h1>Products</h1><p>Select a cluster to open the component namespace.</p></div>
      <label><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.currentTarget.checked)} /> Show hidden</label>
    </header>
    <input className="ProductNavigationFilter" value={filter} onChange={event => setFilter(event.currentTarget.value)} placeholder="Filter services, components, namespaces, products, or clusters" />
    {error && <p className="ProductNavigationErrors">{error}</p>}
    {count === 0 ? <p>{navigation.services.length === 0 ? "No services configured. Add product navigation JSON in Preferences." : "No components match the current filters."}</p> :
      <table><thead><tr><th>Service</th><th>Component</th><th>Namespace and clusters</th><th>Hidden</th></tr></thead><tbody>
        {visibleServices.flatMap(({ service, components }) => components.map((component, index) => {
          const hidden = isHidden(service.id, component.id);
          return <tr className={hidden ? "is-hidden" : undefined} key={`${service.id}:${component.id}`}>
            {index === 0 && <td rowSpan={components.length}>{service.name}</td>}<td>{component.name}</td><td>
              <div className="ProductNavigationNamespace">{component.namespace}</div><div className="ProductNavigationTargets">
                {component.clusters.map(clusterId => <button key={clusterId} onClick={() => {
                  setError(""); navigateToProductTarget(component, clusterId).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
                }}>{clustersById.get(clusterId)?.name ?? clusterId}</button>)}
              </div></td><td><label><input type="checkbox" checked={hidden} onChange={event => setHidden(service.id, component.id, event.currentTarget.checked)} /> Hide</label></td>
          </tr>;
        }))}
      </tbody></table>}
  </div>;
};
