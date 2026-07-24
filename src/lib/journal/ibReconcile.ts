// Pure reconcile of a broker's current allowlist against a freshly-parsed export.
// Also produces the connected accounts to flag, and the two safety guardrails.

export interface ReconcileInput {
  currentAllowlist: string[];
  newList: string[];
  connectedLogins: string[];
}

export interface ReconcileResult {
  added: string[];
  removed: string[];
  flaggedConnected: string[];
  removalPct: number;
  additionPct: number;
  guardRemoval: boolean;
  guardAddition: boolean;
}

const DEFAULT_REMOVAL_PCT = 20;
const DEFAULT_ADDITION_PCT = 50;

export function reconcile(
  input: ReconcileInput,
  opts: { removalThreshold?: number; additionThreshold?: number } = {}
): ReconcileResult {
  const removalThreshold = opts.removalThreshold ?? DEFAULT_REMOVAL_PCT;
  const additionThreshold = opts.additionThreshold ?? DEFAULT_ADDITION_PCT;

  const current = new Set(input.currentAllowlist);
  const next = new Set(input.newList);

  const added = input.newList.filter((l) => !current.has(l));
  const removed = input.currentAllowlist.filter((l) => !next.has(l));
  const flaggedConnected = input.connectedLogins.filter((l) => !next.has(l));

  // First import (nothing to compare against) trips no guardrails.
  const base = input.currentAllowlist.length;
  const removalPct = base === 0 ? 0 : Math.round((removed.length / base) * 100);
  const additionPct = base === 0 ? 0 : Math.round((added.length / base) * 100);

  return {
    added,
    removed,
    flaggedConnected,
    removalPct,
    additionPct,
    guardRemoval: removalPct > removalThreshold,
    guardAddition: additionPct > additionThreshold,
  };
}
