import type { ProductNavigationBlock, ProductNavigationPreferences, ProductNavigationUpdateInterval } from "./products";

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
