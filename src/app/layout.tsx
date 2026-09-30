import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/theme";
import { SITE_DESCRIPTION, SITE_NAME, canonicalOrigin } from "@/lib/site";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  // Without this, the generated Open Graph image resolves to a relative URL and
  // no link preview can fetch it.
  metadataBase: new URL(canonicalOrigin()),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Private by default. The three pages meant to be read without an account —
  // the sign-in page and the legal documents — opt back in individually, which
  // is the safe direction for the default to point.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: canonicalOrigin(),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
