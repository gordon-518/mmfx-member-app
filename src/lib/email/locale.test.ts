import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLocale, emailLocales } from "./locale";

function db(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("emailLocales", () => {
  it("reads a whole batch in one call, deduplicated", async () => {
    const { client, rpc } = db({ data: [{ user_id: "a", locale: "ms" }, { user_id: "b", locale: "zh-Hant" }] });
    const out = await emailLocales(client, ["a", "b", "a", ""]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("fn_user_locales", { p_ids: ["a", "b"] });
    expect(out?.get("a")).toBe("ms");
    expect(out?.get("b")).toBe("zh-Hant");
  });

  it("skips the call when there is nobody to look up", async () => {
    const { client, rpc } = db({ data: [] });
    expect((await emailLocales(client, []))?.size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignores a value the app doesn't speak", async () => {
    const { client } = db({ data: [{ user_id: "a", locale: "fr" }] });
    expect((await emailLocales(client, ["a"]))?.has("a")).toBe(false);
  });

  it("says it doesn't know (null) when the lookup fails, rather than throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = db({ error: { message: "boom" } });
    expect(await emailLocales(client, ["a"])).toBeNull();
    expect(await emailLocale(client, "a")).toBe("en");
    const throwing = { rpc: () => { throw new Error("no service key"); } } as unknown as SupabaseClient;
    expect(await emailLocales(throwing, ["a"])).toBeNull();
    spy.mockRestore();
  });

  it("gives one member's language, English when none is saved", async () => {
    expect(await emailLocale(db({ data: [{ user_id: "a", locale: "id" }] }).client, "a")).toBe("id");
    expect(await emailLocale(db({ data: [] }).client, "a")).toBe("en");
  });
});
