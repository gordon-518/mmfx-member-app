import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { tvErrorMessage } from "@/lib/tvUsername";

// The TradingView access block shared by /indicators and /strategies: request
// access with a username, or see where access went and correct the handle.
// The page's own words (what gets granted, the request line) come in as props.

const INPUT =
  "rounded-xl border border-line bg-paper px-3.5 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15";

export async function TvAccessBlock({
  action,
  username,
  grantedWhat,
  requestBody,
  errorCode,
}: {
  action: (formData: FormData) => Promise<void>;
  username: string | null;
  /** "all 10 indicators" — what the member should see once access lands. */
  grantedWhat: string;
  requestBody: string;
  /** ?tv_error= from the action's redirect. */
  errorCode: string | null;
}) {
  const tv = (await getT()).tv;
  const error = tvErrorMessage(errorCode, tv.errors);

  return (
    <section className="rise mt-7 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7">
      {username ? (
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" /> {tv.grantedBadge}
          </span>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {rich(fmt(tv.grantedBody, { what: grantedWhat }), {
              username: <span className="font-semibold text-accent-ink">{username}</span>,
            })}
          </p>
          {/* Optional: let them correct the handle */}
          <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
            <input
              name="tradingview_username"
              type="text"
              required
              maxLength={100}
              placeholder={tv.updatePlaceholder}
              className={`w-full py-2.5 sm:w-56 ${INPUT}`}
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
            >
              {tv.update}
            </button>
          </form>
        </div>
      ) : (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{tv.request}</p>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-subtle">{requestBody}</p>
          <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
            <input
              name="tradingview_username"
              type="text"
              required
              maxLength={100}
              placeholder={tv.usernamePlaceholder}
              className={`w-full py-3 sm:w-72 ${INPUT}`}
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              {tv.request}
            </button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-accent-ink">
          ✕ {error}
        </p>
      )}
      <p className="mt-2.5 flex max-w-xl items-start gap-1.5 text-[12px] leading-snug text-faint">
        <span aria-hidden className="text-orange">⚠</span>
        <span>{tv.hint}</span>
      </p>
    </section>
  );
}
