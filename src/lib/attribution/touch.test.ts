import { describe, expect, it, vi } from "vitest";
import { ATTR_CID, normalizeCid, recordTouch, touchSource } from "./touch";

function client(error: { message: string } | null = null) {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      void fn;
      void args;
      return { error };
    }),
  };
}

describe("ATTR_CID", () => {
  it("matches every channel prefix we attribute", () => {
    for (const cid of [
      "AGY-ren-Gold Hook 03",
      "CRT-my-analysis-01",
      "ORG-tg-2026-09-22",
      "EML-nurture-digest",
    ]) {
      expect(ATTR_CID.test(cid), cid).toBe(true);
    }
  });

  it("takes the ad-name characters Meta actually substitutes", () => {
    // {{ad.name}} is written by a human in Ads Manager: spaces, dots, mixed
    // case and percent-encoding all turn up, and none of them are a reason to
    // lose the attribution.
    expect(ATTR_CID.test("AGY-ren-MY %7C Gold.Hook_03 ~ v2")).toBe(true);
  });

  it("rejects anything that is not one of ours", () => {
    for (const cid of [
      "",
      "AGY-",
      "XYZ-ren-hook",
      "AGY-ren-<script>",
      "AGY-ren-" + "x".repeat(200),
      "agy-ren-hook",
    ]) {
      expect(ATTR_CID.test(cid), cid).toBe(false);
    }
  });
});

describe("touchSource", () => {
  it("reads the source off the prefix", () => {
    expect(touchSource("AGY-ren-hook")).toBe("AGY");
    expect(touchSource("CRT-my-01")).toBe("CRT");
    expect(touchSource("ORG-tg-01")).toBe("ORG");
    expect(touchSource("EML-trial-welcome")).toBe("EML");
  });

  it("calls anything else 'other' rather than guessing", () => {
    expect(touchSource("something-else")).toBe("other");
    expect(touchSource("")).toBe("other");
  });
});

describe("normalizeCid", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeCid("  AGY-ren-hook  ")).toBe("AGY-ren-hook");
  });

  it("returns null for a missing or unrecognised cid", () => {
    expect(normalizeCid(null)).toBeNull();
    expect(normalizeCid(undefined)).toBeNull();
    expect(normalizeCid("   ")).toBeNull();
    expect(normalizeCid("javascript:alert(1)")).toBeNull();
  });

  it("truncates a very long ad name rather than dropping the click", () => {
    const long = "AGY-ren-" + "a".repeat(400);
    const out = normalizeCid(long);
    // 4-char prefix + ATTR_CID's 110-char label. The column and the RPC cap
    // at 120, so a truncated cid is always accepted downstream.
    expect(out).toHaveLength(114);
    expect(out?.startsWith("AGY-ren-")).toBe(true);
  });
});

describe("recordTouch", () => {
  it("calls fn_record_touch with the RPC's parameter names", async () => {
    const db = client();
    const ok = await recordTouch(db, {
      userId: "11111111-1111-4111-8111-111111111111",
      cid: "AGY-ren-Gold Hook 03",
      geo: "my",
      path: "/lp/analysis",
    });
    expect(ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("fn_record_touch", {
      p_user_id: "11111111-1111-4111-8111-111111111111",
      p_cid: "AGY-ren-Gold Hook 03",
      p_geo: "MY",
      p_path: "/lp/analysis",
      p_anon_id: null,
    });
  });

  it("does not call out at all for a cid we do not recognise", async () => {
    const db = client();
    expect(await recordTouch(db, { userId: "u1", cid: "nonsense" })).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("needs a user or an anonymous id to attribute to", async () => {
    const db = client();
    expect(await recordTouch(db, { cid: "AGY-ren-hook" })).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("swallows a failed write — a touch must never break the caller", async () => {
    const db = client({ message: "boom" });
    expect(await recordTouch(db, { userId: "u1", cid: "AGY-ren-hook" })).toBe(false);
    const thrower = {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        void fn;
        void args;
        throw new Error("network down");
      }),
    };
    await expect(recordTouch(thrower, { userId: "u1", cid: "AGY-ren-hook" })).resolves.toBe(false);
  });

  it("drops a geo that is not a two-letter country", async () => {
    const db = client();
    await recordTouch(db, { userId: "u1", cid: "ORG-tg-01", geo: "Malaysia" });
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_geo: null });
  });
});
