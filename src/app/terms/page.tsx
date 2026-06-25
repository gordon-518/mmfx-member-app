import type { Metadata } from "next";
import { LegalShell, LegalHeading } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service — Market Makers FX",
  description: "The terms governing your use of Market Makers FX.",
};

const UPDATED = "24 June 2026";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of the Market Makers FX (&quot;MMFX&quot;, &quot;we&quot;, &quot;us&quot;)
        website, member app, and related services (the &quot;Service&quot;). By
        creating an account or using the Service, you agree to these Terms. If
        you do not agree, do not use the Service.
      </p>

      <LegalHeading>1. What we provide</LegalHeading>
      <p>
        MMFX provides trading <strong>education</strong>, market analysis,
        commentary, and trading tools for the foreign-exchange and gold markets.
        We are <strong>not</strong> a broker, financial institution, fund, or
        licensed financial adviser, and we do not hold client funds.
      </p>

      <LegalHeading>2. Not financial advice</LegalHeading>
      <p>
        All content, signals, analysis, indicators, and tools are provided for
        <strong> educational and informational purposes only</strong>. Nothing
        on the Service is financial, investment, legal, or tax advice, a
        recommendation, or an offer or solicitation to buy or sell any
        instrument. You are solely responsible for your own trading decisions.
        You should seek independent professional advice where appropriate.
      </p>

      <LegalHeading>3. Risk disclosure</LegalHeading>
      <p>
        Trading foreign exchange, gold, CFDs, and other leveraged products
        carries a <strong>high level of risk</strong> and can result in the loss
        of some or all of your capital. These products may not be suitable for
        everyone. Past performance is not indicative of future results. Any
        signals or analysis represent opinions and may be wrong. Only trade with
        capital you can afford to lose.
      </p>

      <LegalHeading>4. Eligibility &amp; accounts</LegalHeading>
      <p>
        You must be at least 18 and able to form a binding contract. You are
        responsible for activity under your account and for keeping access to
        your email secure (sign-in is via a magic link sent to your email).
        Provide accurate information and keep it current.
      </p>

      <LegalHeading>5. Trial &amp; access</LegalHeading>
      <p>
        New members receive a free trial period of full access. Continued access
        after the trial is obtained by funding a trading account with one of our
        partner brokers through our referral link — the deposited funds remain
        your own trading capital held by the broker, not a payment to MMFX. In
        certain regions, access is instead offered as a one-time membership
        arranged directly. We may change access terms, features, or pricing at
        any time.
      </p>

      <LegalHeading>6. Introducing Broker disclosure</LegalHeading>
      <p>
        MMFX operates as an Introducing Broker (IB). When you open or link a
        broker account through us, we may receive commissions from that broker
        based on your trading activity. This does not change the fees you pay the
        broker. Your relationship for trading and deposits is with the broker,
        subject to the broker&apos;s own terms.
      </p>

      <LegalHeading>7. Acceptable use</LegalHeading>
      <p>You agree not to:</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Share, resell, or redistribute our content, tools, or member access.</li>
        <li>Reverse-engineer, copy, or scrape the Service or its indicators/strategies.</li>
        <li>Use the Service unlawfully, or to harass, defraud, or harm others.</li>
        <li>Interfere with or attempt to gain unauthorized access to the Service.</li>
      </ul>

      <LegalHeading>8. Intellectual property</LegalHeading>
      <p>
        All content, courses, indicators, strategies, branding, and materials
        are owned by MMFX or its licensors and are protected by law. We grant you
        a limited, personal, non-transferable, revocable licence to access them
        for your own use while your membership is active.
      </p>

      <LegalHeading>9. Third-party services</LegalHeading>
      <p>
        The Service integrates third parties (e.g. TradingView, brokers,
        Telegram, video hosting). Your use of those services is governed by their
        own terms, and we are not responsible for them.
      </p>

      <LegalHeading>10. Disclaimers &amp; limitation of liability</LegalHeading>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind. To the maximum extent permitted by law,
        MMFX is not liable for any trading losses or for any indirect,
        incidental, special, or consequential damages arising from your use of
        the Service. Nothing in these Terms excludes liability that cannot be
        excluded by law.
      </p>

      <LegalHeading>11. Termination</LegalHeading>
      <p>
        We may suspend or terminate your access at any time for breach of these
        Terms or to protect the Service. You may stop using the Service at any
        time.
      </p>

      <LegalHeading>12. Changes</LegalHeading>
      <p>
        We may update these Terms from time to time. Continued use after changes
        means you accept the updated Terms.
      </p>

      <LegalHeading>13. Governing law &amp; contact</LegalHeading>
      <p>
        These Terms are governed by the laws of the jurisdiction in which MMFX is
        established, without regard to conflict-of-laws rules. Questions? Email{" "}
        <a className="text-orange hover:text-accent-ink" href="mailto:hello@marketmakersfx.net">
          hello@marketmakersfx.net
        </a>
        .
      </p>

      <p className="border-t border-line pt-5 text-[13px] text-faint">
        This document is a general template and not legal advice. Have it
        reviewed by qualified counsel for your jurisdiction and registered
        entity before relying on it.
      </p>
    </LegalShell>
  );
}
