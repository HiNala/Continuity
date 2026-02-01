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
  title: "Clarity - AI Space Visualization",
  description: "Transform raw space photos into realistic renovation visualizations with self-improving AI agents",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="clarity-theme">
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
