import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/theme";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "CFOSME Pulse Pro",
    template: "%s · CFOSME Pulse Pro",
  },
  description:
    "CFOSME's task register — client delivery, workload, deadlines and completion at a management level.",
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The nonce the proxy minted for this request. Next stamps it onto the
  // scripts it emits itself; this one is ours, so it has to be passed by hand.
  // Absent in dev, where the policy allows inline scripts outright.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

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
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
