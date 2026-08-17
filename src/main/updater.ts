import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ProductNavigationBlock, ProductNavigationPreferences } from "../common/products.ts";
import { parseConfigBlock } from "../common/products.ts";
import { productNavigationBlocks, shouldUpdateBlock } from "../common/updates.ts";
import type { ProductNavigationStore } from "../common/store";

const CHECK_INTERVAL = 5 * 60 * 1_000;

export const readUpdateSource = async (source: string): Promise<string> => {
  const trimmed = source.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.text();
  }
  return readFile(trimmed.startsWith("file:") ? fileURLToPath(trimmed) : trimmed, "utf8");
};

const statusNavigation = (
  navigation: ProductNavigationPreferences,
  block: ProductNavigationBlock,
  success: boolean,
  message: string,
): ProductNavigationPreferences => ({
  ...navigation,
  updates: {
    ...navigation.updates,
    blocks: {
      ...navigation.updates.blocks,
      [block]: {
        ...navigation.updates.blocks[block],
        lastStatus: { attemptedAt: new Date().toISOString(), success, message },
      },
    },
  },
});

export class ProductNavigationUpdater {
  private timer?: ReturnType<typeof setInterval>;
  private running = new Set<ProductNavigationBlock>();
  private readonly store: ProductNavigationStore;
  private readonly onChange: (navigation: ProductNavigationPreferences) => void;

  constructor(
    store: ProductNavigationStore,
    onChange: (navigation: ProductNavigationPreferences) => void,
  ) { this.store = store; this.onChange = onChange; }

  start(): void {
    this.timer = setInterval(() => void this.updateDueBlocks(), CHECK_INTERVAL);
    this.timer.unref?.();
    void this.updateDueBlocks();
    setTimeout(() => void this.updateDueBlocks(), 1_000).unref?.();
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }

  async updateDueBlocks(): Promise<void> {
    if (!this.store.loaded) return;
    for (const block of productNavigationBlocks) {
      if (shouldUpdateBlock(this.store.navigation, block)) await this.updateBlock(block);
    }
  }

  async updateBlock(block: ProductNavigationBlock): Promise<void> {
    if (this.running.has(block)) return;
    this.running.add(block);
    try {
      const current = this.store.navigation;
      const source = current.updates.blocks[block].url;
      if (!source.trim()) throw new Error("No update URL or local path configured");
      const json = await readUpdateSource(source);
      const parsed = parseConfigBlock(block, json, current);
      if (!parsed.value) throw new Error(parsed.errors.join("; "));
      const next = statusNavigation(parsed.value, block, true, `Updated from ${source}`);
      this.store.setNavigation(next);
      this.onChange(next);
    } catch (error) {
      const next = statusNavigation(this.store.navigation, block, false, error instanceof Error ? error.message : String(error));
      this.store.setNavigation(next);
      this.onChange(next);
    } finally {
      this.running.delete(block);
    }
  }
}
