// Lightweight, dependency-free device fingerprint computed at signup. Hashes a
// handful of stable browser/device attributes so the SAME device registering a
// fresh email lands the same fingerprint — surfacing trial-hopping in /admin.
// It's a soft signal (incognito keeps most of these; a different device/browser
// changes it), used for flagging, never hard-blocking.
export function computeFingerprint(): string {
  if (typeof navigator === "undefined") return "";
  const n = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const s = typeof screen !== "undefined" ? screen : ({} as Screen);
  const parts = [
    n.userAgent || "",
    n.language || "",
    (n.languages || []).join(","),
    n.platform || "",
    String(n.hardwareConcurrency ?? ""),
    String(n.deviceMemory ?? ""),
    `${s.width ?? ""}x${s.height ?? ""}x${s.colorDepth ?? ""}`,
    String(typeof window !== "undefined" ? window.devicePixelRatio : ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  ].join("|");

  // djb2 string hash → unsigned 32-bit hex. Collisions don't matter here; we
  // only need a stable id per device config.
  let h = 5381;
  for (let i = 0; i < parts.length; i++) {
    h = ((h << 5) + h + parts.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
