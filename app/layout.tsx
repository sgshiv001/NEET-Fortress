import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = new URL("/neet-fortress-banner.png", origin).toString();
  return {
    title: "NEET Fortress | NEET Exam Security",
    description: "An exam security prototype for protecting NEET question banks and exam papers with access monitoring, paper controls, and audit tools.",
    openGraph: {
      title: "NEET Fortress — Protect the Paper. Preserve the Exam.",
      description: "A prototype command center for NEET exam security and paper integrity.",
      type: "website",
      images: [{ url: image, alt: "NEET Fortress — NEET exam security" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "NEET Fortress — NEET Exam Security",
      description: "Protect the paper. Preserve the exam.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
