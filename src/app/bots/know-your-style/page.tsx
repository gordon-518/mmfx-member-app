import { requireFull } from "@/lib/access";
import { BotPage } from "../BotPage";

// Canonical alias — always the latest KYS build. Frames inline only on origins
// allowed by the KYS app's frame-ancestors CSP (localhost:3000 + the member
// app's production domain once added there).
const BOT_URL = "https://mmfx-know-your-style.vercel.app/";

export default async function KnowYourStylePage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  return (
    <BotPage
      email={profile.email}
      accountStatus={profile.account_status}
      eyebrow="Bots · Profile"
      title="Know Your Style"
      description="Discover your trader archetype — answer a few questions and get a personalized profile."
      botUrl={BOT_URL}
    />
  );
}
