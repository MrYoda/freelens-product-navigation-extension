declare module "electron" {
  interface UpdateSession {
    fetch(input: string): Promise<Response>;
    setProxy(config: { mode: "direct" | "system" }): Promise<void>;
  }

  export const session: {
    fromPartition(partition: string): UpdateSession;
  };
}
