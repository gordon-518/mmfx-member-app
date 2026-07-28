export type PostKind = "analysis_daily" | "analysis_macro" | "library";
export type PostStatus = "queued" | "posting" | "posted" | "failed" | "skipped";
export type LibraryKind = "educational" | "cta";
export type LibraryStatus = "draft" | "approved" | "retired";

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
  attempts: number;
  error: string | null;
}

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  body: string;
  status: LibraryStatus;
  last_posted_at: string | null;
  times_posted: number;
}
