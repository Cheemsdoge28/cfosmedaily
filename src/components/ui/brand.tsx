import Image from "next/image";

import cfosmeLogo from "../../../public/cfosme-logo.png";

/**
 * Brand assets.
 *
 * Imported rather than referenced by path, and that is the whole point.
 *
 * A string `src="/cfosme-logo.png"` is a stable URL: replace the file with new
 * artwork under the same name and browsers, the Next image optimizer and any CDN
 * in front of them all keep serving what they already have. Importing the file
 * makes the bundler emit it at a content-hashed path
 * (`/_next/static/media/cfosme-logo.<hash>.png`), so the URL changes the moment
 * the bytes do and nothing can serve a stale copy. It also carries the real
 * dimensions, so no call site has to restate them and be wrong later.
 *
 * The logo is the wordmark lifted from the workbook dashboard this replaces,
 * where it was a base64 blob inline in the HTML — 175x60 with a transparent
 * ground, so it sits cleanly on both the light card and the deep sidebar.
 */

/** The wordmark, at whatever width its container gives it. */
export function CfosmeWordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={cfosmeLogo}
      alt="CFOSME"
      sizes="(max-width: 480px) 60vw, 220px"
      className={className}
      priority={priority}
    />
  );
}

/**
 * The sidebar mark.
 *
 * On the collapsed icon rail there is a 32px square and no room for a 175px
 * wordmark, so the rail gets the monogram instead of a logo squeezed to
 * illegibility. Drawn rather than cropped from the PNG, so it stays sharp at any
 * size and takes the sidebar's own colours.
 */
export function CfosmeMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.14" />
      {/*
        A pulse trace — the dashboard is "Pulse Pro", and a rising-then-settling
        line is what a month of a register actually looks like.
      */}
      <path
        d="M6 19.5h4.2l2.4-6.6 2.9 10.2 3.1-13 2.3 9.4 1.8-4h3.3"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
