import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grocer-Eaze | Good food, less fuss",
  description: "Personalized meal plans, budget-aware grocery lists, and a calmer week.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
