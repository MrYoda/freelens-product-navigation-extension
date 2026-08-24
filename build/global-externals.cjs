const exportNames = {
  "@freelensapp/extensions": ["Common", "Main", "Renderer"],
  mobx: ["action", "makeObservable", "observable"],
  react: ["Fragment", "createElement", "forwardRef", "useCallback", "useEffect", "useImperativeHandle", "useMemo", "useRef", "useState"],
  "react/jsx-runtime": ["Fragment", "jsx", "jsxs"],
};

exports.globalExternals = globals => ({
  name: "freelens-global-externals",
  enforce: "pre",
  resolveId(id) { return id in globals ? `\0freelens-global:${id}` : null; },
  load(id) {
    if (!id.startsWith("\0freelens-global:")) return null;
    const moduleId = id.slice("\0freelens-global:".length);
    return [
      `const value = ${globals[moduleId]};`,
      "export default value;",
      ...exportNames[moduleId].map(name => `export const ${name} = value.${name};`),
    ].join("\n");
  },
});
