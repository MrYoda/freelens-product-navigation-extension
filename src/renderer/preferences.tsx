import React, { useState } from "react";
import { Renderer } from "@freelensapp/extensions";
import { defaultConfig, parseConfig } from "../common/products";
import { productNavigationStore } from "../common/store";

export function Preferences() {
  const [text, setText] = useState(() => JSON.stringify(productNavigationStore.get() ?? defaultConfig, null, 2));
  const [message, setMessage] = useState("");
  const apply = () => {
    try {
      productNavigationStore.set(parseConfig(text));
      setMessage("Configuration saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  return <div className="ProductNavigationPreferences">
    <Renderer.Component.Input multiline rows={16} value={text} onChange={setText} />
    <div className="ProductNavigationActions">
      <Renderer.Component.Button primary label="Apply" onClick={apply} />
      <Renderer.Component.Button label="Reset" onClick={() => setText(JSON.stringify(defaultConfig, null, 2))} />
      <span role="status">{message}</span>
    </div>
  </div>;
}
