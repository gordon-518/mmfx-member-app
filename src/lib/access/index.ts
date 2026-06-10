// Server-side gating primitives ONLY. This barrel is server-only by
// transitivity (getAccess/requireFull import "server-only").
//
// The LockedOverlay UI component deliberately lives OUTSIDE this barrel —
// import it directly so client components can use it without dragging the
// server-only modules into their bundle:
//
//   import { LockedOverlay } from "@/lib/access/LockedOverlay";

export { getAccess, type Access, type AccessProfile } from "./getAccess";
export { requireFull } from "./requireFull";
