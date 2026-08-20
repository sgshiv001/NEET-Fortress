import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = new URL("/og.png", origin).toString();
  return {
    title: "NEET Fortress v4 — Examination Security OS",
    description: "An offline-first command center for resilient NEET examination security, paper generation, auditing and recovery simulation.",
    openGraph: {
      title: "NEET Fortress v4",
      description: "Offline examination security with a seven-layer defensive workflow.",
      type: "website",
      images: [{ url: image, width: 1747, height: 909, alt: "NEET Fortress v4 — Examination Security OS" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "NEET Fortress v4",
      description: "Offline examination security with a seven-layer defensive workflow.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
