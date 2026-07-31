import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grocer-eaze.com"),
  title: "Grocer-Eaze | Better Food, Less Waste",
  description: "Browse family-aware recipes, fill your meal schedule, and turn it into a smarter grocery list.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Grocer-Eaze | Better Food, Less Waste",
    description: "Browse family-aware recipes, fill your meal schedule, and turn it into a smarter grocery list.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Grocer-Eaze — Better Food, Less Waste." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grocer-Eaze | Better Food, Less Waste",
    description: "Browse family-aware recipes, fill your meal schedule, and turn it into a smarter grocery list.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
