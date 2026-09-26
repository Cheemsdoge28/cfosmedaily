import type { Metadata, Viewport } from "next";

import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/theme";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "RISEBIT CFO Dashboard",
    template: "%s · RISEBIT CFO",
  },
  description:
    "Secure multi-client CFO dashboard portal — profitability, liquidity and working capital at a management level.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10233f" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1119" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the script below stamps data-theme before React
    // hydrates, so the server's markup and the client's differ by design.
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        {/*
          Runs before first paint so a dark-mode user never sees a white flash.
          Inline because anything fetched would be too late to matter.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
