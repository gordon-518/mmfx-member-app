import "server-only";

// All MM invite-only scripts — Pine IDs derived from the TradingView URL hash.
// https://www.tradingview.com/script/HASH-Name/  →  PUB;HASH
const PINE_SCRIPTS = [
  // Indicators
  "PUB;FguarHam", // MM Squeeze Pulse
  "PUB;LSzVr7JY", // MM Wave Pressure
  "PUB;HX9nOiYf", // MM Structure Map
  "PUB;cFyNYi1E", // MM Echo Predictor
  "PUB;tEs31VWM", // MM Trend Rail
  "PUB;1ztDth3L", // MM Pivot Trend
  "PUB;EFN8WkXI", // MM MTF Minicharts
  "PUB;2ovm0ORy", // MM Auto Trendlines
  "PUB;oM5iK4vt", // MM Adaptive MA
  "PUB;INJR52ux", // MM Reversion Bands
  // Strategies
  "PUB;vHt8dWZt", // MM AMA SuperTrend
  "PUB;gzyYtuwj", // MM System 5m Entry
] as const;

const TV_BASE = "https://www.tradingview.com";

function tvHeaders() {
  const sessionId   = process.env.TV_SESSION_ID;
  const sessionSign = process.env.TV_SESSION_ID_SIGN;
  if (!sessionId || !sessionSign) {
    throw new Error("TV_SESSION_ID and TV_SESSION_ID_SIGN must be set in env");
  }
  const csrfToken = process.env.TV_CSRF_TOKEN; // optional
  const cookie = csrfToken
    ? `sessionid=${sessionId}; sessionid_sign=${sessionSign}; csrftoken=${csrfToken}`
    : `sessionid=${sessionId}; sessionid_sign=${sessionSign}`;
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie,
    ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    Referer: `${TV_BASE}/`,
    Origin: TV_BASE,
  };
}

async function tvPost(path: string, body: URLSearchParams): Promise<void> {
  const res = await fetch(`${TV_BASE}${path}`, {
    method: "POST",
    headers: tvHeaders(),
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TV ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
}

export interface TVSyncResult {
  action: "granted" | "revoked";
  succeeded: number;
  failed: { pineId: string; error: string }[];
}

/**
 * Grant the user access to all 12 scripts.
 * - trialEndsAt = null  → permanent (member_active)
 * - trialEndsAt = Date  → time-limited; TV auto-revokes on that date
 */
export async function grantTVAccess(
  tvUsername: string,
  trialEndsAt: string | Date | null
): Promise<TVSyncResult> {
  const expiration = trialEndsAt
    ? new Date(trialEndsAt).toISOString().slice(0, 10)
    : null;

  const results = await Promise.allSettled(
    PINE_SCRIPTS.map(async (pineId) => {
      const body = new URLSearchParams({ pine_id: pineId, username_recip: tvUsername });
      if (expiration) body.set("expiration", expiration);
      await tvPost("/pine_perm/add/", body);
    })
  );

  return buildResult("granted", results);
}

/**
 * Immediately revoke the user's access on all 12 scripts.
 */
export async function revokeTVAccess(tvUsername: string): Promise<TVSyncResult> {
  const results = await Promise.allSettled(
    PINE_SCRIPTS.map(async (pineId) => {
      const body = new URLSearchParams({ pine_id: pineId, username_recip: tvUsername });
      await tvPost("/pine_perm/remove/", body);
    })
  );

  return buildResult("revoked", results);
}

function buildResult(
  action: TVSyncResult["action"],
  results: PromiseSettledResult<void>[]
): TVSyncResult {
  let succeeded = 0;
  const failed: TVSyncResult["failed"] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      succeeded++;
    } else {
      failed.push({ pineId: PINE_SCRIPTS[i], error: r.reason?.message ?? String(r.reason) });
    }
  });
  return { action, succeeded, failed };
}
