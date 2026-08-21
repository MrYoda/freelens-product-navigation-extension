import React from "react";
import { Renderer } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";
import { navigateToProductTarget } from "./navigation";
import { componentMatchesText, componentMatchesTokens, getSearchTokens, searchEntityDetails, suggestSearchTokens, type SearchToken } from "../common/search";
import { expandButtonUrl, type ProductNavigationButtonEntity } from "../common/products";

export const ProductsIcon = () => <Renderer.Component.Icon material="account_tree" />;

const CustomButtons = ({ entity, values }: { entity: ProductNavigationButtonEntity; values: Record<string, string> }) => {
  const buttons = getProductNavigationStore().navigation.customButtons.filter(button => button.entity === entity);
  if (!buttons.length) return null;
  return <span className="ProductNavigationCustomButtons">{buttons.map(button => <button type="button" className="ProductNavigationCustomButton" key={button.id} title={button.hint}
    aria-label={button.hint || `Open ${button.id}`} onClick={() => window.open(expandButtonUrl(button.url, values), "_blank", "noopener,noreferrer")}>
    <Renderer.Component.Icon material={button.icon} />
  </button>)}</span>;
};

const pageState: { filter: string; selected: SearchToken[]; showHidden: boolean; scrollTop: number } = { filter: "", selected: [], showHidden: false, scrollTop: 0 };
export const ProductsPage = () => {
  const store = getProductNavigationStore();
  const navigation = store.navigation;
  const page = React.useRef<HTMLDivElement>(null);
  const [filter, setFilterState] = React.useState(pageState.filter);
  const [selected, setSelectedState] = React.useState(pageState.selected);
  const [activeSuggestion, setActiveSuggestion] = React.useState(0);
  const [focused, setFocused] = React.useState(false);
  const [showHidden, setShowHiddenState] = React.useState(pageState.showHidden);
  const setFilter = (value: string) => { pageState.filter = value; setFilterState(value); };
  const setSelected = (value: SearchToken[]) => { pageState.selected = value; setSelectedState(value); };
  const setShowHidden = (value: boolean) => { pageState.showHidden = value; setShowHiddenState(value); };
  React.useLayoutEffect(() => { if (page.current) page.current.scrollTop = pageState.scrollTop; }, []);
  const clustersById = new Map(navigation.clusters.map(cluster => [cluster.id, cluster]));
  const suggestions = suggestSearchTokens(getSearchTokens(navigation), filter, selected);
  const showSuggestions = focused && suggestions.length > 0;
  const selectSuggestion = (token: SearchToken) => {
    setSelected([...selected, token]);
    setFilter("");
    setActiveSuggestion(0);
  };
  const isHidden = (serviceId: string, componentId: string) => navigation.hidden.services[serviceId]?.components.includes(componentId) ?? false;
  const setHidden = (serviceId: string, componentId: string, hidden: boolean) => {
    const previous = navigation.hidden.services[serviceId]?.components ?? [];
    const components = hidden ? [...new Set([...previous, componentId])] : previous.filter(id => id !== componentId);
    const services = { ...navigation.hidden.services };
    if (components.length) services[serviceId] = { components }; else delete services[serviceId];
    store.setNavigation({ ...navigation, hidden: { services } });
  };
  const visibleServices = navigation.services.map(service => {
    const components = service.components.filter(component => {
      if (isHidden(service.id, component.id) && !showHidden) return false;
      return componentMatchesTokens(service, component, selected)
        && componentMatchesText(navigation, service, component, filter);
    });
    return { service, components };
  }).filter(item => item.components.length > 0);
  const count = visibleServices.reduce((sum, item) => sum + item.components.length, 0);

  if (!store.loaded) return <div className="ProductNavigationPage" data-testid="product-navigation-page"><p>Loading product navigation settings…</p></div>;

  return <div className="ProductNavigationPage" data-testid="product-navigation-page" ref={page} onScroll={event => { pageState.scrollTop = event.currentTarget.scrollTop; }}>
    <header><div><h1>Products</h1><p>Select a cluster to open the component namespace.</p></div>
      <label><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.currentTarget.checked)} /> Show hidden</label>
    </header>
    <div className="ProductNavigationSearch" onFocus={() => setFocused(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
    }}>
      <div className="ProductNavigationFilter" onClick={event => event.currentTarget.querySelector("input")?.focus()}>
        {selected.map(token => <span className={`ProductNavigationChip is-${token.type}`} key={`${token.type}:${token.value}`}>
          <Renderer.Component.Icon material={searchEntityDetails[token.type].icon} />
          <span><span className="ProductNavigationChipType">{searchEntityDetails[token.type].label}:</span> {token.label}</span>
          <button type="button" aria-label={`Remove ${searchEntityDetails[token.type].label} ${token.label}`} onClick={() => setSelected(selected.filter(candidate => candidate !== token))}>×</button>
        </span>)}
        <input role="combobox" aria-label="Filter products" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls="product-navigation-suggestions"
          aria-activedescendant={showSuggestions ? `product-navigation-suggestion-${activeSuggestion}` : undefined}
          value={filter} onChange={event => { setFilter(event.currentTarget.value); setActiveSuggestion(0); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setActiveSuggestion((activeSuggestion + 1) % suggestions.length); }
            if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActiveSuggestion((activeSuggestion - 1 + suggestions.length) % suggestions.length); }
            if (event.key === "Enter" && showSuggestions) { event.preventDefault(); selectSuggestion(suggestions[activeSuggestion]); }
            if (event.key === "Escape") setFocused(false);
            if (event.key === "Backspace" && !filter && selected.length) setSelected(selected.slice(0, -1));
          }} placeholder={selected.length ? "Add another filter…" : "Filter or add services, components, namespaces, or clusters…"} />
      </div>
      {showSuggestions && <div className="ProductNavigationSuggestions" id="product-navigation-suggestions" role="listbox">
        {suggestions.map((token, index) => <button type="button" role="option" aria-selected={index === activeSuggestion}
          className={`ProductNavigationSuggestion is-${token.type}${index === activeSuggestion ? " is-active" : ""}`}
          id={`product-navigation-suggestion-${index}`} key={`${token.type}:${token.value}`}
          onMouseDown={event => event.preventDefault()} onClick={() => selectSuggestion(token)}>
          <Renderer.Component.Icon material={searchEntityDetails[token.type].icon} />
          <span className="ProductNavigationSuggestionLabel">{token.label}</span><span>{searchEntityDetails[token.type].label}</span>
        </button>)}
      </div>}
    </div>
    {count === 0 ? <p>{navigation.services.length === 0 ? "No services configured. Add product navigation JSON in Preferences." : "No components match the current filters."}</p> :
      <table><thead><tr><th>Service</th><th>Component</th><th>Namespace and clusters</th><th>Hidden</th></tr></thead><tbody>
        {visibleServices.flatMap(({ service, components }) => components.map((component, index) => {
          const hidden = isHidden(service.id, component.id);
          return <tr className={hidden ? "is-hidden" : undefined} key={`${service.id}:${component.id}`}>
            {index === 0 && <td rowSpan={components.length}>{service.name}<CustomButtons entity="service" values={{ serviceId: service.id, serviceName: service.name }} /></td>}<td>{component.name}<CustomButtons entity="component" values={{ serviceId: service.id, serviceName: service.name, componentId: component.id, componentName: component.name }} /></td><td>
              {component.targets.map(target => <div className="ProductNavigationNamespaceTarget" key={target.namespace}>
                <div className="ProductNavigationNamespace">{target.namespace}</div><div className="ProductNavigationTargets">
                  {target.clusters.map(clusterId => { const clusterName = clustersById.get(clusterId)?.name ?? clusterId; const values = { serviceId: service.id, serviceName: service.name, componentId: component.id, componentName: component.name, namespace: target.namespace, clusterId, clusterName, clusterShortId: clusterId.split(".", 1)[0] }; const hasActions = navigation.customButtons.some(button => button.entity === "target"); return <span className={`ProductNavigationTargetGroup${hasActions ? " has-actions" : ""}`} key={clusterId}>
                    <Renderer.Component.Button aria-label={`Open ${component.name} in ${target.namespace} on ${clusterName}`} className="ProductNavigationTarget" label={clusterName} primary onClick={() => {
                      navigateToProductTarget(target.namespace, clusterId).catch(reason => Renderer.Component.Notifications.error(reason instanceof Error ? reason.message : String(reason)));
                    }} />
                    {hasActions && <details className="ProductNavigationTargetMenu"><summary aria-label={`Actions for ${clusterName}`}>▾</summary><div><CustomButtons entity="target" values={values} /></div></details>}
                  </span>; })}
                </div>
              </div>)}</td><td><label><input type="checkbox" checked={hidden} onChange={event => setHidden(service.id, component.id, event.currentTarget.checked)} /> Hide</label></td>
          </tr>;
        }))}
      </tbody></table>}
  </div>;
};
