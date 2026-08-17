import assert from "node:assert/strict";

const port = process.env.CDP_PORT ?? "9222";
const expectedName = process.env.EXPECT_PRODUCT_NAME;
const replacementName = process.env.SET_PRODUCT_NAME;
const updateProductsPath = process.env.UPDATE_PRODUCTS_PATH;
const expectedUpdatedName = process.env.EXPECT_UPDATED_PRODUCT_NAME;
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
await waitFor("extension preferences entry", () => evaluate(`Boolean([...document.querySelectorAll("*")].find(element => element.children.length === 0 && element.textContent.trim().endsWith("freelens-product-navigation-extension")))`));
await evaluate(`([...document.querySelectorAll("*")].find(element => element.children.length === 0 && element.textContent.trim().endsWith("freelens-product-navigation-extension"))).click()`);
const stored = await waitFor("separate product JSON editor", () => evaluate(`document.querySelector('textarea[aria-label="Products JSON"]')?.value`));
assert.equal(await evaluate("document.querySelectorAll('.ProductNavigationConfigBlock').length"), 4, "four separate configuration blocks are shown");
const products = JSON.parse(stored);
if (expectedName) assert.equal(products[0]?.name, expectedName, "the persisted product name was not loaded into Preferences");

if (replacementName) {
  products[0].name = replacementName;
  const draft = JSON.stringify(products, null, 2);
  await evaluate(`(() => {
    const textarea = document.querySelector('textarea[aria-label="Products JSON"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, ${JSON.stringify(draft)});
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor("enabled Apply Products button", () => evaluate(`!([...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Apply Products"))?.disabled`));
  await evaluate(`([...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Apply Products")).click()`);
  console.log(`Settings GUI smoke test applied product name: ${replacementName}`);
} else {
  console.log(`Settings GUI smoke test loaded persisted product name: ${products[0]?.name}`);
}

if (updateProductsPath) {
  const previousStatus = await evaluate(`document.querySelector('[data-block="products"] .ProductNavigationUpdateStatus')?.textContent ?? ""`);
  await evaluate(`(() => {
    const input = document.querySelector('[data-block="products"] .ProductNavigationUpdateSource input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(updateProductsPath)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor("Products Update now button", () => evaluate(`Boolean([...document.querySelectorAll('[data-block="products"] button')].find(button => button.textContent.trim() === "Update now" && !button.disabled))`));
  await evaluate(`([...document.querySelectorAll('[data-block="products"] button')].find(button => button.textContent.trim() === "Update now")).click()`);
  const updatedProductsJson = await waitFor("successful Products update", () => evaluate(`(() => {
    const status = document.querySelector('[data-block="products"] .ProductNavigationUpdateStatus.is-success');
    return status && status.textContent !== ${JSON.stringify(previousStatus)} && document.querySelector('textarea[aria-label="Products JSON"]').value;
  })()`));
  const updatedProducts = JSON.parse(updatedProductsJson);
  if (expectedUpdatedName) assert.equal(updatedProducts[0]?.name, expectedUpdatedName, "manual Products update did not reach the editor");
  console.log(`Settings GUI smoke test updated Products from ${updateProductsPath}`);
}
socket.close();
