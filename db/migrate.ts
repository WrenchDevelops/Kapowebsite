import { env } from "../lib/workers-env.ts";
import migrationSql from "../drizzle/0000_commerce.sql?raw";

let migrated: Promise<void> | null = null;

export function ensureCommerceSchema() {
  migrated ??= apply();
  return migrated;
}

async function apply() {
  if (!env.DB) return;
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/already exists|duplicate column/i.test(message)) throw error;
    }
  }
}
