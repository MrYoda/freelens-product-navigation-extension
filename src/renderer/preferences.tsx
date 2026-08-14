import React from "react";
import { Renderer } from "@freelensapp/extensions";
import { defaultConfig, parseConfig } from "../common/products";
import { productNavigationStore } from "../common/store";

interface PreferencesState { text: string; message: string }

export class Preferences extends React.Component<Record<string, never>, PreferencesState> {
  state: PreferencesState = {
    text: JSON.stringify(productNavigationStore.get() ?? defaultConfig, null, 2),
    message: "",
  };

  apply = () => {
    try {
      productNavigationStore.set(parseConfig(this.state.text));
      this.setState({ message: "Configuration saved" });
    } catch (error) {
      this.setState({ message: error instanceof Error ? error.message : String(error) });
    }
  };

  render() {
    return <div className="ProductNavigationPreferences">
      <Renderer.Component.Input multiline rows={16} value={this.state.text} onChange={text => this.setState({ text })} />
      <div className="ProductNavigationActions">
        <Renderer.Component.Button primary label="Apply" onClick={this.apply} />
        <Renderer.Component.Button label="Reset" onClick={() => this.setState({ text: JSON.stringify(defaultConfig, null, 2) })} />
        <span role="status">{this.state.message}</span>
      </div>
    </div>;
  }
}
