import React from "react";
import { Renderer } from "../common/freelens-api";
import { defaultConfig, parseConfig } from "../common/products";
import { productNavigationStore } from "../common/store";

export function Preferences() {
  let editor: HTMLTextAreaElement | null = null;
  let status: HTMLSpanElement | null = null;
  const apply = () => {
    try {
      productNavigationStore.set(parseConfig(editor?.value ?? ""));
      if (status) status.textContent = "Configuration saved";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    }
  };

  return <div className="ProductNavigationPreferences">
      <textarea rows={16} defaultValue={JSON.stringify(productNavigationStore.get() ?? defaultConfig, null, 2)} ref={element => editor = element} />
      <div className="ProductNavigationActions">
        <Renderer.Component.Button primary label="Apply" onClick={apply} />
        <Renderer.Component.Button label="Reset" onClick={() => { if (editor) editor.value = JSON.stringify(defaultConfig, null, 2); }} />
        <span role="status" ref={element => status = element} />
      </div>
    </div>;
}
