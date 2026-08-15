import React from "react";
import { getProductNavigationStore } from "../common/store";
import { getSummary, parseConfig, type ProductNavigationPreferences } from "../common/products";

const format = (value: ProductNavigationPreferences) => JSON.stringify(value, null, 2);

export const Preferences = () => {
  const store = getProductNavigationStore();
  const storedJson = format(store.navigation);
  const [draft, setDraft] = React.useState(storedJson);
  const validation = React.useMemo(() => parseConfig(draft), [draft]);
  const hasChanges = draft !== storedJson;

  React.useEffect(() => { if (!hasChanges) setDraft(storedJson); }, [hasChanges, storedJson]);
  const apply = () => {
    if (!validation.value) return;
    store.setNavigation(validation.value);
    setDraft(format(validation.value));
  };

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
        {service.components.map(component => <li key={component.id}>{component.name} ({component.namespace}, {component.clusters.length} clusters)</li>)}
      </ul></li>)}</ul>
    </div>}
  </div>;
};
