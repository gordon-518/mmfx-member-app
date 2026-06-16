import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

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
  title: "Market Makers FX — Member Access",
  description:
    "Member access for Market Makers FX — gold trading education, signals, and community.",
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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
