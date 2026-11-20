import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TeamFlow Guard — Delivery workspace",
  icons: { icon: "/teamflow-brand-icon.svg" },
  description:
    "A shared, evidence-first delivery workspace for small software teams.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><a className="skip-to-content" href="#main">Skip to main content</a>{children}</body>
    </html>
  );
}
