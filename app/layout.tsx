import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grocer-eaze.com"),
  title: { default: "Grocer-Eaze | Better Food, Less Waste", template: "%s | Grocer-Eaze" },
  description: "Build a family-aware meal plan, discover recipes, and turn your schedule into one organized grocery list.",
  applicationName: "Grocer-Eaze",
  category: "food and meal planning",
  keywords: ["meal planner", "grocery list", "family meal planning", "gluten-free recipes", "Mediterranean recipes", "school lunches"],
  authors: [{ name: "Grocer-Eaze", url: "https://grocer-eaze.com" }],
  creator: "Grocer-Eaze",
  publisher: "Grocer-Eaze",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Grocer-Eaze",
    title: "Grocer-Eaze | Better Food, Less Waste",
    description: "Build a family-aware meal plan, discover recipes, and turn your schedule into one organized grocery list.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Grocer-Eaze — Better Food, Less Waste." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grocer-Eaze | Better Food, Less Waste",
    description: "Build a family-aware meal plan, discover recipes, and turn your schedule into one organized grocery list.",
    images: ["/og.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Grocer-Eaze",
  url: "https://grocer-eaze.com/",
  description: "A family-aware meal planner and grocery list organizer.",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  offers: [
    { "@type": "Offer", price: "10", priceCurrency: "USD", category: "monthly subscription" },
    { "@type": "Offer", price: "49", priceCurrency: "USD", category: "annual subscription" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
