import assert from "node:assert/strict";

const debuggingPort = process.env.CDP_PORT ?? "9222";
const timeoutAt = Date.now() + 60_000;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then(response => response.json());
const target = targets.find(candidate => candidate.type === "page" && candidate.url.includes("renderer.freelens.app"));
assert(target, "Freelens renderer was not found on the CDP port");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const contexts = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.executionContextCreated") contexts.set(message.params.context.id, message.params.context);
  if (message.method === "Runtime.executionContextsCleared") contexts.clear();
  const handler = pending.get(message.id);
  if (handler) { pending.delete(message.id); handler(message); }
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`CDP command ${method} timed out`));
  }, 5_000);
  pending.set(id, message => {
    clearTimeout(timer);
    return message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, contextId) => {
  const result = await command("Runtime.evaluate", { expression, contextId, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (description, operation) => {
  while (Date.now() < timeoutAt) {
    const result = await operation().catch(() => undefined);
    if (result) return result;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
};

await command("Runtime.enable");
const rootContext = await waitFor("application renderer", async () => {
  for (const context of contexts.values()) {
    if (!context.auxData?.isDefault) continue;
    const hostname = await evaluate("location.hostname", context.id);
    if (hostname === "renderer.freelens.app") return context.id;
  }
});
const openProducts = async () => {
  await evaluate("document.querySelector('[data-testid=product-navigation-top-bar-button]')?.click()", rootContext);
  await waitFor("global Products page", async () => {
    const state = await evaluate(`({
      href: location.href,
      text: document.body.innerText,
      productsAreTopmost: Boolean(document.elementsFromPoint(500, 200)[0]?.closest?.("[data-testid=product-navigation-page]")),
    })`, rootContext);
    return state.href.endsWith("/product-navigation-global") && state.text.includes("Checkout A") && state.productsAreTopmost && state;
  });
};
const openTarget = async (buttonText, namespace, podName) => {
  await evaluate(`([...document.querySelectorAll("button")].find(button => button.textContent.trim() === ${JSON.stringify(buttonText)}))?.click()`, rootContext);
  return waitFor(`${buttonText} Pods in ${namespace}`, async () => {
    for (const context of contexts.values()) {
      if (!context.auxData?.isDefault || context.id === rootContext) continue;
      const state = await evaluate("({ href: location.href, text: document.body.innerText })", context.id);
      if (state.href.endsWith("/pods") && state.text.includes(`Namespace: ${namespace}`) && state.text.includes(podName)) return { contextId: context.id, state };
    }
  });
};

await openProducts();
await evaluate(`(() => {
  const input = document.querySelector(".ProductNavigationFilter");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Checkout B");
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`, rootContext);
await waitFor("filtered Products table", async () => {
  const text = await evaluate("document.querySelector('[data-testid=product-navigation-page]').innerText", rootContext);
  return text.includes("Checkout B") && !text.includes("Checkout A");
});
await evaluate(`(() => {
  const input = document.querySelector(".ProductNavigationFilter");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("tr")].find(row => row.textContent.includes("Checkout A")).querySelector('input[type="checkbox"]').click();
})()`, rootContext);
await waitFor("hidden component", async () => !(await evaluate("document.querySelector('[data-testid=product-navigation-page]').innerText.includes('Checkout A')", rootContext)));
await evaluate(`([...document.querySelectorAll("label")].find(label => label.textContent.includes("Show hidden"))).querySelector("input").click()`, rootContext);
await waitFor("shown hidden component", () => evaluate("document.querySelector('[data-testid=product-navigation-page]').innerText.includes('Checkout A')", rootContext));
await evaluate(`([...document.querySelectorAll("tr")].find(row => row.textContent.includes("Checkout A"))).querySelector('input[type="checkbox"]').click()`, rootContext);
const clusterA = await openTarget("Cluster A", "team-a", "cluster-a-pod");
await openProducts();
const clusterB = await openTarget("Cluster B", "team-b", "cluster-b-pod");
await evaluate(`([...document.querySelectorAll("*")].find(element => element.children.length === 0 && element.textContent.trim() === "Products"))?.click()`, clusterB.contextId);
await waitFor("cluster Products page", async () => {
  const state = await evaluate("({ href: location.href, text: document.body.innerText })", clusterB.contextId);
  return state.href.endsWith("/product-navigation-cluster") && state.text.includes("Checkout A") && state.text.includes("Checkout B");
});
console.log(`GUI smoke test passed: ${clusterA.state.href} (team-a), ${clusterB.state.href} (team-b), and the cluster Products table`);
socket.close();
