import type { Metadata } from "next";
import { LegalShell, LegalHeading } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Market Makers FX",
  description: "How Market Makers FX collects, uses, and protects your data.",
};

const UPDATED = "24 June 2026";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how Market Makers FX (&quot;MMFX&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, and protects your
        information when you use our website, member app, and related services
        (the &quot;Service&quot;). By using the Service you agree to this Policy.
      </p>

      <LegalHeading>Who we are</LegalHeading>
      <p>
        Market Makers FX provides trading education, market analysis, and
        trading tools for the foreign-exchange and gold (XAU/USD) markets. We
        are not a broker, financial institution, or licensed financial adviser.
        We operate as an Introducing Broker (IB), meaning we may refer users to
        third-party brokers and receive a commission from those brokers.
      </p>

      <LegalHeading>Information we collect</LegalHeading>
      <ul className="list-disc space-y-1.5 pl-5">
        <li><strong>Account data:</strong> your email address and full name, provided at sign-up.</li>
        <li><strong>Authentication:</strong> we use passwordless &quot;magic link&quot; sign-in. We do not collect or store passwords.</li>
        <li><strong>Usage data:</strong> pages visited, features used, and approximate location (country) derived from your IP address, used to tailor the experience (for example, regional upgrade options).</li>
        <li><strong>Third-party identifiers you provide:</strong> e.g. your TradingView username, used solely to grant you access to our indicators and strategies.</li>
        <li><strong>Communications:</strong> messages you send us by email or messaging apps.</li>
      </ul>
      <p>
        We do <strong>not</strong> collect or store your payment-card or
        trading-account credentials. Any broker deposits are made directly with
        the broker, not with MMFX.
      </p>

      <LegalHeading>How we use your information</LegalHeading>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>To provide and maintain the Service and your member access.</li>
        <li>To send service and onboarding emails, and (where permitted) marketing about features and offers — you can unsubscribe at any time.</li>
        <li>To grant and manage access to third-party tools (e.g. TradingView indicators).</li>
        <li>To understand usage and improve the Service.</li>
        <li>To detect, prevent, and address fraud, abuse, or technical issues.</li>
      </ul>

      <LegalHeading>Service providers we share data with</LegalHeading>
      <p>
        We use trusted third parties to operate the Service. Each processes only
        the data needed for its function:
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li><strong>Supabase</strong> — database, authentication, and storage.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>SendPulse</strong> — transactional and marketing email.</li>
        <li><strong>TradingView</strong> — granting access to indicators/strategies (via the username you provide).</li>
        <li><strong>Gumlet</strong> — video hosting for lessons and analysis.</li>
        <li><strong>Meta (Facebook/Instagram)</strong> — advertising and analytics, including the Meta Pixel and custom audiences.</li>
        <li><strong>Partner brokers</strong> — when you choose to open or link a broker account through us.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <LegalHeading>Cookies &amp; tracking</LegalHeading>
      <p>
        We use cookies and similar technologies that are essential to run the
        Service (e.g. keeping you signed in), and advertising/analytics tools
        such as the Meta Pixel to measure and improve our marketing. You can
        control cookies through your browser settings.
      </p>

      <LegalHeading>Data retention</LegalHeading>
      <p>
        We keep your information for as long as your account is active or as
        needed to provide the Service, comply with legal obligations, resolve
        disputes, and enforce our agreements. You may request deletion at any
        time (see below).
      </p>

      <LegalHeading>Your rights</LegalHeading>
      <p>
        Depending on your location, you may have the right to access, correct,
        export, or delete your personal data, and to object to or restrict
        certain processing. To exercise these rights, email{" "}
        <a className="text-orange hover:text-accent-ink" href="mailto:hello@marketmakersfx.net">
          hello@marketmakersfx.net
        </a>
        .
      </p>

      <LegalHeading>Children</LegalHeading>
      <p>
        The Service is not directed to anyone under 18, and we do not knowingly
        collect data from children.
      </p>

      <LegalHeading>Changes to this Policy</LegalHeading>
      <p>
        We may update this Policy from time to time. Material changes will be
        reflected by updating the &quot;Last updated&quot; date above.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        Questions about this Policy or your data? Email{" "}
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
