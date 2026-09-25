import "server-only";
import { serviceClient } from "@/lib/journal/api";
import type { PartnerClient } from "./auth";
import type { FunnelClient } from "./funnel";

/**
 * The service client, narrowed to the two shapes this feature uses.
 *
 * partners and attribution_touches have RLS on with no policies, and
 * fn_partner_funnel is granted to service_role alone, so the service key is
 * the only way in. supabase-js's `from` and `rpc` are generic enough that
 * assigning the whole client to a narrow structural type blows TypeScript's
 * instantiation depth (TS2589), so the narrowing is done once, here, rather
 * than at every call site.
 */
export function partnerDb(): PartnerClient & FunnelClient {
  return serviceClient() as unknown as PartnerClient & FunnelClient;
}
