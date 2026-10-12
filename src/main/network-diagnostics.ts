export type ProxyRouteResolver = () => Promise<string>;

const diagnosticError = (error: unknown) => error instanceof Error ? error.message : String(error);

const resolveRoute = async (name: string, resolver: ProxyRouteResolver): Promise<string> => {
  try {
    const route = (await resolver()).trim() || "<empty>";
    return `${name}="${route}"`;
  } catch (error) {
    return `${name}=<resolve failed: ${diagnosticError(error)}>`;
  }
};

export const getProxyRouteDiagnostics = async (
  defaultSession: ProxyRouteResolver,
  isolatedSystemSession: ProxyRouteResolver,
): Promise<string> => {
  const routes = await Promise.all([
    resolveRoute("Freelens default session", defaultSession),
    resolveRoute("isolated system session", isolatedSystemSession),
  ]);
  return `Proxy routes: ${routes.join("; ")}`;
};
