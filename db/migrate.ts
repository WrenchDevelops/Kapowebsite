import { env } from "../lib/workers-env.ts";
import migrationSql from "../drizzle/0000_commerce.sql?raw";
import supportSql from "../drizzle/0001_support.sql?raw";
import emailSql from "../drizzle/0002_email.sql?raw";
import labelSql from "../drizzle/0003_label_safeguards.sql?raw";
import marketingSql from "../drizzle/0004_marketing.sql?raw";

let migrated: Promise<void> | null = null;

export function ensureCommerceSchema() {
  // Production migrations belong to the approved release process, never a request.
  if (process.env.NODE_ENV === "production") return Promise.resolve();
  migrated ??= apply();
  return migrated;
}

async function apply() {
  if (!env.DB) return;
  const statements = `${migrationSql}\n--> statement-breakpoint\n${supportSql}\n--> statement-breakpoint\n${emailSql}\n--> statement-breakpoint\n${labelSql}\n--> statement-breakpoint\n${marketingSql}`
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
