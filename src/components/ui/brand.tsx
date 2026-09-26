import Image from "next/image";

import cfoWordmark from "../../../public/risebit-cfo-logo.png";
import growthMark from "../../../public/risebit_logo.svg";

/**
 * Brand assets.
 *
 * Imported rather than referenced by path, and that is the whole point.
 *
 * A string `src="/risebit-cfo-logo.png"` is a stable URL: replace the file
 * with new artwork under the same name and browsers, the Next image optimizer
 * and any CDN in front of them all keep serving what they already have — the
 * login page went on showing the previous wordmark long after the file had
 * changed. Importing the file makes the bundler emit it at a content-hashed
 * path (`/_next/static/media/risebit-cfo-logo.<hash>.png`), so the URL changes
 * the moment the bytes do and nothing can serve a stale copy. It also carries
 * the real dimensions, so no call site has to restate them and be wrong later.
 *
 * Two files, each with a surface it belongs on:
 *
 *   risebit_logo.svg      the gold growth mark on a transparent ground — the
 *                         only one that can sit on the navy chrome.
 *   risebit-cfo-logo.png  the full "RISEBIT · CFO Dashboard" wordmark, ground
 *                         removed. The supplied `.webp` had no alpha channel
 *                         and carried a faint near-white gradient (#fafafa at
 *                         the top edge, #fefefe elsewhere) that showed as a
 *                         grey rectangle on a white card; the PNG has no
 *                         opaque near-white pixels left, so it sits cleanly on
 *                         any surface in either theme. The `.webp` is kept
 *                         alongside it as the original.
 */

/** Gold mark alone — for dark backgrounds. */
export function RisebitMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={growthMark}
      alt=""
      width={size}
      height={size}
      // `h-auto` because the reset's `img { max-width: 100% }` can narrow the
      // image inside a tight column while the height attribute holds: one
      // dimension moves, the other does not, and the mark is squashed. Letting
      // height follow width keeps it square whatever the column does.
      className={`h-auto ${className ?? ""}`}
      priority
    />
  );
}

/** Mark plus wordmark, laid out for the navy sidebar. */
export function RisebitLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <RisebitMark size={32} className="w-8 shrink-0" />
      <span className="text-xl leading-none font-extrabold tracking-wide text-white">
        RISE<span className="text-gold">BIT</span>
      </span>
    </div>
  );
}

/** The full CFO Dashboard wordmark, at whatever width its container gives it. */
export function RisebitCfoWordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={cfoWordmark}
      alt="RISEBIT CFO Dashboard"
      sizes="(max-width: 480px) 90vw, 320px"
      className={className}
      priority={priority}
    />
  );
}
