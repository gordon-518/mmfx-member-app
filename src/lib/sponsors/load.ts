// Everything the sponsor view needs, loaded in one call so the page stays a
// thin branch and the view can be a plain function of data.

import type { FunnelClient } from "@/lib/partners/funnel";
import {
  fetchSponsorClients,
  fetchSponsorFunnel,
  parsePage,
  parseSponsorRange,
  type ClientsPage,
  type SponsorFunnelRow,
  type SponsorRange,
} from "./funnel";
import { dealStart, fetchWindows, type SponsorWindow } from "./windows";

export type Search = Record<string, string | string[] | undefined>;

export interface SponsorData {
  windows: SponsorWindow[];
  range: SponsorRange;
  rows: SponsorFunnelRow[];
  clients: ClientsPage;
}

export async function loadSponsorData(db: FunnelClient, slug: string, sp: Search, now: Date = new Date()): Promise<SponsorData> {
  const windows = await fetchWindows(db, slug);
  const range = parseSponsorRange(sp, dealStart(windows), now);
  const page = parsePage(sp.page);
  const args = { slug, since: range.since, until: range.until };
  const [rows, clients] = await Promise.all([fetchSponsorFunnel(db, args), fetchSponsorClients(db, { ...args, page })]);
  return { windows, range, rows, clients };
}
