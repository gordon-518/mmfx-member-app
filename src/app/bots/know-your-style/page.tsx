import { requireFull } from "@/lib/access";
import { BotPage } from "../BotPage";
import { KysCopyBridge } from "./KysCopyBridge";

// Canonical alias — always the latest KYS build. Frames inline only on origins
// allowed by the KYS app's frame-ancestors CSP (localhost:3000 + the member
// app's production domain once added there).
const BOT_URL = "https://mmfx-know-your-style.vercel.app/";
// ?app=1 puts KYS in embedded mode: its "Send me a copy" button posts the
// result up to KysCopyBridge instead of emailing via the retired Make path.
// The "Open in new tab" launcher stays on the plain BOT_URL.
const EMBED_URL = "https://mmfx-know-your-style.vercel.app/?app=1";

export default async function KnowYourStylePage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  return (
    <>
      <BotPage
        email={profile.email}
        accountStatus={profile.account_status}
        eyebrow="Bots · Profile"
        title="Know Your Style"
        description="Discover your trader archetype — answer a few questions and get a personalized profile."
        botUrl={BOT_URL}
        embedUrl={EMBED_URL}
      />
      <KysCopyBridge origin={new URL(BOT_URL).origin} />
    </>
  );
}
