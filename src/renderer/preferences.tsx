import React from "react";
import { getProductNavigationStore } from "../common/store";
import { getSummary, parseConfig, type ProductNavigationPreferences } from "../common/products";

const format = (value: ProductNavigationPreferences) => JSON.stringify(value, null, 2);

export const Preferences = () => {
  const store = getProductNavigationStore();
  const storedJson = format(store.navigation);
  const previousStoredJson = React.useRef(storedJson);
  const [draft, setDraft] = React.useState<string>();
  const validation = React.useMemo(() => draft === undefined ? { errors: [] } : parseConfig(draft), [draft]);
  const hasChanges = draft !== undefined && draft !== storedJson;

  React.useEffect(() => {
    if (!store.loaded) return;
    setDraft(current => current === undefined || current === previousStoredJson.current ? storedJson : current);
    previousStoredJson.current = storedJson;
  }, [store.loaded, storedJson]);
  const apply = () => {
    if (!validation.value) return;
    store.setNavigation(validation.value);
    setDraft(format(validation.value));
  };

  if (!store.loaded || draft === undefined) return <p>Loading product navigation settings…</p>;

  return <div className="ProductNavigationPreferences">
    <textarea rows={20} value={draft} onChange={event => setDraft(event.currentTarget.value)} />
    <div className="ProductNavigationActions">
      <button disabled={!hasChanges || validation.errors.length > 0} onClick={apply}>Apply</button>
      <button disabled={!hasChanges} onClick={() => setDraft(storedJson)}>Reset</button>
      <button onClick={() => navigator.clipboard.writeText(storedJson)}>Copy JSON</button>
    </div>
    {validation.errors.length > 0 && <ul className="ProductNavigationErrors">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    {validation.value && <div className="ProductNavigationPreview">
      <strong>Preview:</strong> {getSummary(validation.value)}
      <ul>{validation.value.services.map(service => <li key={service.id}>{service.name}<ul>
        {service.components.map(component => <li key={component.id}>{component.name} ({component.targets.length} namespaces, {component.targets.reduce((total, target) => total + target.clusters.length, 0)} targets)</li>)}
      </ul></li>)}</ul>
    </div>}
  </div>;
};
