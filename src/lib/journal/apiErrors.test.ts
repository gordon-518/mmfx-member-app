import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { journalApiError, journalApiErrorKey } from "./apiErrors";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

// The routes a member's browser calls, plus the shared guards. Read from the
// source so a new member-facing message can't ship untranslated unnoticed.
const MEMBER_ROUTES = [
  "src/lib/journal/api.ts",
  "src/app/api/journal/accounts/route.ts",
  "src/app/api/journal/accounts/[id]/route.ts",
  "src/app/api/journal/accounts/[id]/sync/route.ts",
  "src/app/api/journal/goals/route.ts",
  "src/app/api/journal/rules/route.ts",
  "src/app/api/journal/trades/[id]/route.ts",
  "src/app/api/journal/report/generate/route.ts",
];

// Malformed requests the UI never sends (its own controls rule them out).
const DEVELOPER_ONLY = new Set(["Invalid JSON body", "Unknown style", "Unknown emotion"]);

function literalErrors(): string[] {
  return MEMBER_ROUTES.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/error:\s*(?:"([^"]+)"|`([^`]+)`)/g)].map((m) => m[1] ?? m[2])
  );
}

describe("journalApiErrorKey", () => {
  it("maps every message a member can hit to a dictionary key", () => {
    const messages = literalErrors().filter((msg) => !DEVELOPER_ONLY.has(msg));
    expect(messages.length).toBeGreaterThan(10);
    const unmapped = messages.filter((msg) => journalApiErrorKey(msg) === null);
    expect(unmapped).toEqual([]);
  });

  it("has every key's message in every language, with the same placeholders", () => {
    const en = MESSAGES.en.journal.errors;
    for (const locale of LOCALES) {
      const e = MESSAGES[locale].journal.errors;
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(e[key], `${locale}/${key}`).toBeTruthy();
        expect(e[key].match(/\{\w+\}/g) ?? [], `${locale}/${key}`).toEqual(en[key].match(/\{\w+\}/g) ?? []);
      }
    }
  });
});

describe("journalApiError", () => {
  const zh = MESSAGES["zh-Hans"].journal.errors;
  const en = MESSAGES.en.journal.errors;

  it("translates a known message and fills its placeholders", () => {
    const body = { error: "Daily limit reached — you can generate up to 5 reports per day. Try again tomorrow." };
    expect(journalApiError(429, body, zh, "fallback", { cap: 5 })).toContain("5");
    expect(journalApiError(429, body, zh, "fallback", { cap: 5 })).not.toMatch(/Daily limit/);
    expect(journalApiError(429, body, en, "fallback", { cap: 5 })).toBe(body.error);
  });

  it("never shows a server error's raw text", () => {
    expect(journalApiError(500, { error: "duplicate key value violates unique constraint" }, en, "Could not save")).toBe(
      "Could not save"
    );
  });

  it("falls back when there is no message, and shows an unknown 4xx message as written", () => {
    expect(journalApiError(400, {}, en, "Could not save")).toBe("Could not save");
    expect(journalApiError(400, null, en, "Could not save")).toBe("Could not save");
    expect(journalApiError(400, { error: "Something new" }, en, "Could not save")).toBe("Something new");
  });
});
