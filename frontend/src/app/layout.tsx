import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Clarity - Self-Improving AI Visualization",
  description: "Transform raw space photos into realistic renovation visualizations with self-improving AI agents that learn and adapt",
  icons: {
    icon: "/favicon.ico",
  },
  keywords: ["AI", "visualization", "self-improving", "agents", "Weave", "Browserbase", "Gemini"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="continuity-theme">
          <ToastProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
