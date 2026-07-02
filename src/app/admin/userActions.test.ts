import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserMock, rpcMock, banMock, deleteMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  banMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  })),
}));
vi.mock("@/lib/adminUsers", () => ({
  banUserById: banMock,
  deleteUserById: deleteMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { lookupUser, banUser, deleteUser } from "./actions";

const ADMIN = { data: { user: { id: "admin-1" } } };
const TARGET = { id: "u-1", email: "someone@example.com", account_status: "trial_active", banned: false };

// is_admin → true, fn_admin_find_user → the given rows
function wire(rows: unknown[], isAdmin = true) {
  getUserMock.mockResolvedValue(ADMIN);
  rpcMock.mockImplementation((fn: string) => {
    if (fn === "is_admin") return Promise.resolve({ data: isAdmin });
    if (fn === "fn_admin_find_user") return Promise.resolve({ data: rows, error: null });
    return Promise.resolve({ data: null });
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  banMock.mockReset().mockResolvedValue({ ok: true });
  deleteMock.mockReset().mockResolvedValue({ ok: true });
});

describe("admin user actions — auth gate", () => {
  it("non-admin is rejected", async () => {
    wire([TARGET], false);
    expect(await lookupUser("x@y.com")).toEqual({ ok: false, error: "Not authorized" });
  });
  it("unauthenticated is rejected", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    rpcMock.mockResolvedValue({ data: null });
    expect(await banUser("x@y.com", true)).toEqual({ ok: false, error: "Not authenticated" });
  });
});

describe("resolveOne — exactly one match", () => {
  it("no match → error, no side effect", async () => {
    wire([]);
    const r = await deleteUser("nope@x.com", "nope@x.com");
    expect(r.ok).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("multiple matches → refuses", async () => {
    wire([TARGET, { ...TARGET, id: "u-2" }]);
    const r = await banUser("dup@x.com", true);
    expect(r.ok).toBe(false);
    expect(banMock).not.toHaveBeenCalled();
  });
});

describe("banUser", () => {
  it("bans exactly the resolved id", async () => {
    wire([TARGET]);
    const r = await banUser(TARGET.email, true);
    expect(r).toEqual({ ok: true, message: "someone@example.com banned." });
    expect(banMock).toHaveBeenCalledWith("u-1", true);
  });
});

describe("deleteUser guards", () => {
  it("refuses when confirm email doesn't match", async () => {
    wire([TARGET]);
    const r = await deleteUser(TARGET.email, "wrong@example.com");
    expect(r.ok).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("refuses to delete a member_active account", async () => {
    wire([{ ...TARGET, account_status: "member_active" }]);
    const r = await deleteUser(TARGET.email, TARGET.email);
    expect(r.ok).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("deletes when email matches and not a member", async () => {
    wire([TARGET]);
    const r = await deleteUser(TARGET.email, "SOMEONE@example.com"); // case-insensitive
    expect(r).toEqual({ ok: true, message: "someone@example.com permanently deleted." });
    expect(deleteMock).toHaveBeenCalledWith("u-1");
  });
});
