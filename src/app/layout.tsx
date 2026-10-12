import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SearchProvider } from "@/components/SearchContext";
import PWAProvider from "@/components/PWAProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#991B1B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "AralSync — Learning Recovery Analytics",
  description:
    "Learning Recovery Analytics Using OMR Diagnostics and AI-Driven Reading Assessment",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AralSync",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <PWAProvider />
        <SearchProvider>{children}</SearchProvider>
      </body>
    </html>
  );
}
