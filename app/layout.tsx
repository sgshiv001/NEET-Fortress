import type { Metadata } from "next";
import "./globals.css";

const title = "Exam Fortress | Exam Security";
const description = "An exam security workspace for schools, colleges, universities, certification bodies, employers, and other organizations.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
