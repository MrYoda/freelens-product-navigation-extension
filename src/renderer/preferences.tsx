import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { Renderer } from "@freelensapp/extensions";
import { getProductNavigationStore } from "../common/store";
import {
  buttonMacros, copyPreferences, getSummary, parseConfig, type ProductNavigationBlock, type ProductNavigationButtonEntity,
  type ProductNavigationCustomButton, type ProductNavigationPreferences, type ProductNavigationUpdateInterval,
} from "../common/products";
import { productNavigationBlocks } from "../common/updates";
import { requestBlockUpdate, subscribeToConfigurationUpdates } from "./updates";
import { materialIcons } from "./material-icons";

const blockTitles: Record<ProductNavigationBlock, string> = { clusters: "Clusters", products: "Products", services: "Services and components", hidden: "Hidden components" };
const intervalLabels: Record<ProductNavigationUpdateInterval, string> = { never: "Never", hour: "Every hour", "six-hours": "Every 6 hours", day: "Every day", week: "Every week" };
const snapshot = (navigation: ProductNavigationPreferences) => JSON.stringify(navigation);
// Keep the named React exports required by the bundled editor in the Freelens
// global external facade.
void [forwardRef, useCallback, useImperativeHandle, useRef, useState];

const JsonEditor = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <div className="ProductNavigationJsonEditor" aria-label={label}>
  <Editor value={value} onValueChange={onChange} highlight={code => Prism.highlight(code, Prism.languages.json, "json")} padding={12} />
</div>;

const IconPicker = ({ value, onChange }: { value: string; onChange: (icon: string) => void }) => {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  return <div className="ProductNavigationIconPicker" ref={root}><span>Material icon</span>
    <button type="button" className="ProductNavigationIconPickerButton" aria-expanded={open} onClick={() => setOpen(!open)}><Renderer.Component.Icon material={value || "link"} /><span>{value || "Choose icon"}</span><Renderer.Component.Icon material="arrow_drop_down" /></button>
    {open && <div className="ProductNavigationIconGrid" role="listbox">{materialIcons.map(icon => <button type="button" role="option" aria-selected={icon === value} aria-label={icon} title={icon} key={icon} onClick={() => { onChange(icon); setOpen(false); }}><Renderer.Component.Icon material={icon} /></button>)}</div>}
  </div>;
};

const ButtonEditor = ({ button, onChange, onRemove }: { button: ProductNavigationCustomButton; onChange: (value: ProductNavigationCustomButton) => void; onRemove: () => void }) =>
  <div className="ProductNavigationButtonEditor">
    <label>Entity<select value={button.entity} onChange={event => onChange({ ...button, entity: event.currentTarget.value as ProductNavigationButtonEntity })}>
      <option value="service">Service</option><option value="component">Component</option><option value="target">Target</option>
    </select></label>
    <IconPicker value={button.icon} onChange={icon => onChange({ ...button, icon })} />
    <label>Action<select value={button.action} onChange={() => onChange({ ...button, action: "link" })}><option value="link">Open link</option></select></label>
    <label>Hint<input value={button.hint ?? ""} onChange={event => onChange({ ...button, hint: event.currentTarget.value })} /></label>
    <label className="ProductNavigationButtonUrl">Link template<textarea rows={4} wrap="soft" required value={button.url} onChange={event => onChange({ ...button, url: event.currentTarget.value })} placeholder="https://example.test/{serviceId}" />
      <small>Macros: {buttonMacros[button.entity].map(value => `{${value}}`).join(", ")}</small></label>
    <span className="ProductNavigationIconPreview"><Renderer.Component.Icon material={button.icon || "link"} /></span>
    <button type="button" className="ProductNavigationButton" onClick={onRemove}>Remove</button>
  </div>;

export const Preferences = () => {
  const store = getProductNavigationStore();
  const [, render] = React.useState(0);
  const [tab, setTab] = React.useState<"json" | "updates" | "buttons">("json");
  // ExtensionStore values are deeply observable MobX proxies in Freelens.
  // structuredClone cannot clone proxies, while the persisted model is JSON by definition.
  const [draft, setDraft] = React.useState<ProductNavigationPreferences>(() => copyPreferences(store.navigation));
  const [json, setJson] = React.useState<Record<ProductNavigationBlock, string>>(() => Object.fromEntries(productNavigationBlocks.map(block => [block, JSON.stringify(store.navigation[block], null, 2)])) as Record<ProductNavigationBlock, string>);
  React.useEffect(() => subscribeToConfigurationUpdates(() => { setDraft(copyPreferences(store.navigation)); render(value => value + 1); }), []);
  if (!store.loaded) return <p>Loading product navigation settings…</p>;

  let validation: ReturnType<typeof parseConfig> = { errors: [] };
  try {
    const blocks = Object.fromEntries(productNavigationBlocks.map(block => [block, JSON.parse(json[block])])) as Pick<ProductNavigationPreferences, ProductNavigationBlock>;
    validation = parseConfig(JSON.stringify({ ...draft, ...blocks }));
  } catch (error) { validation = { errors: [error instanceof Error ? error.message : "Invalid JSON"] }; }
  const buttonsValid = draft.customButtons.every(button => button.icon.trim() && button.url.trim());
  const changed = snapshot(draft) !== snapshot(store.navigation) || productNavigationBlocks.some(block => json[block] !== JSON.stringify(store.navigation[block], null, 2));
  const apply = () => { if (validation.value && buttonsValid) { const value = { ...validation.value, customButtons: draft.customButtons, openProductsOnStartup: draft.openProductsOnStartup, updates: draft.updates }; store.setNavigation(value); setDraft(copyPreferences(value)); render(value => value + 1); } };

  return <div className="ProductNavigationPreferences">
    <div className="ProductNavigationPrimaryActions"><button className="ProductNavigationButton is-primary" disabled={!changed || !validation.value || !buttonsValid} onClick={apply}>Apply</button>
      <span>{getSummary(store.navigation)}</span></div>
    <nav className="ProductNavigationTabs" aria-label="Product navigation settings">
      <button className={tab === "json" ? "is-active" : ""} onClick={() => setTab("json")}>Configuration JSON</button>
      <button className={tab === "updates" ? "is-active" : ""} onClick={() => setTab("updates")}>Automatic updates</button>
      <button className={tab === "buttons" ? "is-active" : ""} onClick={() => setTab("buttons")}>Custom link buttons</button>
    </nav>
    {tab === "json" && <div>{productNavigationBlocks.map(block => <section className="ProductNavigationConfigBlock" data-block={block} key={block}><h3>{blockTitles[block]}</h3>
      <JsonEditor label={`${blockTitles[block]} JSON`} value={json[block]} onChange={value => setJson({ ...json, [block]: value })} />
      <div className="ProductNavigationActions"><button className="ProductNavigationButton" onClick={() => setJson({ ...json, [block]: JSON.stringify(store.navigation[block], null, 2) })}>Reset</button>
        <button className="ProductNavigationButton" onClick={() => navigator.clipboard.writeText(json[block])}>Copy JSON</button></div></section>)}
      {validation.errors.length > 0 && <ul className="ProductNavigationErrors">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}</div>}
    {tab === "updates" && <div className="ProductNavigationSettingsPanel"><div className="ProductNavigationUpdateInterval"><label>Automatic update interval <select value={draft.updates.interval} onChange={event => setDraft({ ...draft, updates: { ...draft.updates, interval: event.currentTarget.value as ProductNavigationUpdateInterval } })}>{Object.entries(intervalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {draft.updates.interval === "never" ? <p>Automatic updates are disabled.</p> : productNavigationBlocks.map(block => { const settings = draft.updates.blocks[block]; return <section className="ProductNavigationConfigBlock" data-block={block} key={block}><h3>{blockTitles[block]}</h3><div className="ProductNavigationUpdateSettings">
        <label className="ProductNavigationSwitch"><input type="checkbox" checked={settings.enabled} onChange={event => setDraft({ ...draft, updates: { ...draft.updates, blocks: { ...draft.updates.blocks, [block]: { ...settings, enabled: event.currentTarget.checked } } } })} /><span /> Update automatically</label>
        <label className="ProductNavigationUpdateSource">Update URL or local file<input value={settings.url} onChange={event => setDraft({ ...draft, updates: { ...draft.updates, blocks: { ...draft.updates.blocks, [block]: { ...settings, url: event.currentTarget.value } } } })} /></label>
        <button className="ProductNavigationButton" disabled={!settings.url.trim()} onClick={() => requestBlockUpdate(block)}>Update now</button></div>
        {settings.lastStatus && <p className={`ProductNavigationUpdateStatus ${settings.lastStatus.success ? "is-success" : "is-error"}`}>Last attempt: {new Date(settings.lastStatus.attemptedAt).toLocaleString()} — {settings.lastStatus.success ? "Success" : "Failed"}: {settings.lastStatus.message}</p>}</section>; })}</div>}
    {tab === "buttons" && <div className="ProductNavigationSettingsPanel"><label className="ProductNavigationSwitch"><input type="checkbox" checked={draft.openProductsOnStartup} onChange={event => setDraft({ ...draft, openProductsOnStartup: event.currentTarget.checked })} /><span /> Open Products when Freelens starts</label>
      {draft.customButtons.map((button, index) => <ButtonEditor key={button.id} button={button} onChange={value => setDraft({ ...draft, customButtons: draft.customButtons.map((candidate, i) => i === index ? value : candidate) })} onRemove={() => setDraft({ ...draft, customButtons: draft.customButtons.filter((_, i) => i !== index) })} />)}
      <button className="ProductNavigationButton" onClick={() => setDraft({ ...draft, customButtons: [...draft.customButtons, { id: `button-${Date.now()}`, entity: "service", icon: "open_in_new", action: "link", url: "" }] })}>Add button</button>
      {!buttonsValid && <p className="ProductNavigationErrors">Every button requires an icon and link template.</p>}</div>}
  </div>;
};
