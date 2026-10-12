declare module "electron" {
  export const net: {
    fetch(input: string): Promise<Response>;
  };
}
