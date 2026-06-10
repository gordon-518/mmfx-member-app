import { redirect } from "next/navigation";

// The member app has no public homepage — the marketing site (mmfx-site)
// owns that. The root of this app is the desk.
export default function Home() {
  redirect("/dashboard");
}
