import type { ProductNavigationBlock, ProductNavigationPreferences, ProductNavigationUpdateInterval } from "./products";

export interface ProductNavigationChangeCount { added: number; removed: number }
export interface ProductNavigationUpdateFailure { block: ProductNavigationBlock; source: string; message: string }
export interface ProductNavigationAutomaticUpdateReport {
  failures: ProductNavigationUpdateFailure[];
  changes: {
    clusters: ProductNavigationChangeCount;
    services: ProductNavigationChangeCount;
    components: ProductNavigationChangeCount;
  };
  notifications: { failures: boolean; successes: boolean };
}
export interface ProductNavigationUpdateNotification { success: boolean; message: string }

export const productNavigationBlocks: ProductNavigationBlock[] = ["clusters", "products", "services", "hidden"];

export const updateIntervalMilliseconds: Record<ProductNavigationUpdateInterval, number> = {
  never: Number.POSITIVE_INFINITY,
  hour: 60 * 60 * 1_000,
  "six-hours": 6 * 60 * 60 * 1_000,
  day: 24 * 60 * 60 * 1_000,
  week: 7 * 24 * 60 * 60 * 1_000,
};

export const shouldUpdateBlock = (
  navigation: ProductNavigationPreferences,
  block: ProductNavigationBlock,
  now = Date.now(),
): boolean => {
  if (navigation.updates.interval === "never") return false;
  const settings = navigation.updates.blocks[block];
  if (!settings.enabled || !settings.url.trim()) return false;
  const attemptedAt = settings.lastStatus && Date.parse(settings.lastStatus.attemptedAt);
  return !attemptedAt || Number.isNaN(attemptedAt)
    || now - attemptedAt >= updateIntervalMilliseconds[navigation.updates.interval];
};

const countSetChanges = (before: Set<string>, after: Set<string>): ProductNavigationChangeCount => ({
  added: [...after].filter(value => !before.has(value)).length,
  removed: [...before].filter(value => !after.has(value)).length,
});

export const summarizeNavigationChanges = (
  before: ProductNavigationPreferences,
  after: ProductNavigationPreferences,
): ProductNavigationAutomaticUpdateReport["changes"] => ({
  clusters: countSetChanges(new Set(before.clusters.map(cluster => cluster.id)), new Set(after.clusters.map(cluster => cluster.id))),
  services: countSetChanges(new Set(before.services.map(service => service.id)), new Set(after.services.map(service => service.id))),
  components: countSetChanges(
    new Set(before.services.flatMap(service => service.components.map(component => `${service.id}\0${component.id}`))),
    new Set(after.services.flatMap(service => service.components.map(component => `${service.id}\0${component.id}`))),
  ),
});

export const getAutomaticUpdateNotification = (
  report: ProductNavigationAutomaticUpdateReport,
): ProductNavigationUpdateNotification | undefined => {
  if (report.failures.length > 0) {
    if (!report.notifications.failures) return undefined;
    return {
      success: false,
      message: `Automatic update failed: ${report.failures.map(failure => `${failure.block} (${failure.source}): ${failure.message}`).join("; ")}`,
    };
  }
  if (!report.notifications.successes) return undefined;
  const { clusters, services, components } = report.changes;
  return {
    success: true,
    message: `Automatic update completed: clusters +${clusters.added}/-${clusters.removed}, services +${services.added}/-${services.removed}, components +${components.added}/-${components.removed}`,
  };
};
