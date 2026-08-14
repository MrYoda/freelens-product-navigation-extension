import type * as FreelensExtensions from "@freelensapp/extensions";

type FreelensGlobal = typeof globalThis & {
  LensExtensions?: typeof FreelensExtensions;
};

const extensions = (globalThis as FreelensGlobal).LensExtensions;

if (!extensions) {
  throw new Error("Freelens did not expose the global LensExtensions API");
}

export const { Common, Main, Renderer } = extensions;
