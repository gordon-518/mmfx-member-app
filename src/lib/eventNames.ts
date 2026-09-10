// App event names and the client-click sanitiser (conversion-fix 1.3).
//
// Pure and client-safe: the upgrade page's client component imports the
// types, and the server action uses the guards. The database is the real gate
// — these lists mirror the allowlists in fn_app_event_insert / fn_log_event,
// and a name missing from the database is rejected there regardless.

export const APP_EVENTS = [
  "feature_view",
  "tv_username_set",
  "upgrade_viewed",
  "upgrade_broker_link_clicked",
  "upgrade_contact_clicked",
  "deposit_verified",
] as const;

export type AppEvent = (typeof APP_EVENTS)[number];

/** The only events a browser may originate (all fn_log_event accepts). */
export const CLIENT_EVENTS = ["upgrade_broker_link_clicked", "upgrade_contact_clicked"] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export function isClientEvent(v: unknown): v is ClientEvent {
  return typeof v === "string" && (CLIENT_EVENTS as readonly string[]).includes(v);
}

const BROKERS = ["octa", "dupoin", "elev8"] as const;
const FLOWS = ["new", "switch"] as const;
const CHANNELS = ["whatsapp", "telegram"] as const;

export interface ClientEventProps {
  broker?: (typeof BROKERS)[number];
  flow?: (typeof FLOWS)[number];
  channel?: (typeof CHANNELS)[number];
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Keep only the props that belong to this event and hold a known value. The
 * payload comes from the browser, so anything unexpected is dropped rather
 * than stored.
 */
export function sanitizeClientProps(event: ClientEvent, raw: unknown): ClientEventProps {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (event === "upgrade_broker_link_clicked") {
    const out: ClientEventProps = {};
    const broker = pick(r.broker, BROKERS);
    const flow = pick(r.flow, FLOWS);
    if (broker) out.broker = broker;
    if (flow) out.flow = flow;
    return out;
  }
  const channel = pick(r.channel, CHANNELS);
  return channel ? { channel } : {};
}
