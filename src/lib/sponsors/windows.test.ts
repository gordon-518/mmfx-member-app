import { describe, expect, it, vi } from "vitest";
import { countryName, dealStart, describeWindow, fetchWindows, shapeWindow } from "./windows";

describe("shapeWindow", () => {
  it("keeps a well-formed row and drops a malformed one", () => {
    expect(shapeWindow({ country: "MY", since: "2026-11-01T00:00:00+00:00", until: null })).toEqual({
      country: "MY",
      since: "2026-11-01T00:00:00+00:00",
      until: null,
    });
    expect(shapeWindow({ country: 7, since: "x" })).toBeNull();
  });
});

describe("dealStart", () => {
  it("is the earliest window start", () => {
    expect(
      dealStart([
        { country: "ID", since: "2026-12-01T00:00:00Z", until: null },
        { country: "MY", since: "2026-11-01T00:00:00Z", until: null },
      ])
    ).toEqual(new Date("2026-11-01T00:00:00Z"));
  });
  it("is null with no windows", () => {
    expect(dealStart([])).toBeNull();
  });
});

describe("wording", () => {
  it("names the country", () => {
    expect(countryName("MY")).toBe("Malaysia");
    expect(countryName("ZZ")).toBe("ZZ");
  });
  it("describes an open and a closed window", () => {
    expect(describeWindow({ country: "MY", since: "2026-11-01T00:00:00Z", until: null })).toBe("Malaysia from 1 Nov 2026");
    expect(describeWindow({ country: "SG", since: "2026-11-01T00:00:00Z", until: "2027-01-31T00:00:00Z" })).toBe(
      "Singapore 1 Nov 2026 to 31 Jan 2027"
    );
  });
});

describe("fetchWindows", () => {
  it("calls fn_sponsor_windows with the slug and shapes the rows", async () => {
    const rpc = vi.fn(async () => ({ data: [{ country: "MY", since: "2026-11-01T00:00:00Z", until: null }], error: null }));
    expect(await fetchWindows({ rpc }, "octa")).toEqual([{ country: "MY", since: "2026-11-01T00:00:00Z", until: null }]);
    expect(rpc).toHaveBeenCalledWith("fn_sponsor_windows", { p_slug: "octa" });
  });
  it("answers [] on an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    expect(await fetchWindows({ rpc }, "octa")).toEqual([]);
    spy.mockRestore();
  });
});
