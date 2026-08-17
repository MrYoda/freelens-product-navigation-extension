import type { ProductNavigationPreferences, ProductNavigationService } from "./products";

export type SearchEntityType = "service" | "component" | "cluster" | "namespace";

export interface SearchToken {
  type: SearchEntityType;
  value: string;
  label: string;
}

export const searchEntityDetails: Record<SearchEntityType, { label: string; icon: string }> = {
  service: { label: "Service", icon: "dns" },
  component: { label: "Component", icon: "widgets" },
  cluster: { label: "Cluster", icon: "cloud" },
  namespace: { label: "Namespace", icon: "folder" },
};

const includes = (value: string | undefined, query: string) => value?.toLocaleLowerCase().includes(query) ?? false;

export function getSearchTokens(navigation: ProductNavigationPreferences): SearchToken[] {
  const tokens: SearchToken[] = [];
  const seen = new Set<string>();
  const add = (token: SearchToken) => {
    const key = `${token.type}:${token.value}`;
    if (!seen.has(key)) { seen.add(key); tokens.push(token); }
  };
  navigation.services.forEach(service => {
    add({ type: "service", value: service.id, label: service.name });
    service.components.forEach(component => {
      add({ type: "component", value: component.id, label: component.name });
      component.targets.forEach(target => add({ type: "namespace", value: target.namespace, label: target.namespace }));
    });
  });
  navigation.clusters.forEach(cluster => add({ type: "cluster", value: cluster.id, label: cluster.name }));
  return tokens;
}

export function suggestSearchTokens(tokens: SearchToken[], query: string, selected: SearchToken[]): SearchToken[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < 2) return [];
  const selectedKeys = new Set(selected.map(token => `${token.type}:${token.value}`));
  return tokens.filter(token => !selectedKeys.has(`${token.type}:${token.value}`)
    && (includes(token.label, normalized) || includes(token.value, normalized)));
}

export function componentMatchesTokens(
  service: ProductNavigationService,
  component: ProductNavigationService["components"][number],
  tokens: SearchToken[],
): boolean {
  const byType = new Map<SearchEntityType, Set<string>>();
  tokens.forEach(token => {
    const values = byType.get(token.type) ?? new Set<string>();
    values.add(token.value);
    byType.set(token.type, values);
  });
  const componentClusters = new Set(component.targets.flatMap(target => target.clusters));
  const componentNamespaces = new Set(component.targets.map(target => target.namespace));
  return (!byType.has("service") || byType.get("service")!.has(service.id))
    && (!byType.has("component") || byType.get("component")!.has(component.id))
    && (!byType.has("cluster") || [...(byType.get("cluster") ?? [])].some(id => componentClusters.has(id)))
    && (!byType.has("namespace") || [...(byType.get("namespace") ?? [])].some(namespace => componentNamespaces.has(namespace)));
}

export function componentMatchesText(
  navigation: ProductNavigationPreferences,
  service: ProductNavigationService,
  component: ProductNavigationService["components"][number],
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const clustersById = new Map(navigation.clusters.map(cluster => [cluster.id, cluster]));
  const product = service.productId ? navigation.products.find(candidate => candidate.id === service.productId) : undefined;
  const terms = component.targets.flatMap(target => [
    target.namespace,
    ...target.clusters.flatMap(id => [id, clustersById.get(id)?.name]),
  ]);
  return [service.id, service.name, product?.id, product?.name, component.id, component.name, ...terms]
    .some(term => includes(term, normalized));
}
