import React from "react";
import { getProductNavigationStore } from "../common/store";
import {
  getSummary,
  parseConfigBlock,
  type ProductNavigationBlock,
  type ProductNavigationBlockUpdate,
  type ProductNavigationPreferences,
  type ProductNavigationUpdateInterval,
} from "../common/products";
import { productNavigationBlocks } from "../common/updates";
import { requestBlockUpdate, subscribeToConfigurationUpdates } from "./updates";

const blockTitles: Record<ProductNavigationBlock, string> = {
  clusters: "Clusters",
  products: "Products",
  services: "Services and components",
  hidden: "Hidden components",
};
const intervalLabels: Record<ProductNavigationUpdateInterval, string> = {
  hour: "Every hour",
  "six-hours": "Every 6 hours",
  day: "Every day",
  week: "Every week",
};
const formatBlock = (navigation: ProductNavigationPreferences, block: ProductNavigationBlock) => JSON.stringify(navigation[block], null, 2);

interface BlockEditorProps {
  block: ProductNavigationBlock;
  navigation: ProductNavigationPreferences;
  onApply: (navigation: ProductNavigationPreferences) => void;
  onUpdateSettings: (settings: ProductNavigationBlockUpdate) => void;
}

const BlockEditor = ({ block, navigation, onApply, onUpdateSettings }: BlockEditorProps) => {
  const storedJson = formatBlock(navigation, block);
  const previousStoredJson = React.useRef(storedJson);
  const [draft, setDraft] = React.useState(storedJson);
  const validation = React.useMemo(() => parseConfigBlock(block, draft, navigation), [block, draft, navigation]);
  const hasChanges = draft !== storedJson;
  const settings = navigation.updates.blocks[block];

  React.useEffect(() => {
    setDraft(current => current === previousStoredJson.current ? storedJson : current);
    previousStoredJson.current = storedJson;
  }, [storedJson]);

  const apply = () => {
    if (!validation.value) return;
    onApply(validation.value);
    setDraft(formatBlock(validation.value, block));
  };
  const status = settings.lastStatus;

  return <section className="ProductNavigationConfigBlock" data-block={block}>
    <h3>{blockTitles[block]}</h3>
    <textarea aria-label={`${blockTitles[block]} JSON`} rows={block === "services" ? 16 : 8} value={draft} onChange={event => setDraft(event.currentTarget.value)} />
    <div className="ProductNavigationActions">
      <button disabled={!hasChanges || validation.errors.length > 0} onClick={apply}>Apply {blockTitles[block]}</button>
      <button disabled={!hasChanges} onClick={() => setDraft(storedJson)}>Reset</button>
      <button onClick={() => navigator.clipboard.writeText(storedJson)}>Copy JSON</button>
    </div>
    {validation.errors.length > 0 && <ul className="ProductNavigationErrors">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <div className="ProductNavigationUpdateSettings">
      <label><input type="checkbox" checked={settings.enabled} onChange={event => onUpdateSettings({ ...settings, enabled: event.currentTarget.checked })} /> Update automatically</label>
      <label className="ProductNavigationUpdateSource">Update URL or local file
        <input value={settings.url} onChange={event => onUpdateSettings({ ...settings, url: event.currentTarget.value })} placeholder="https://…/clusters.json or /path/to/clusters.json" />
      </label>
      {settings.url.trim() && <button type="button" onClick={() => requestBlockUpdate(block)}>Update now</button>}
    </div>
    {status && <p className={`ProductNavigationUpdateStatus ${status.success ? "is-success" : "is-error"}`}>
      Last attempt: {new Date(status.attemptedAt).toLocaleString()} — {status.success ? "Success" : "Failed"}: {status.message}
    </p>}
  </section>;
};

export const Preferences = () => {
  const store = getProductNavigationStore();
  const [, setRevision] = React.useState(0);
  React.useEffect(() => subscribeToConfigurationUpdates(() => setRevision(value => value + 1)), []);
  const navigation = store.navigation;
  const setNavigation = (value: ProductNavigationPreferences) => {
    store.setNavigation(value);
    setRevision(revision => revision + 1);
  };
  const setUpdateSettings = (block: ProductNavigationBlock, settings: ProductNavigationBlockUpdate) => setNavigation({
    ...navigation,
    updates: { ...navigation.updates, blocks: { ...navigation.updates.blocks, [block]: settings } },
  });

  if (!store.loaded) return <p>Loading product navigation settings…</p>;

  return <div className="ProductNavigationPreferences">
    <div className="ProductNavigationUpdateInterval">
      <label>Automatic update interval <select value={navigation.updates.interval} onChange={event => setNavigation({
        ...navigation,
        updates: { ...navigation.updates, interval: event.currentTarget.value as ProductNavigationUpdateInterval },
      })}>{Object.entries(intervalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <p>Enabled sources are checked every five minutes and refreshed when this interval has elapsed since their last attempt.</p>
    </div>
    {productNavigationBlocks.map(block => <BlockEditor key={block} block={block} navigation={navigation}
      onApply={setNavigation} onUpdateSettings={settings => setUpdateSettings(block, settings)} />)}
    <div className="ProductNavigationPreview"><strong>Current configuration:</strong> {getSummary(navigation)}</div>
  </div>;
};
