import type { ApprovedFlow, OfficialAccount } from "./types";

// The /admin/support editor uses one line per item, fields separated by "|".
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const parts = (l: string) => l.split("|").map((p) => p.trim());

export function parseAccounts(text: string): OfficialAccount[] {
  return lines(text).map(parts).filter((p) => p.length >= 2 && p[0])
    // All leading "@"s, not just one: an admin pasting "@@MM_3000" must not
    // store a handle the guard's allowlist can never match.
    .map(([handle, ...label]) => ({ handle: handle.replace(/^@+/, ""), label: label.join(" | ") }));
}
export const accountsText = (a: OfficialAccount[]) => a.map((x) => `${x.handle} | ${x.label}`).join("\n");

export function parseFlows(text: string): ApprovedFlow[] {
  return lines(text).map(parts).filter((p) => p.length >= 3).map(([label, target, ...use]) => {
    const use_when = use.join(" | ");
    return target.startsWith("flow:") ? { label, flow_id: target.slice(5), use_when } : { label, link: target, use_when };
  });
}
export const flowsText = (f: ApprovedFlow[]) =>
  f.map((x) => `${x.label} | ${x.flow_id ? `flow:${x.flow_id}` : x.link ?? ""} | ${x.use_when}`).join("\n");
