declare module "*.sql?raw" {
  const value: string;
  export default value;
}

declare module "cloudflare:workers" {
  interface D1PreparedStatement {
    run(): Promise<unknown>;
  }
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<unknown>;
  }
  export const env: { DB?: D1Database } & Record<string, unknown>;
}
