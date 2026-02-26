import type { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edge Finder - Sports Arbitrage & Edge Detection",
  description:
    "Industry-leading sports arbitrage platform. Find every edge for every game with real-time odds, line movement tracking, injury analysis, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <Header />
          <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
