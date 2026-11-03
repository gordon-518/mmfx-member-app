import { getLocale } from "@/i18n/server";

// Compliance wording is reviewed in English, so the English always shows,
// verbatim. A reader in another language also gets it in theirs, underneath,
// so the warning is understood rather than merely present.
export async function ComplianceText({
  english,
  translated,
  className,
}: {
  english: string;
  translated: string;
  className: string;
}) {
  const locale = await getLocale();
  return (
    <>
      <p lang="en" className={className}>
        {english}
      </p>
      {locale !== "en" && <p className={`mt-1 ${className}`}>{translated}</p>}
    </>
  );
}
