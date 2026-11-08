import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TeamFlow Guard — Delivery workspace",
  description:
    "A shared, evidence-first delivery workspace for small software teams.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
