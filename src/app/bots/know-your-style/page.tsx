import { requireFull } from "@/lib/access";
import { BotPage } from "../BotPage";

const BOT_URL =
  "https://mmfx-know-your-style-vi3nub4mm-market-makers.vercel.app/";

export default async function KnowYourStylePage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

  return (
    <BotPage
      eyebrow="Bots · Profile"
      title="Know Your Style"
      description="Discover your trader archetype — answer a few questions and get a personalized profile."
      botUrl={BOT_URL}
    />
  );
}
