declare module "electron" {
  interface UpdateSession {
    fetch(input: string): Promise<Response>;
    resolveProxy(url: string): Promise<string>;
    setProxy(config: { mode: "direct" | "system" }): Promise<void>;
  }

  export const session: {
    defaultSession: UpdateSession;
    fromPartition(partition: string): UpdateSession;
  };
}
