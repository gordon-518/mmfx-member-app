import "server-only";
import { createClient as createSupabaseAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { sendAdminAlert } from "@/lib/notify";

// All MM invite-only scripts. The pine_id the permissions API expects is the
// script's internal `script_id_part` (PUB;<32-hex>), NOT the short URL slug —
// these are scraped from each script page's embedded "script" object.
const PINE_SCRIPTS = [
  // Indicators
  "PUB;41d2f3b7fae44c14bfab0d22bec0f505", // MM Squeeze Pulse
  "PUB;7f434f4387434370836935be9c1819fa", // MM Wave Pressure
  "PUB;572153158d8842aaa2396307167b76d7", // MM Structure Map
  "PUB;b1018950d6bc4976b8f6825e68376ded", // MM Echo Predictor
  "PUB;b2de17981051404c8e8ade2a3ee6e72d", // MM Trend Rail
  "PUB;d23dd231cccf41c78bdcd724f6f75944", // MM Pivot Trend
  "PUB;70324481134b40d88fda8e7395b7bf86", // MM MTF Minicharts
  "PUB;e50f629cc688408ab3cd6909d967e2cc", // MM Auto Trendlines
  "PUB;fa91f1ea10094377ba9f1202abe14183", // MM Adaptive MA
  "PUB;bed766d1aeb74b31b3265c7feb622723", // MM Reversion Bands
  // Strategies
  "PUB;2ab95f2f25244bc6981df19f89f16b81", // MM AMA SuperTrend
  "PUB;3ea622da843d4fb9ae41c30d8332f854", // MM System 5m Entry
] as const;

const TV_BASE = "https://www.tradingview.com";
const TV_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// --- Persisted, low-frequency session ---------------------------------------
// TradingView has no official API and rotates its own session tokens. Logging
// in on every serverless cold start hammers TV's /accounts/signin from many
// datacenter IPs, which trips reCAPTCHA and locks us out. So we store ONE
// session in the DB (tv_session, service-role only), shared across every
// instance, and reuse it everywhere — authenticating only when there's no
// stored session at all. An admin can also paste a fresh cookie (browser =
// human = no CAPTCHA) which lands in the same row. Resolution order:
//   in-memory cache  →  DB session  →  programmatic login (last resort)
// On a 403 we first re-read the DB (another instance / an admin paste may have
// already refreshed it) and only log in if the stored session is dead too.

let cachedCookie: string | null = null;
let loginInFlight: Promise<string> | null = null;
let adminClient: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return adminClient;
}

const cookieFrom = (sid: string, sign: string) =>
  `sessionid=${sid}; sessionid_sign=${sign}`;

// Pull a cookie value out of a Set-Cookie header list.
const pickSetCookie = (setCookie: string[], name: string): string | undefined =>
  setCookie.find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

async function loadStoredSession(): Promise<string | null> {
  try {
    const { data } = await admin()
      .from("tv_session")
      .select("sessionid, sessionid_sign")
      .eq("id", 1)
      .maybeSingle();
    if (data?.sessionid && data?.sessionid_sign) {
      return cookieFrom(data.sessionid, data.sessionid_sign);
    }
  } catch {
    /* fall through to login */
  }
  return null;
}

async function persistSession(sid: string, sign: string): Promise<void> {
  try {
    await admin()
      .from("tv_session")
      .upsert({ id: 1, sessionid: sid, sessionid_sign: sign, updated_at: new Date().toISOString() });
  } catch {
    /* best-effort — the in-memory cache still serves this instance */
  }
}

// TradingView rotates its session cookie server-side. On any authenticated
// response it may hand back a refreshed sessionid via Set-Cookie — capture it
// so the stored session tracks the rotation automatically. As long as the
// session is used (the daily cron alone suffices), it renews itself and never
// goes stale. A pasted cookie that TV later rotates is followed, not orphaned.
async function captureRotatedCookie(res: Response): Promise<void> {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (!setCookie.length) return;
  const sid = pickSetCookie(setCookie, "sessionid");
  const sign = pickSetCookie(setCookie, "sessionid_sign");
  if (!sid || !sign) return; // pair only; ignore deletions/partials
  const next = cookieFrom(sid, sign);
  if (next !== cachedCookie) {
    cachedCookie = next;
    await persistSession(sid, sign);
  }
}

async function tvLogin(): Promise<string> {
  const user = process.env.TV_USERNAME;
  const pass = process.env.TV_PASSWORD;
  if (!user || !pass) {
    throw new Error("TV_USERNAME and TV_PASSWORD must be set in env");
  }
  const b = "----mmfxBoundary7MA4YWxkTrZu0gW";
  const body = [
    `--${b}\r\nContent-Disposition: form-data; name="username"\r\n\r\n${user}\r\n`,
    `--${b}\r\nContent-Disposition: form-data; name="password"\r\n\r\n${pass}\r\n`,
    `--${b}\r\nContent-Disposition: form-data; name="remember"\r\n\r\non\r\n`,
    `--${b}--\r\n`,
  ].join("");

  const res = await fetch(`${TV_BASE}/accounts/signin/`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${b}`,
      "User-Agent": TV_UA,
      Referer: `${TV_BASE}/`,
      Origin: TV_BASE,
    },
    body,
    redirect: "manual",
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  const sid = pickSetCookie(setCookie, "sessionid");
  const sign = pickSetCookie(setCookie, "sessionid_sign");

  if (!sid || !sign) {
    const text = await res.text().catch(() => "");
    // A CAPTCHA challenge or bad creds lands here — surface it loudly.
    throw new Error(`TV login failed (${res.status}): ${text.slice(0, 200)}`);
  }
  cachedCookie = cookieFrom(sid, sign);
  await persistSession(sid, sign);
  return cachedCookie;
}

// Dedupes concurrent logins (12 grants fire at once) onto one in-flight call.
function login(): Promise<string> {
  if (!loginInFlight) {
    loginInFlight = tvLogin().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

// Normal path: reuse cache, then the shared DB session, and only log in if
// there's no stored session anywhere.
async function ensureSession(): Promise<string> {
  if (cachedCookie) return cachedCookie;
  const stored = await loadStoredSession();
  if (stored) {
    cachedCookie = stored;
    return cachedCookie;
  }
  return login();
}

// After a 403: adopt a newer stored session if one exists (another instance or
// an admin refresh), otherwise the stored session is dead too → log in.
async function refreshSession(failed: string): Promise<string> {
  const stored = await loadStoredSession();
  if (stored && stored !== failed) {
    cachedCookie = stored;
    return cachedCookie;
  }
  cachedCookie = null;
  return login();
}

/**
 * Manually store a session cookie (admin fallback for when programmatic login
 * is CAPTCHA-blocked). The admin grabs sessionid + sessionid_sign from their
 * browser — where they're a verified human — and pastes them here.
 */
export async function setTVSession(sessionid: string, sign: string): Promise<void> {
  cachedCookie = cookieFrom(sessionid, sign);
  await persistSession(sessionid, sign);
}

/** When the stored session was last refreshed (for the admin status line). */
export async function getTVSessionInfo(): Promise<{ updatedAt: string | null }> {
  try {
    const { data } = await admin()
      .from("tv_session")
      .select("updated_at")
      .eq("id", 1)
      .maybeSingle();
    return { updatedAt: data?.updated_at ?? null };
  } catch {
    return { updatedAt: null };
  }
}

/** Probe the current session against an authenticated-only TV endpoint. */
export async function testTVSession(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const cookie = await ensureSession();
    const body = new URLSearchParams({ pine_id: PINE_SCRIPTS[0], limit: "1" }).toString();
    const res = await rawPost("/pine_perm/list_users/?limit=1", body, cookie);
    if (res.ok) return { ok: true };
    const t = await res.text().catch(() => "");
    return { ok: false, detail: `${res.status}: ${t.slice(0, 140)}` };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

async function rawPost(path: string, bodyStr: string, cookie: string) {
  return fetch(`${TV_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      "User-Agent": TV_UA,
      Referer: `${TV_BASE}/`,
      Origin: TV_BASE,
    },
    body: bodyStr,
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function tvPost(path: string, body: URLSearchParams, attempt = 0): Promise<void> {
  const bodyStr = body.toString();
  let cookie = await ensureSession();
  let res = await rawPost(path, bodyStr, cookie);

  // Session rotated/expired -> adopt a refreshed one (or re-login) and retry.
  if (res.status === 403) {
    cookie = await refreshSession(cookie);
    res = await rawPost(path, bodyStr, cookie);
  }

  // TradingView rate-limits request bursts -> back off and retry a few times.
  if (res.status === 429 && attempt < 3) {
    await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s
    return tvPost(path, body, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TV ${path} ${res.status}: ${text.slice(0, 200)}`);
  }

  // Success — adopt any rotated cookie TV handed back so the stored session
  // never drifts out of sync with TradingView's.
  await captureRotatedCookie(res);
}

// Run an operation against every script SEQUENTIALLY with a small gap.
// TradingView 429s when all 12 fire in parallel, so we pace them. Returns
// settled results so buildResult() can be reused unchanged.
const TV_GAP_MS = 350;
async function runPerScript(
  op: (pineId: string) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  for (let i = 0; i < PINE_SCRIPTS.length; i++) {
    try {
      await op(PINE_SCRIPTS[i]);
      results.push({ status: "fulfilled", value: undefined });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
    if (i < PINE_SCRIPTS.length - 1) await sleep(TV_GAP_MS);
  }
  return results;
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

  const results = await runPerScript(async (pineId) => {
    const body = new URLSearchParams({ pine_id: pineId, username_recip: tvUsername });
    if (expiration) body.set("expiration", expiration);
    await tvPost("/pine_perm/add/", body);
  });

  const result = buildResult("granted", results);
  await maybeAlert(tvUsername, result);
  return result;
}

/**
 * Immediately revoke the user's access on all 12 scripts.
 */
export async function revokeTVAccess(tvUsername: string): Promise<TVSyncResult> {
  const results = await runPerScript(async (pineId) => {
    const body = new URLSearchParams({ pine_id: pineId, username_recip: tvUsername });
    await tvPost("/pine_perm/remove/", body);
  });

  const result = buildResult("revoked", results);
  await maybeAlert(tvUsername, result);
  return result;
}

// Fire an admin email when a sync has failures, throttled so a session-wide
// outage (every script failing for every user) can't flood the inbox. The
// throttle is per warm instance; a handful of alerts during a real outage is
// fine and informative.
let lastAlertAt = 0;
const ALERT_THROTTLE_MS = 10 * 60 * 1000;

async function maybeAlert(tvUsername: string, result: TVSyncResult): Promise<void> {
  if (result.failed.length === 0) return;
  const now = Date.now();
  if (now - lastAlertAt < ALERT_THROTTLE_MS) return;
  lastAlertAt = now;

  const sample = result.failed[0]?.error ?? "unknown error";
  const subject = `⚠️ MMFX TradingView ${result.action} failed (${result.failed.length}/${PINE_SCRIPTS.length})`;
  const text =
    `TradingView ${result.action} failed for "${tvUsername}".\n\n` +
    `${result.succeeded} succeeded, ${result.failed.length} failed.\n` +
    `First error: ${sample}\n\n` +
    (sample.includes("login")
      ? "This looks like a login failure — the TV_PASSWORD may have changed, or TradingView is blocking the login. Members are NOT being granted access until this is fixed."
      : "Some scripts failed. If this persists, check the TV account and pine_ids.") +
    `\n\nTime: ${new Date(now).toISOString()}`;

  await sendAdminAlert(subject, text);
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
