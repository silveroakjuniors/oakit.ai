import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oakit.ai — AI-Powered School Management Platform",
  description:
    "The smartest way to run your school. AI curriculum planning, parent engagement, teacher tools, and school operations — all in one platform. Rooted Fearlessly.",
  keywords: [
    "school management software",
    "AI education platform",
    "curriculum management",
    "preschool software India",
    "teacher planning tool",
    "parent engagement app",
    "school operations",
    "oakit",
    "school ERP",
  ],
  openGraph: {
    title: "Oakit.ai — The Smartest Way to Run Your School",
    description:
      "AI curriculum planning, parent engagement, and school operations — all in one beautiful platform built for preschools and primary schools.",
    type: "website",
    url: "https://oakit.ai",
    siteName: "Oakit.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Oakit.ai — AI-Powered School Management",
    description:
      "Curriculum planning, parent engagement, and school operations — powered by AI. Start free.",
  },
  metadataBase: new URL("https://oakit.ai"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
