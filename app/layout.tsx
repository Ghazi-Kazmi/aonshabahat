import type { Metadata, Viewport } from "next";
import { Amiri, Cormorant_Garamond, Great_Vibes, Jost, Noto_Nastaliq_Urdu } from "next/font/google";
import { SITE } from "@/lib/wedding";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const sans = Jost({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const urdu = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  weight: ["400", "600"],
});

const arabic = Amiri({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400"],
});

const script = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

const hon = SITE.honorific ? `${SITE.honorific} ` : "";
const couple = `${hon}${SITE.groom} & ${hon}${SITE.bride}`;

export const metadata: Metadata = {
  title: `${couple} · Shadi`,
  description: `Join us as we celebrate the Nikah, Mehndi, Baraat and Valima of ${couple}.`,
  // Stop phones auto-linking numbers/emails/addresses, which rewrites the HTML before hydration.
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: `${couple} · Shadi`,
    description: "Nikah · Mehndi · Baraat · Valima · 17–20 November 2026 · Lahore & Islamabad",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0b08",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${urdu.variable} ${arabic.variable} ${script.variable}`}>
      <body className="is-loading">{children}</body>
    </html>
  );
}
