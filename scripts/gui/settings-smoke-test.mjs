import assert from "node:assert/strict";

const port = process.env.CDP_PORT ?? "9222";
const expectedName = process.env.EXPECT_PRODUCT_NAME;
const replacementName = process.env.SET_PRODUCT_NAME;
const target = (await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()))
  .find(candidate => candidate.type === "page" && candidate.url.includes("renderer.freelens.app"));
assert(target, "Freelens renderer was not found on the CDP port");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let id = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  const handler = pending.get(message.id);
  if (handler) { pending.delete(message.id); handler(message); }
});
const evaluate = expression => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, message => {
    if (message.error || message.result?.exceptionDetails) reject(new Error(message.error?.message ?? message.result.exceptionDetails.text));
    else resolve(message.result.result.value);
  });
  socket.send(JSON.stringify({ id: commandId, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
});
const waitFor = async (description, operation) => {
  const timeout = Date.now() + 30_000;
  while (Date.now() < timeout) {
    const value = await operation().catch(() => undefined);
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${description}`);
};

await evaluate("LensExtensions.Renderer.Navigation.navigate('/preferences')");
await waitFor("extension preferences entry", () => evaluate(`Boolean([...document.querySelectorAll("*")].find(element => element.children.length === 0 && element.textContent.trim() === "freelens-product-navigation-extension"))`));
await evaluate(`([...document.querySelectorAll("*")].find(element => element.children.length === 0 && element.textContent.trim() === "freelens-product-navigation-extension")).click()`);
const stored = await waitFor("product navigation JSON editor", () => evaluate("document.querySelector('.ProductNavigationPreferences textarea')?.value"));
const config = JSON.parse(stored);
if (expectedName) assert.equal(config.products[0]?.name, expectedName, "the persisted product name was not loaded into Preferences");

if (replacementName) {
  config.products[0].name = replacementName;
  const draft = JSON.stringify(config, null, 2);
  await evaluate(`(() => {
    const textarea = document.querySelector(".ProductNavigationPreferences textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, ${JSON.stringify(draft)});
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor("enabled Apply button", () => evaluate(`!([...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Apply"))?.disabled`));
  await evaluate(`([...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Apply")).click()`);
  console.log(`Settings GUI smoke test applied product name: ${replacementName}`);
} else {
  console.log(`Settings GUI smoke test loaded persisted product name: ${config.products[0]?.name}`);
}
socket.close();
