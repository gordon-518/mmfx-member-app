"use client";

/** Controlled 6-digit numeric code field. Digits only, max 6, OS autofill of
 *  one-time codes enabled. Shared by signup verification + password reset. */
export function OtpCodeInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      aria-label="6-digit code"
      className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-center text-2xl font-bold tracking-[0.5em] text-ink placeholder:text-faint focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/15"
    />
  );
}
