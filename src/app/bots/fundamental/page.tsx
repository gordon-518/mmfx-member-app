import { requireFull } from "@/lib/access";
import { BotPage } from "../BotPage";

const BOT_URL = "https://api.marketmakersfx.net/";

export default async function FundamentalPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

  return (
    <BotPage
      eyebrow="Bots · Macro"
      title="Fundamental Analysis Desk"
      description="Live macro read on Gold — the current fundamental picture driving XAUUSD."
      botUrl={BOT_URL}
    />
  );
}
