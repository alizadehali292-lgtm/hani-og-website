import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hani Beauty & Hair — Kampaamo & kauneushoitola, Helsinki",
    template: "%s — Hani Beauty & Hair",
  },
  description:
    "Rauhallinen kampaamo ja kauneushoitola Töölössä, Helsingissä. Leikkaukset, värjäykset, raidat ja balayage, permanentit, kampaukset ja meikit. Varaa aika verkossa.",
  applicationName: "Hani Beauty & Hair",
  keywords: [
    "kampaamo Helsinki",
    "parturi Helsinki",
    "kampaamo Töölö",
    "hair salon Helsinki",
    "balayage Helsinki",
    "hiustenpidennys Helsinki",
  ],
  authors: [{ name: "Hani Beauty & Hair" }],
  openGraph: {
    type: "website",
    locale: "fi_FI",
    url: SITE_URL,
    siteName: "Hani Beauty & Hair",
    title: "Hani Beauty & Hair — Kampaamo & kauneushoitola, Helsinki",
    description:
      "Rauhallinen kampaamo ja kauneushoitola Töölössä. Varaa aika verkossa.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fi"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
