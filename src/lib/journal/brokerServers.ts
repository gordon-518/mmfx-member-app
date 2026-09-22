// Broker server allowlist for the AI Trading Assistant (Gordon, 22 Sep).
//
// The server was free text, and most of what members typed was wrong: the
// broker's company name ("Octa Markets Incorporated"), MT5's status-bar noise
// ("Anti DDos Proxy Server", "Access Server SG #1", "SG #2"), or just the brand
// ("Dupoin"). Every wrong value still provisioned a MetaApi account — which
// bills — and then failed. Demo servers were accepted too: one member journaled
// an "Elev8-Demo2" account, and demo fills teach the coach nothing about how
// they actually trade.
//
// Where the names come from:
//  * Octa's own MT5 tutorial: live is "OctaFX-Real", demo "OctaFX-Demo".
//  * Our own journal_accounts rows: "DupoinMarkets-Real" and "Elev8-Real2" have
//    really synced. Elev8 numbers its servers (Real2, Real10, Live2), so the
//    numbered forms are matched by pattern rather than a fixed list — a member
//    on Elev8-Real7 must not be locked out by a list we forgot to update.
//
// Elev8 and Octa share one broker id (elev8_octa): Elev8 is the brand OctaFX
// members were moved to, and both server families are valid for it.
//
// The lists below are what the dropdown offers. They are not exhaustive — a
// member on a server we haven't listed types it, and it's accepted as long as
// it's shaped like an MT5 server name for THAT broker and isn't a demo.

/**
 * Words that mark a non-live account. The trailing \\w* matters: brokers number
 * these servers ("Elev8-Demo2"), so a closing \\b would miss them.
 */
const DEMO_PATTERN = /\b(demo|practice|trial|test|contest)\w*/i;

/** MT5's status bar appends the access server; the login server is the part before it. */
const ACCESS_SERVER_SUFFIX = /\s*[-–]?\s*access server.*$/i;

interface BrokerServerRule {
  /** Shown in errors. */
  label: string;
  /** Offered in the connect form's dropdown, best-known first. */
  known: string[];
  /** The broker's own name, as it appears in its server names. */
  brand: RegExp;
}

const RULES: Record<string, BrokerServerRule> = {
  dupoin: {
    label: "Dupoin",
    // Gordon's MT5, 22 Sep: Dupoin runs more than one entity.
    known: ["DupoinMarkets-Real", "DupoinInternational-Real"],
    brand: /dupoin/i,
  },
  elev8_octa: {
    label: "Elev8 / Octa",
    known: ["Elev8-Real2", "OctaFX-Real2", "OctaFX-Real"],
    brand: /elev8|octa/i,
  },
};

/**
 * An MT5 server name: brand, a hyphen, then the server ("DupoinInternational-Real",
 * "OctaFX-Real2"). No spaces — that's what separates a real server from the
 * things members pasted instead ("Octa Markets Incorporated", "SG #2",
 * "Anti DDos Proxy Server", or just "Dupoin").
 */
const SERVER_SHAPE = /^[A-Za-z0-9.]+[A-Za-z0-9.-]*-[A-Za-z0-9.-]+$/;

export type ServerCheck =
  | { ok: true; server: string }
  | { ok: false; error: string };

/** The suggestions the connect form offers for a broker. */
export function knownServersFor(brokerId: string): string[] {
  return RULES[brokerId]?.known ?? [];
}

/** Trim, collapse spaces and drop MT5's " Access Server …" status-bar suffix. */
export function normalizeServer(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(ACCESS_SERVER_SUFFIX, "").trim();
}

export function isDemoServer(raw: string): boolean {
  return DEMO_PATTERN.test(raw);
}

/**
 * Validate the server a member typed against the broker they picked. Returns
 * the canonical spelling to store, so the same server is one row and not five
 * casings. Unknown broker ids pass through (the registry already rejected them).
 */
export function validateBrokerServer(raw: string, brokerId: string): ServerCheck {
  const server = normalizeServer(raw ?? "");
  if (server.length < 3) {
    return { ok: false, error: "Enter the server shown on your MT5 login screen." };
  }

  // Demo first: the message should say why, whatever the broker.
  if (isDemoServer(server)) {
    return {
      ok: false,
      error:
        "That's a demo server. The assistant only reviews live trading, so connect the account you actually trade.",
    };
  }

  const rule = RULES[brokerId];
  if (!rule) return { ok: true, server };

  // A server we already know: store our spelling of it.
  const canonical = rule.known.find((k) => k.toLowerCase() === server.toLowerCase());
  if (canonical) return { ok: true, server: canonical };

  // Anything else has to be a plausible server name for THIS broker, so a
  // member on a server we haven't listed can still connect by typing it.
  if (SERVER_SHAPE.test(server) && rule.brand.test(server)) {
    return { ok: true, server };
  }

  return {
    ok: false,
    error: `That doesn't look like a ${rule.label} server. It should look like ${rule.known[0]} — copy it from your MT5 login screen.`,
  };
}
