export type ClubStatement = {
  bind(...values: unknown[]): ClubStatement;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};
export type ClubDatabase = {
  prepare(sql: string): ClubStatement;
  batch(statements: ClubStatement[]): Promise<unknown[]>;
};
export type ClubIdentity = {
  userId: string;
  email: string;
  displayName: string;
};
export type LedgerRow = {
  id: string;
  delta: number;
  kind: string;
  note: string;
  created_at: string;
  order_id: string | null;
};
export type Redemption = {
  id: string;
  user_id: string;
  points: number;
  value_cents: number;
  minimum_cents: number;
  state: string;
  order_id: string | null;
  expires_at: string;
};
