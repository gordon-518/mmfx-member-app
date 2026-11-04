import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { MetaPixel } from "@/components/MetaPixel";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { MESSAGES } from "@/i18n/messages";

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

// The default title; pages with their own (login, signup...) override it.
export async function generateMetadata(): Promise<Metadata> {
  const { common } = await getT();
  return { title: common.metaTitle, description: common.metaDescription };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf8",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved once, on the server, so the HTML, the client components and the
  // <html lang> that picks the CJK fonts all agree.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MetaPixel />
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
