import type { Metadata } from "next";
import { ToastProvider } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Continuity - Self-Improving Design Visualization",
  description:
    "Transform raw photographs of spaces into realistic, professionally staged renovation visualizations using self-improving AI agents.",
  keywords: [
    "AI",
    "design visualization",
    "architecture",
    "interior design",
    "renovation",
    "self-improving agents",
    "Weave",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-white min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
