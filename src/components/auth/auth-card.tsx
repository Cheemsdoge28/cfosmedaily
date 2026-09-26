import { RisebitCfoWordmark } from "@/components/ui/brand";

/**
 * The frame both signed-out pages sit in.
 *
 * Sign-in and the forced password change had this written out twice, and had
 * drifted: different card widths, a hard-coded second gradient stop, and a
 * heading weight that matched neither. Written once, they cannot drift again.
 *
 * The navy ground is deliberately fixed in both themes — it is the brand
 * surface the wordmark was drawn for, and the card on top carries the theme.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  width = "narrow",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** The password form needs a little more room than the sign-in form. */
  width?: "narrow" | "wide";
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-[135deg,var(--color-navy-800),var(--color-navy-600)] px-4 py-10">
      <div
        className={`animate-rise w-full rounded-2xl bg-card p-8 shadow-[0_25px_70px_rgba(0,0,0,0.33)] ${
          width === "wide" ? "max-w-[26rem]" : "max-w-[24rem]"
        }`}
      >
        {/* The wordmark is navy type with a gold mark, drawn for a light
            ground. On the dark card the navy half of "RISEBIT" all but
            vanishes, so in dark mode it gets the light panel it was designed
            for. In light mode this paints nothing — the card is already the
            right ground, and an extra box around the logo there is clutter. */}
        <div className="mx-auto w-fit rounded-xl dark:bg-white dark:px-4 dark:py-3">
          <RisebitCfoWordmark
            className="mx-auto h-auto w-full max-w-[17rem]"
            priority
          />
        </div>

        <h1 className="mt-6 text-lg leading-6 font-semibold tracking-tight text-heading">
          {title}
        </h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>

        {children}

        {footer}
      </div>
    </main>
  );
}
