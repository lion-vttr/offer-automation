import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Offer to Contract" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Offer to Contract</Link>
          <nav>
            <Link href="/">Offers</Link>
            <Link href="/offers/new">New offer</Link>
            <Link href="/templates">Templates</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
