import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { MetaPixel } from "@/components/MetaPixel";
import { BRAND, brandCssVars } from "@/lib/brand";

// Display — characterful, warm, modern. Body — clean, friendly, legible.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — Member Access`,
  description:
    `Member access for ${BRAND.name} — gold trading education, signals, and community.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
      // A tenant's accent trio overrides the @theme tokens here, so every
      // bg-orange / text-accent-ink in the tree takes the tenant's colour.
      style={brandCssVars() as React.CSSProperties | undefined}
    >
      <body className="min-h-full flex flex-col">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
