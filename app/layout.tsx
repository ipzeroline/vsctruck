import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const auraSans = Noto_Sans_Thai({
  variable: "--font-aura",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vsctruck.com"),
  title: {
    default: "VSCTruck Dashboard",
    template: "%s | VSCTruck",
  },
  description: "Fleet operations dashboard for fuel, driver audit, Cartrack reports, and Telegram alerts.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://vsctruck.com",
    siteName: "VSCTruck",
    title: "VSCTruck Dashboard",
    description: "Fleet operations dashboard for VSCTruck.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${auraSans.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
