import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

/**
 * The link preview.
 *
 * What this is actually for: the portal's URL gets pasted into WhatsApp and
 * e-mail when someone is given access, and without this it arrives as a bare
 * localhost-looking link with no indication of what it is or who it belongs to.
 *
 * Deliberately says nothing about the data inside. A preview card is rendered by
 * whatever service the link passes through, so it is the one piece of this
 * product that is genuinely public — it carries the product name and the fact
 * that it is private, and no client names, no figures, nothing else.
 *
 * Drawn rather than served as a file so it stays in step with the brand colours,
 * and so there is no second asset to re-export when they change. The mark is the
 * same pulse trace as the favicon and the sidebar.
 */

export const alt = `${SITE_NAME} — private client task register`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // The brand's deep chrome, the same value as --brand-deep.
          background: "linear-gradient(135deg, #0a2c3d 0%, #0e3a4f 55%, #16506b 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        {/* Mark + wordmark, laid out as the sidebar lays them out. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="76" height="76" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#ffffff" fillOpacity="0.14" />
            <path
              d="M6 19.5h4.2l2.4-6.6 2.9 10.2 3.1-13 2.3 9.4 1.8-4h3.3"
              stroke="#87b54b"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>
            <span style={{ color: "#ffffff" }}>CFO</span>
            <span style={{ color: "#87b54b" }}>SME</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            Pulse Pro
          </div>
          <div style={{ fontSize: 34, color: "#b9d4e0", lineHeight: 1.3 }}>
            Client delivery, workload and deadlines — in one register.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            color: "#8fb3c2",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#87b54b",
            }}
          />
          Private portal · sign-in required
        </div>
      </div>
    ),
    size,
  );
}
