// Map a raw sync/connect error (MetaApi message, worker error, DB error) into a
// MEMBER-SAFE message for the account card. Members must never see internal
// details — a MetaApi billing message like "top up your account" reads as if
// the trader's own MT5 account needs funding, and DB/provisioning errors are
// noise they can't act on. Those all map to a generic "on our end" message.
//
// Genuinely member-fixable failures (wrong investor password / server / the
// broker rejected the login) stay actionable so they can reconnect.
//
// The RAW string is still stored in journal_accounts.sync_error / state_detail
// for admin + log debugging — this only changes what the member-facing card shows.

export interface FriendlySyncError {
  message: string;
  canReconnect: boolean;
}

const OUR_SIDE =
  "We're having a temporary problem syncing your account on our end — no action needed, it'll retry automatically.";
const MEMBER_FIXABLE =
  "We couldn't connect to your trading account. Please reconnect with your read-only investor password and the server shown on your MT5 login screen.";

// Our-side / infra signals — checked FIRST so an app-level billing, provisioning,
// token, rate-limit, timeout or database error can never be mis-shown as a
// member credential problem.
const OUR_SIDE_RE =
  /top up|balance|billing|payment|quota|deployment|provision|metaapi id|auth-token|unauthorized|forbidden|\btoken\b|rate limit|429|timeout|timed out|network|fetch failed|50\d\b|constraint|duplicate key|row-level|permission denied|does not exist|null value/;

// Narrow, high-confidence credential/broker-rejection signals.
const MEMBER_FIXABLE_RE =
  /invalid account|invalid.*password|wrong password|authentication failed|invalid credentials|\bcredentials\b|investor password|denied by broker|rejected the (login|connection)/;

export function friendlySyncError(
  raw: string | null | undefined
): FriendlySyncError | null {
  if (!raw) return null;
  const s = raw.toLowerCase();

  if (OUR_SIDE_RE.test(s)) return { message: OUR_SIDE, canReconnect: false };
  if (MEMBER_FIXABLE_RE.test(s)) return { message: MEMBER_FIXABLE, canReconnect: true };

  // Ambiguous (e.g. a bare "did not connect (state DEPLOYING)") — prefer the
  // our-side message so we never wrongly tell a member their credentials are bad.
  return { message: OUR_SIDE, canReconnect: false };
}
