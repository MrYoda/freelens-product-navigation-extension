export interface ProductNavigationPreferences {
  clusters: ProductNavigationCluster[];
  products: ProductNavigationProduct[];
  services: ProductNavigationService[];
  hidden: ProductNavigationHidden;
  updates: ProductNavigationUpdates;
}

export type ProductNavigationBlock = "clusters" | "products" | "services" | "hidden";
export type ProductNavigationUpdateInterval = "hour" | "six-hours" | "day" | "week";
export interface ProductNavigationUpdateStatus { attemptedAt: string; success: boolean; message: string }
export interface ProductNavigationBlockUpdate {
  enabled: boolean;
  url: string;
  lastStatus?: ProductNavigationUpdateStatus;
}
export interface ProductNavigationUpdates {
  interval: ProductNavigationUpdateInterval;
  blocks: Record<ProductNavigationBlock, ProductNavigationBlockUpdate>;
}

export interface ProductNavigationCluster { id: string; name: string }
export interface ProductNavigationProduct { id: string; name: string }
export interface ProductNavigationService {
  id: string;
  name: string;
  productId?: string;
  components: ProductNavigationComponent[];
}
export interface ProductNavigationComponent {
  id: string;
  name: string;
  targets: ProductNavigationTarget[];
}
export interface ProductNavigationTarget {
  namespace: string;
  clusters: string[];
}
export interface ProductNavigationHidden {
  services: Record<string, { components: string[] }>;
}

export const defaultConfig: ProductNavigationPreferences = {
  clusters: [],
  products: [],
  services: [],
  hidden: { services: {} },
  updates: {
    interval: "day",
    blocks: {
      clusters: { enabled: false, url: "" },
      products: { enabled: false, url: "" },
      services: { enabled: false, url: "" },
      hidden: { enabled: false, url: "" },
    },
  },
};

export const normalizeConfig = (value?: Partial<ProductNavigationPreferences>): ProductNavigationPreferences => ({
  clusters: value?.clusters ?? [],
  products: value?.products ?? [],
  services: value?.services?.map(service => ({ ...service, components: service.components ?? [] })) ?? [],
  hidden: { services: value?.hidden?.services ?? {} },
  updates: {
    interval: value?.updates?.interval ?? "day",
    blocks: {
      clusters: { ...defaultConfig.updates.blocks.clusters, ...value?.updates?.blocks?.clusters },
      products: { ...defaultConfig.updates.blocks.products, ...value?.updates?.blocks?.products },
      services: { ...defaultConfig.updates.blocks.services, ...value?.updates?.blocks?.services },
      hidden: { ...defaultConfig.updates.blocks.hidden, ...value?.updates?.blocks?.hidden },
    },
  },
});

export interface ValidationResult { errors: string[]; value?: ProductNavigationPreferences }
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const validateUniqueId = (ids: Set<string>, id: string, path: string, errors: string[]) => {
  if (ids.has(id)) errors.push(`Duplicate id "${id}" at ${path}`);
  ids.add(id);
};

export function parseConfig(json: string): ValidationResult {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch (error) {
    return { errors: [error instanceof Error ? error.message : "Invalid JSON"] };
  }
  if (!isObject(parsed)) return { errors: ["Root value must be an object"] };

  const errors: string[] = [];
  const collections = new Map<string, Set<string>>();
  for (const field of ["clusters", "products", "services"] as const) {
    const values = parsed[field];
    const ids = new Set<string>();
    collections.set(field, ids);
    if (!Array.isArray(values)) { errors.push(`Root field "${field}" must be an array`); continue; }
    values.forEach((value, index) => {
      const path = `${field}[${index}]`;
      if (!isObject(value)) { errors.push(`${path} must be an object`); return; }
      if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
      else validateUniqueId(ids, value.id, path, errors);
      if (!isNonEmptyString(value.name)) errors.push(`${path}.name must be a non-empty string`);
    });
  }

  const componentsByService = new Map<string, Set<string>>();
  if (Array.isArray(parsed.services)) parsed.services.forEach((service, serviceIndex) => {
    if (!isObject(service)) return;
    const path = `services[${serviceIndex}]`;
    if (service.productId !== undefined && (!isNonEmptyString(service.productId) || !collections.get("products")?.has(service.productId))) {
      errors.push(`${path}.productId must reference an existing product`);
    }
    if (!Array.isArray(service.components)) { errors.push(`${path}.components must be an array`); return; }
    const componentIds = new Set<string>();
    if (isNonEmptyString(service.id)) componentsByService.set(service.id, componentIds);
    service.components.forEach((component, componentIndex) => {
      const componentPath = `${path}.components[${componentIndex}]`;
      if (!isObject(component)) { errors.push(`${componentPath} must be an object`); return; }
      if (!isNonEmptyString(component.id)) errors.push(`${componentPath}.id must be a non-empty string`);
      else validateUniqueId(componentIds, component.id, componentPath, errors);
      if (!isNonEmptyString(component.name)) errors.push(`${componentPath}.name must be a non-empty string`);
      if (!Array.isArray(component.targets)) {
        errors.push(`${componentPath}.targets must be an array of namespace and clusters objects`);
        return;
      }
      if (component.targets.length === 0) errors.push(`${componentPath}.targets must contain at least one target`);
      const namespaceNames = new Set<string>();
      component.targets.forEach((target, targetIndex) => {
        const targetPath = `${componentPath}.targets[${targetIndex}]`;
        if (!isObject(target)) { errors.push(`${targetPath} must be an object`); return; }
        if (!isNonEmptyString(target.namespace)) errors.push(`${targetPath}.namespace must be a non-empty string`);
        else validateUniqueId(namespaceNames, target.namespace, `${targetPath}.namespace`, errors);
        if (!Array.isArray(target.clusters)) { errors.push(`${targetPath}.clusters must be an array`); return; }
        if (target.clusters.length === 0) errors.push(`${targetPath}.clusters must contain at least one cluster`);
        const clusterIds = new Set<string>();
        target.clusters.forEach((clusterId, clusterIndex) => {
          const clusterPath = `${targetPath}.clusters[${clusterIndex}]`;
          if (!isNonEmptyString(clusterId) || !collections.get("clusters")?.has(clusterId)) errors.push(`${clusterPath} must reference an existing cluster`);
          else validateUniqueId(clusterIds, clusterId, clusterPath, errors);
        });
      });
    });
  });

  if (!isObject(parsed.hidden) || !isObject(parsed.hidden.services)) errors.push('Root field "hidden.services" must be an object');
  else Object.entries(parsed.hidden.services).forEach(([serviceId, hiddenService]) => {
    if (!collections.get("services")?.has(serviceId)) errors.push(`hidden.services.${serviceId} must reference an existing service`);
    if (!isObject(hiddenService) || !Array.isArray(hiddenService.components)) {
      errors.push(`hidden.services.${serviceId}.components must be an array`); return;
    }
    hiddenService.components.forEach((componentId, index) => {
      if (!isNonEmptyString(componentId) || !componentsByService.get(serviceId)?.has(componentId)) {
        errors.push(`hidden.services.${serviceId}.components[${index}] must reference a component`);
      }
    });
  });

  return errors.length ? { errors } : { errors: [], value: normalizeConfig(parsed as Partial<ProductNavigationPreferences>) };
}

export function parseConfigBlock(
  block: ProductNavigationBlock,
  json: string,
  current: ProductNavigationPreferences,
): ValidationResult {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch (error) {
    return { errors: [error instanceof Error ? error.message : "Invalid JSON"] };
  }
  const result = parseConfig(JSON.stringify({ ...current, [block]: parsed }));
  if (!result.value) return result;
  return { errors: [], value: result.value };
}

export const getSummary = (value: ProductNavigationPreferences) => {
  const componentCount = value.services.reduce((sum, service) => sum + service.components.length, 0);
  const targetCount = value.services.reduce((sum, service) => sum + service.components.reduce(
    (total, component) => total + component.targets.reduce((targetTotal, target) => targetTotal + target.clusters.length, 0), 0,
  ), 0);
  return `${value.clusters.length} clusters, ${value.products.length} products, ${value.services.length} services, ${componentCount} components, ${targetCount} targets`;
};
