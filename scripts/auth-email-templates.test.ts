import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildAuthTemplates, LOCALES } from "./auth-email-templates.mjs";

const words = JSON.parse(readFileSync(new URL("../supabase/templates/auth-emails.json", import.meta.url), "utf8"));
const built = buildAuthTemplates(words);

/**
 * What Supabase would render for a reader, following the one shape these
 * templates use: a chain of `eq $l "<locale>"` branches and an English else.
 */
function render(template: string, locale: string | undefined): string {
  const rest = template.replace(/^\{\{ \$l := printf "%v" \.Data\.locale \}\}/, "");
  // One capture group: a branch's locale, or undefined at {{ else }} / {{ end }}.
  const parts = rest.split(/\{\{ (?:if|else if) eq \$l "([^"]+)" \}\}|\{\{ else \}\}|\{\{ end \}\}/);
  const branches = new Map<string, string>();
  let i = 1;
  for (; typeof parts[i] === "string"; i += 2) branches.set(parts[i], parts[i + 1]);
  const english = parts[i + 1];
  return (locale && branches.get(locale)) ?? english;
}

// What the project sends today. English readers must see no change at all.
const LIVE_EN = {
  mailer_subjects_confirmation: "Your Market Makers FX code: {{ .Token }}",
  mailer_templates_confirmation_content:
    '<h2>Confirm your email address</h2>\n<p>Enter this 6-digit code to finish creating your Market Makers FX account:</p>\n<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>\n<p>This code expires in 1 hour. If you didn\'t request it, you can ignore this email.</p>',
  mailer_subjects_recovery: "Your password reset code: {{ .Token }}",
  mailer_templates_recovery_content:
    '<h2>Reset your password</h2>\n<p>Enter this 6-digit code to set a new password:</p>\n<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>\n<p>This code expires in 1 hour. If you didn\'t request it, you can ignore this email.</p>',
};

describe("the Supabase code emails", () => {
  it("builds the confirmation and recovery subject and body", () => {
    expect(Object.keys(built).sort()).toEqual(Object.keys(LIVE_EN).sort());
  });

  it("sends English readers exactly what goes out today", () => {
    for (const [field, live] of Object.entries(LIVE_EN)) {
      expect(render(built[field], undefined), field).toBe(live);
      expect(render(built[field], "en"), field).toBe(live);
      expect(render(built[field], "<nil>"), field).toBe(live);
    }
  });

  it("gives every language its own words, with the code in every branch", () => {
    for (const field of Object.keys(built)) {
      for (const locale of LOCALES) {
        const out = render(built[field], locale);
        expect(out, `${field} ${locale}`).toContain("{{ .Token }}");
        if (locale !== "en") expect(out, `${field} ${locale}`).not.toBe(LIVE_EN[field as keyof typeof LIVE_EN]);
      }
    }
  });

  it("is one well-formed chain: a string-safe pick, four branches, an English else", () => {
    for (const [field, template] of Object.entries(built)) {
      expect(template.startsWith('{{ $l := printf "%v" .Data.locale }}'), field).toBe(true);
      expect(template.match(/\{\{ if /g), field).toHaveLength(1);
      expect(template.match(/\{\{ else if /g), field).toHaveLength(3);
      expect(template.match(/\{\{ else \}\}/g), field).toHaveLength(1);
      expect(template.match(/\{\{ end \}\}/g), field).toHaveLength(1);
      expect(template.match(/\{\{ \.Token \}\}/g), field).toHaveLength(LOCALES.length);
    }
  });

  it("marks each translated body with its language", () => {
    expect(render(built.mailer_templates_confirmation_content, "zh-Hant")).toMatch(/^<div lang="zh-Hant">/);
  });
});
