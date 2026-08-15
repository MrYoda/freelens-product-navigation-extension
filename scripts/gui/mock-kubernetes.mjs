import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const clusters = [
  { id: "cluster-a", port: 16443, namespaces: ["team-a", "shared"] },
  { id: "cluster-b", port: 16444, namespaces: ["team-b", "shared"] },
];
const list = (kind, items = []) => ({ apiVersion: "v1", kind: `${kind}List`, metadata: { resourceVersion: "1" }, items });
const namespace = name => ({ apiVersion: "v1", kind: "Namespace", metadata: { name, uid: `ns-${name}`, resourceVersion: "1" }, status: { phase: "Active" } });
const pod = (cluster, namespaceName) => ({
  apiVersion: "v1", kind: "Pod",
  metadata: { name: `${cluster}-pod`, namespace: namespaceName, uid: `${cluster}-${namespaceName}-pod`, resourceVersion: "1" },
  spec: { containers: [{ name: "app", image: "registry.k8s.io/pause:3.10" }], nodeName: `${cluster}-node` },
  status: { phase: "Running", podIP: "10.0.0.2", containerStatuses: [] },
});
const resources = groupVersion => ({
  apiVersion: "v1", kind: "APIResourceList", groupVersion,
  resources: groupVersion === "v1" ? [
    { name: "namespaces", singularName: "namespace", namespaced: false, kind: "Namespace", verbs: ["get", "list", "watch"] },
    { name: "pods", singularName: "pod", namespaced: true, kind: "Pod", verbs: ["get", "list", "watch"] },
    { name: "nodes", singularName: "node", namespaced: false, kind: "Node", verbs: ["get", "list", "watch"] },
    { name: "events", singularName: "event", namespaced: true, kind: "Event", verbs: ["get", "list", "watch"] },
  ] : [],
});

const respond = (response, body, status = 200) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const servers = clusters.map(cluster => createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${cluster.port}`);
  if (url.pathname === "/version") return respond(response, { major: "1", minor: "31", gitVersion: "v1.31.0", gitCommit: "mock", platform: "linux/amd64" });
  if (url.pathname === "/api") return respond(response, { apiVersion: "v1", kind: "APIVersions", versions: ["v1"], serverAddressByClientCIDRs: [] });
  if (url.pathname === "/apis") return respond(response, { apiVersion: "v1", kind: "APIGroupList", groups: [] });
  if (url.pathname === "/api/v1") return respond(response, resources("v1"));
  if (url.pathname === "/api/v1/namespaces") return respond(response, list("Namespace", cluster.namespaces.map(namespace)));
  const namespacedPods = url.pathname.match(/^\/api\/v1\/namespaces\/([^/]+)\/pods$/);
  if (namespacedPods) return respond(response, list("Pod", [pod(cluster.id, decodeURIComponent(namespacedPods[1]))]));
  if (url.pathname === "/api/v1/pods") return respond(response, list("Pod", cluster.namespaces.map(name => pod(cluster.id, name))));
  if (url.pathname === "/api/v1/nodes") return respond(response, list("Node", [{ apiVersion: "v1", kind: "Node", metadata: { name: `${cluster.id}-node`, uid: `${cluster.id}-node`, resourceVersion: "1" }, status: { conditions: [] } }]));
  if (url.pathname.startsWith("/api/v1/")) return respond(response, list("Resource"));
  return respond(response, { apiVersion: "v1", kind: "Status", status: "Failure", reason: "NotFound", code: 404 }, 404);
}).listen(cluster.port, "127.0.0.1"));

const kubeconfigPath = resolve(process.argv[2] ?? "tmp/gui/kubeconfig");
await mkdir(dirname(kubeconfigPath), { recursive: true });
await writeFile(kubeconfigPath, `apiVersion: v1
kind: Config
clusters:
${clusters.map(cluster => `- name: ${cluster.id}\n  cluster:\n    server: http://127.0.0.1:${cluster.port}`).join("\n")}
contexts:
${clusters.map(cluster => `- name: ${cluster.id}\n  context:\n    cluster: ${cluster.id}\n    user: mock-user`).join("\n")}
current-context: cluster-a
users:
- name: mock-user
  user:
    token: mock-token
`);
console.log(`Mock Kubernetes clusters ready; kubeconfig=${kubeconfigPath}`);

const close = () => Promise.all(servers.map(server => new Promise(resolveClose => server.close(resolveClose)))).then(() => process.exit());
process.on("SIGINT", close);
process.on("SIGTERM", close);
