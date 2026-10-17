type D1PreparedStatement = { run: () => Promise<unknown> };
type D1Database = { prepare: (query: string) => D1PreparedStatement; exec: (query: string) => Promise<unknown> };

export const env: { DB?: D1Database } & Record<string, unknown> = {};
