export type PostKind = "analysis_daily" | "analysis_macro" | "library";
export type PostStatus = "queued" | "posting" | "posted" | "failed" | "skipped";
export type LibraryKind = "educational" | "cta";
export type LibraryStatus = "draft" | "approved" | "retired";

/** A single inline button: label + an allowlisted destination slug. */
export interface CtaButton {
  text: string;
  slug: string;
}

export interface ChannelPostRow {
  id: string;
  kind: PostKind;
  status: PostStatus;
  body: string;
  image_url: string | null;
  link_url: string | null;
  scheduled_for: string;
  dedupe_key: string;
  telegram_message_id: number | null;
  source_id: string | null;
  button_set: CtaButton[] | null;
  attempts: number;
  clicks: number;
  reactions: number;
  error: string | null;
}

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  body: string;
  status: LibraryStatus;
  button_set: CtaButton[] | null;
  last_posted_at: string | null;
  times_posted: number;
}

/** Per-item engagement rollup (public.library_engagement view). */
export interface LibraryEngagement {
  item_id: string;
  impressions: number;
  clicks: number;
  reactions: number;
}

/** A reusable pre-generated post image (public.visual_library). */
export interface VisualItem {
  id: string;
  image_url: string;
  status: "active" | "retired";
  last_used_at: string | null;
  times_used: number;
}
