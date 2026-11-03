import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { depositErrorKey } from "./depositErrors";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

const MIGRATION = "supabase/migrations/20260915000005_submission_telegram.sql";

/** The member-facing messages fn_submit_deposit raises, read from the migration itself. */
function raisedMessages(): string[] {
  const sql = readFileSync(MIGRATION, "utf8");
  return [...sql.matchAll(/raise exception '([^']+)'/g)]
    .map((m) => m[1])
    .filter((msg) => !msg.startsWith("fn_submit_deposit:"));
}

describe("depositErrorKey", () => {
  it("maps every message fn_submit_deposit raises to a dictionary key", () => {
    const messages = raisedMessages();
    expect(messages).toHaveLength(7);
    const keys = messages.map(depositErrorKey);
    expect(keys).toEqual(["broker", "account", "minimum", "telegram", "tradingview", "screenshot", "waiting"]);
  });

  it("leaves an unexpected error unmapped, so the caller logs it", () => {
    expect(depositErrorKey("duplicate key value violates unique constraint")).toBeNull();
    expect(depositErrorKey("fn_submit_deposit: no authenticated user")).toBeNull();
  });

  it("every key has a message in every language", () => {
    for (const locale of LOCALES) {
      for (const msg of raisedMessages()) {
        const key = depositErrorKey(msg)!;
        expect(MESSAGES[locale].upgrade.errors[key], `${locale}/${key}`).toBeTruthy();
      }
    }
  });
});
