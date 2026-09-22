import { describe, it, expect } from "vitest";
import { brandFonts, DISPLAY, BODY } from "./renderFonts";

// A TrueType file begins with the version tag 0x00010000.
function isTrueType(data: Buffer): boolean {
  return data.readUInt32BE(0) === 0x00010000;
}

describe("brandFonts", () => {
  it("loads every weight the templates ask for", async () => {
    const fonts = await brandFonts();
    const got = fonts.map((f) => `${f.name}:${f.weight}`).sort();
    expect(got).toEqual(
      [`${DISPLAY}:700`, `${DISPLAY}:800`, `${BODY}:400`, `${BODY}:700`].sort()
    );
  });

  it("returns real font binaries, not empty or truncated files", async () => {
    // Satori fails opaquely on a bad buffer, so the shape is checked here where the
    // error can actually say which file is wrong.
    for (const f of await brandFonts()) {
      expect(f.data.byteLength, `${f.name} ${f.weight} is empty`).toBeGreaterThan(10_000);
      expect(isTrueType(f.data), `${f.name} ${f.weight} is not TrueType`).toBe(true);
    }
  });

  it("uses the same families as the member app's own pages", async () => {
    // The point of vendoring these is that a post and the landing page it links to are
    // set in the same type. If layout.tsx ever changes family, this is the reminder.
    expect(DISPLAY).toBe("Bricolage Grotesque");
    expect(BODY).toBe("Hanken Grotesk");
  });

  it("caches, so a burst of renders does not re-read from disk", async () => {
    const a = await brandFonts();
    const b = await brandFonts();
    expect(b).toBe(a);
    // Identity, not just equality — the buffers must be shared.
    expect(b[0].data).toBe(a[0].data);
  });

  it("every font is upright — no italics are shipped", async () => {
    for (const f of await brandFonts()) expect(f.style).toBe("normal");
  });
});
