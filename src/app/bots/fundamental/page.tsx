import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { BotPage } from "../BotPage";
import { CopyBridge } from "./CopyBridge";

// ?app=1 puts the desk in embedded mode: its "Send me a copy" button posts to
// CopyBridge instead of calling its own (now-retired) Make webhook.
const BOT_URL = "https://api.marketmakersfx.net/?app=1";

export default async function FundamentalPage() {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("fundamental-desk");
  if (gate.locked) return <LockedFeature feature="fundamental-desk" gate={gate} />;
  const profile = gate.profile;

  return (
    <>
      <BotPage
        email={profile.email}
        accountStatus={profile.account_status}
        memberTier={gate.viewer.tier}
        isAdmin={profile.is_admin}
        eyebrow="Bots · Macro"
        title="Fundamental Analysis Desk"
        description="Live macro read on Gold — the current fundamental picture driving XAUUSD."
        botUrl={BOT_URL}
      />
      <CopyBridge origin={new URL(BOT_URL).origin} />
    </>
  );
}
