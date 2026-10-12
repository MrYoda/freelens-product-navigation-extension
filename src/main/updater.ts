import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ProductNavigationBlock, ProductNavigationPreferences } from "../common/products.ts";
import { copyPreferences, parseConfigBlock } from "../common/products.ts";
import {
  productNavigationBlocks, shouldUpdateBlock, summarizeNavigationChanges,
  type ProductNavigationAutomaticUpdateReport, type ProductNavigationUpdateFailure,
} from "../common/updates.ts";
import type { ProductNavigationStore } from "../common/store";
import { getProxyRouteDiagnostics } from "./network-diagnostics.ts";

const CHECK_INTERVAL = 5 * 60 * 1_000;
// Diagnostic default: honor the resolved system route without silently bypassing it.
// Change only this flag to true to restore the tested direct retry workaround.
const ENABLE_DIRECT_PROXY_FALLBACK = false;

type FetchUpdateSource = (url: string) => Promise<Response>;
interface UpdateFetchResult { response: Response; diagnostics: string }
interface UpdateSourceResult { content: string; diagnostics?: string }

interface ElectronFetchers {
  system: FetchUpdateSource;
  direct: FetchUpdateSource;
  diagnostics: (url: string) => Promise<string>;
}

let electronFetchers: Promise<ElectronFetchers> | undefined;

const getElectronFetchers = () => electronFetchers ??= import("electron").then(async ({ session }) => {
  // Freelens 1.10.3 rewrites defaultSession proxy settings by feeding the PAC-style
  // result of resolveProxy() into fixed-server proxyRules. Keep extension downloads
  // isolated from that global session so DIRECT is not interpreted as a proxy host.
  const systemSession = session.fromPartition("product-navigation-update-system");
  const directSession = session.fromPartition("product-navigation-update-direct");
  await Promise.all([systemSession.setProxy({ mode: "system" }), directSession.setProxy({ mode: "direct" })]);
  return {
    system: url => systemSession.fetch(url),
    direct: url => directSession.fetch(url),
    diagnostics: url => getProxyRouteDiagnostics(
      () => session.defaultSession.resolveProxy(url),
      () => systemSession.resolveProxy(url),
    ),
  };
});

export const fetchWithProxyFallback = async (
  url: string,
  systemFetch: FetchUpdateSource,
  directFetch: FetchUpdateSource,
): Promise<Response> => {
  try {
    return await systemFetch(url);
  } catch (error) {
    const message = formatUpdateError(error);
    if (!message.includes("ERR_PROXY_CONNECTION_FAILED")) throw error;
    try {
      return await directFetch(url);
    } catch (directError) {
      throw new Error(`${message}; direct connection fallback failed`, { cause: directError });
    }
  }
};

const electronFetch = async (url: string): Promise<UpdateFetchResult> => {
  const fetchers = await getElectronFetchers();
  const diagnostics = await fetchers.diagnostics(url);
  console.info(`[Product Navigation] ${diagnostics}`);
  try {
    const response = await (ENABLE_DIRECT_PROXY_FALLBACK
      ? fetchWithProxyFallback(url, fetchers.system, fetchers.direct)
      : fetchers.system(url));
    return { response, diagnostics };
  } catch (error) {
    throw new Error(diagnostics, { cause: error });
  }
};

export const formatUpdateError = (error: unknown): string => {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = "code" in current && typeof current.code === "string" ? ` (${current.code})` : "";
      if (current.message) parts.push(`${current.message}${code}`);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return [...new Set(parts)].join(": ") || "Unknown update error";
};

const readUpdateSourceResult = async (source: string, fetchSource?: FetchUpdateSource): Promise<UpdateSourceResult> => {
  const trimmed = source.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const fetched = fetchSource
      ? { response: await fetchSource(trimmed), diagnostics: undefined }
      : await electronFetch(trimmed);
    const { response } = fetched;
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}${fetched.diagnostics ? `; ${fetched.diagnostics}` : ""}`);
    return { content: await response.text(), diagnostics: fetched.diagnostics };
  }
  return { content: await readFile(trimmed.startsWith("file:") ? fileURLToPath(trimmed) : trimmed, "utf8") };
};

export const readUpdateSource = async (source: string, fetchSource?: FetchUpdateSource): Promise<string> => (
  await readUpdateSourceResult(source, fetchSource)
).content;

export const formatUpdatedFrom = (source: string, diagnostics?: string) => (
  `Updated from ${source}${diagnostics ? `; ${diagnostics}` : ""}`
);

const statusNavigation = (
  navigation: ProductNavigationPreferences,
  block: ProductNavigationBlock,
  success: boolean,
  message: string,
  source?: string,
): ProductNavigationPreferences => ({
  ...navigation,
  updates: {
    ...navigation.updates,
    blocks: {
      ...navigation.updates.blocks,
      [block]: {
        ...navigation.updates.blocks[block],
        ...(source === undefined ? {} : { url: source }),
        lastStatus: { attemptedAt: new Date().toISOString(), success, message },
      },
    },
  },
});

export class ProductNavigationUpdater {
  private timer?: ReturnType<typeof setInterval>;
  private updatingDue = false;
  private running = new Set<ProductNavigationBlock>();
  private readonly store: ProductNavigationStore;
  private readonly onChange: (navigation: ProductNavigationPreferences) => void;
  private readonly onAutomaticUpdate: (report: ProductNavigationAutomaticUpdateReport) => void;

  constructor(
    store: ProductNavigationStore,
    onChange: (navigation: ProductNavigationPreferences) => void,
    onAutomaticUpdate: (report: ProductNavigationAutomaticUpdateReport) => void = () => undefined,
  ) { this.store = store; this.onChange = onChange; this.onAutomaticUpdate = onAutomaticUpdate; }

  start(): void {
    this.timer = setInterval(() => void this.updateDueBlocks(), CHECK_INTERVAL);
    this.timer.unref?.();
    void this.updateDueBlocks();
    setTimeout(() => void this.updateDueBlocks(), 1_000).unref?.();
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }

  async updateDueBlocks(): Promise<void> {
    if (!this.store.loaded || this.updatingDue) return;
    const due = productNavigationBlocks.filter(block => !this.running.has(block) && shouldUpdateBlock(this.store.navigation, block));
    if (due.length === 0) return;
    this.updatingDue = true;
    const before = copyPreferences(this.store.navigation);
    const failures: ProductNavigationUpdateFailure[] = [];
    try {
      for (const block of due) {
        const source = this.store.navigation.updates.blocks[block].url;
        const result = await this.updateBlock(block);
        if (!result.success) failures.push({ block, source, message: result.message });
      }
      this.onAutomaticUpdate({
        failures,
        changes: summarizeNavigationChanges(before, this.store.navigation),
        notifications: { ...this.store.navigation.updates.notifications },
      });
    } finally {
      this.updatingDue = false;
    }
  }

  async updateBlock(block: ProductNavigationBlock, requestedSource?: string): Promise<{ success: boolean; message: string }> {
    if (this.running.has(block)) return { success: false, message: "Update already in progress" };
    this.running.add(block);
    try {
      const current = this.store.navigation;
      const source = requestedSource ?? current.updates.blocks[block].url;
      if (!source.trim()) throw new Error("No update URL or local path configured");
      const loaded = await readUpdateSourceResult(source);
      const parsed = parseConfigBlock(block, loaded.content, current);
      if (!parsed.value) throw new Error(`${parsed.errors.join("; ")}${loaded.diagnostics ? `; ${loaded.diagnostics}` : ""}`);
      const message = formatUpdatedFrom(source, loaded.diagnostics);
      const next = statusNavigation(parsed.value, block, true, message, requestedSource?.trim());
      this.store.setNavigation(next);
      this.onChange(next);
      return { success: true, message };
    } catch (error) {
      const message = formatUpdateError(error);
      const next = statusNavigation(this.store.navigation, block, false, message, requestedSource?.trim());
      this.store.setNavigation(next);
      this.onChange(next);
      return { success: false, message };
    } finally {
      this.running.delete(block);
    }
  }
}
