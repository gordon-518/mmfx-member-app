import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { DemoPitch } from "./DemoPitch";

// The member app has no public homepage — the marketing site (mmfx-site)
// owns that. The root of this app is the desk.
//
// A demo tenant is the exception: its root is the partner pitch, with a
// "tour the desk" button that uses the showcase link so a prospect lands
// signed in as the demo member without an account.
export default function Home() {
  if (!BRAND.demo) redirect("/dashboard");
  const token = process.env.SHOWCASE_TOKEN;
  return <DemoPitch tourHref={token ? `/showcase?token=${encodeURIComponent(token)}` : "/login"} />;
}
