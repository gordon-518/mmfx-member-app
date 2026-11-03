import { getT } from "@/i18n/server";
import { en } from "@/i18n/messages/en";
import { ComplianceText } from "./ComplianceText";

/** The risk warning, verbatim in English plus the reader's language. */
export async function RiskNotice({ className, pastPerformance = false }: { className: string; pastPerformance?: boolean }) {
  const t = await getT();
  const line = (c: typeof t.common) => (pastPerformance ? `${c.riskNotice} ${c.pastPerformance}` : c.riskNotice);
  return <ComplianceText english={line(en.common)} translated={line(t.common)} className={className} />;
}
