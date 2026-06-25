import { requireFull } from "@/lib/access";
import { BotPage } from "../BotPage";
import { CopyBridge } from "./CopyBridge";

// ?app=1 puts the desk in embedded mode: its "Send me a copy" button posts to
// CopyBridge instead of calling its own (now-retired) Make webhook.
const BOT_URL = "https://api.marketmakersfx.net/?app=1";

export default async function FundamentalPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  return (
    <>
      <BotPage
        email={profile.email}
        accountStatus={profile.account_status}
        eyebrow="Bots · Macro"
        title="Fundamental Analysis Desk"
        description="Live macro read on Gold — the current fundamental picture driving XAUUSD."
        botUrl={BOT_URL}
      />
      <CopyBridge origin={new URL(BOT_URL).origin} />
    </>
  );
}
