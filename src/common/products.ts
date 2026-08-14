export interface ComponentTarget {
  cluster: string;
  namespace: string;
}

export interface ProductComponent {
  name: string;
  description?: string;
  hidden?: boolean;
  targets: ComponentTarget[];
}

export interface Product {
  name: string;
  description?: string;
  components: ProductComponent[];
}

export interface ProductNavigationConfig {
  products: Product[];
}

export const defaultConfig: ProductNavigationConfig = { products: [] };

function nonEmpty(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
}

export function parseConfig(input: string): ProductNavigationConfig {
  const value: unknown = JSON.parse(input);
  if (!value || typeof value !== "object" || !Array.isArray((value as ProductNavigationConfig).products)) {
    throw new Error("products must be an array");
  }
  const config = value as ProductNavigationConfig;
  config.products.forEach((product, pi) => {
    nonEmpty(product.name, `products[${pi}].name`);
    if (!Array.isArray(product.components)) throw new Error(`products[${pi}].components must be an array`);
    product.components.forEach((component, ci) => {
      nonEmpty(component.name, `products[${pi}].components[${ci}].name`);
      if (!Array.isArray(component.targets) || component.targets.length === 0) {
        throw new Error(`products[${pi}].components[${ci}].targets must be a non-empty array`);
      }
      component.targets.forEach((target, ti) => {
        const path = `products[${pi}].components[${ci}].targets[${ti}]`;
        nonEmpty(target.cluster, `${path}.cluster`);
        nonEmpty(target.namespace, `${path}.namespace`);
      });
    });
  });
  return config;
}

export function productsForCluster(config: ProductNavigationConfig, cluster: string, showHidden = false): Product[] {
  return config.products
    .map(product => ({
      ...product,
      components: product.components.filter(component =>
        (showHidden || !component.hidden) && component.targets.some(target => target.cluster === cluster)),
    }))
    .filter(product => product.components.length > 0);
}
