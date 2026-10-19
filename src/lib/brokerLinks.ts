// Broker funnel links (see memory mmfx-broker-funnel). Shared by the /upgrade
// flow and the support agent, so there is one copy of every link and number.

// Under the MIB model every IB's traders open accounts through that IB's own
// link, so a tenant overrides these; the defaults are MMFX's.
export const IB_NUMBER = process.env.NEXT_PUBLIC_IB_NUMBER?.trim() || "47807426";
export const OCTA_SIGNUP = `https://clickto.trade/bT8tAZDKvQY?ib=${IB_NUMBER}`;
export const DUPOIN_SIGNUP = process.env.NEXT_PUBLIC_DUPOIN_SIGNUP?.trim() || "https://dupoin.me/ett5od077";
export const OCTA_CHANGE_IB = "https://my.octabroker.com/change-partner-request/";
export const ELEV8_CHANGE_IB = "https://my.elev8.com/change-partner-request/";
export const SWITCH_REASON = "They are assisting me in my trading with signals and analysis.";
/** Opens @marketmakers18bot, where the Welcome and Join/SignUp flows take over. */
export const BOT_LINK = process.env.NEXT_PUBLIC_SUPPORT_BOT_LINK?.trim() || "https://t.me/marketmakers18bot";
