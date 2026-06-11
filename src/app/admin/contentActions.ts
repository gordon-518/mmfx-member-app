"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const COVERS_BUCKET = "analysis-covers";
const REPORTS_BUCKET = "analysis-reports";

// Accept a bare Gumlet id OR a full embed URL — extract the id.
function extractGumletId(input: string): string {
  const m = input.match(/gumlet\.io\/embed\/([^/?#]+)/);
  return (m ? m[1] : input).trim();
}

// Admin-managed content: daily_analysis + live_classes. Inserts/deletes go
// through the normal authenticated client — RLS (is_admin) is the real gate.
// The getUser + is_admin pre-check here is defense-in-depth and a clean
// rejection. Outcomes surface back to /admin via query params.

function back(params: Record<string, string>): never {
  redirect(`/admin?${new URLSearchParams(params).toString()}`);
}

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    back({ content_error: "Not authorized" });
  }
  return supabase;
}

function revalidateContent() {
  revalidatePath("/admin");
  revalidatePath("/daily-analysis");
  revalidatePath("/live-classes");
}

export async function addDailyAnalysis(formData: FormData) {
  const publishedOn = String(formData.get("published_on") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const gumletId = extractGumletId(String(formData.get("gumlet_id") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const bias = String(formData.get("bias") ?? "").trim();
  const sessionTag = String(formData.get("session_tag") ?? "").trim();
  const isPublished = formData.get("is_published") === "on";
  const cover = formData.get("cover");
  const report = formData.get("report");

  if (!title || !gumletId) {
    back({ content_error: "Daily analysis needs a title and a Gumlet ID" });
  }
  // Gumlet ids are alphanumeric + hyphens — the embed origin is already pinned
  // to play.gumlet.io, so this is correctness/hygiene.
  if (!/^[A-Za-z0-9-]+$/.test(gumletId)) {
    back({ content_error: "Gumlet ID must be alphanumeric (hyphens allowed)" });
  }
  // The <select> is not a trust boundary — allowlist bias server-side too.
  if (bias && !["bullish", "bearish", "neutral"].includes(bias)) {
    back({ content_error: "Invalid bias value" });
  }

  const supabase = await adminClient();

  // Optional uploads — random object names, admin-write RLS on both buckets.
  let coverPath: string | null = null;
  let reportPath: string | null = null;

  if (cover instanceof File && cover.size > 0) {
    // Sanitise the extension from the user filename to plain alphanumerics.
    const rawExt = (cover.name.split(".").pop() || "").toLowerCase();
    const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "png";
    coverPath = `${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(COVERS_BUCKET)
      .upload(coverPath, cover, { contentType: cover.type || "image/png" });
    if (error) back({ content_error: `Cover upload failed: ${error.message}` });
  }

  if (report instanceof File && report.size > 0) {
    reportPath = `${randomUUID()}.pdf`;
    const { error } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(reportPath, report, { contentType: "application/pdf" });
    if (error) back({ content_error: `Report upload failed: ${error.message}` });
  }

  const { error } = await supabase.from("daily_analysis").insert({
    title,
    gumlet_id: gumletId,
    description: description || null,
    ...(publishedOn ? { published_on: publishedOn } : {}),
    ...(bias ? { bias } : {}),
    session_tag: sessionTag || null,
    is_published: isPublished,
    cover_path: coverPath,
    report_path: reportPath,
  });

  if (error) {
    back({ content_error: error.message });
  }
  revalidateContent();
  back({ content_ok: `Added analysis: ${title}` });
}

export async function deleteDailyAnalysis(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) back({ content_error: "Missing entry id" });

  const supabase = await adminClient();

  // Remove associated storage objects first so deletes don't orphan files.
  const { data: row } = await supabase
    .from("daily_analysis")
    .select("cover_path, report_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.cover_path) {
    await supabase.storage.from(COVERS_BUCKET).remove([row.cover_path]);
  }
  if (row?.report_path) {
    await supabase.storage.from(REPORTS_BUCKET).remove([row.report_path]);
  }

  const { error } = await supabase.from("daily_analysis").delete().eq("id", id);

  if (error) {
    back({ content_error: error.message });
  }
  revalidateContent();
  back({ content_ok: "Analysis entry deleted" });
}

export async function addLiveClass(formData: FormData) {
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const zoomUrl = String(formData.get("zoom_url") ?? "").trim();

  if (!startsAt || !title || !zoomUrl) {
    back({ content_error: "Live class needs a start time, title and Zoom URL" });
  }
  // Zoom links are always https — require it (no plaintext http).
  if (!/^https:\/\//.test(zoomUrl)) {
    back({ content_error: "Zoom URL must start with https://" });
  }
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) {
    back({ content_error: "Invalid start time" });
  }

  const supabase = await adminClient();
  const { error } = await supabase.from("live_classes").insert({
    starts_at: when.toISOString(),
    title,
    zoom_url: zoomUrl,
  });

  if (error) {
    back({ content_error: error.message });
  }
  revalidateContent();
  back({ content_ok: `Added live class: ${title}` });
}

export async function deleteLiveClass(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) back({ content_error: "Missing class id" });

  const supabase = await adminClient();
  const { error } = await supabase.from("live_classes").delete().eq("id", id);

  if (error) {
    back({ content_error: error.message });
  }
  revalidateContent();
  back({ content_ok: "Live class deleted" });
}
