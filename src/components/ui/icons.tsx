/**
 * Inline SVG icon set.
 *
 * The originals were base64 blobs and repeated inline `<svg>` strings inside
 * JavaScript template literals. Here they are typed components, so a wrong name
 * is a compile error rather than a blank circle.
 */

type IconProps = { className?: string };

function Svg({
  children,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  grid: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-4H4v4Zm10-11h6V4h-6v5Z" />
    </Svg>
  ),
  chart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 19V5M4 19h17" />
      <path d="m7 15 4-4 3 2 5-6" />
    </Svg>
  ),
  cash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v14M7 12l5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  ),
  receivable: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="4" />
      <path d="M2.5 19c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M14 8h7M17 5l4 3-4 3" />
    </Svg>
  ),
  payable: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="4" />
      <path d="M2.5 19c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M21 8h-7M18 5l-4 3 4 3" />
    </Svg>
  ),
  bank: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9h18M4 9v10M8 9v10M16 9v10M20 9v10M2 19h20M12 4l8 5H4l8-5Z" />
    </Svg>
  ),
  report: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v5h5M8 12h8M8 16h8M8 8h4" />
    </Svg>
  ),
  coins: (p: IconProps) => (
    <Svg {...p}>
      <ellipse cx="8" cy="7" rx="5" ry="2.5" />
      <path d="M3 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5" />
      <ellipse cx="16" cy="12" rx="5" ry="2.5" />
      <path d="M11 12v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" />
    </Svg>
  ),
  gear: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </Svg>
  ),
  trendUp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 17l6-6 4 3 6-7" />
      <path d="M15 7h5v5" />
    </Svg>
  ),
  target: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  doc: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6h16v14H4z" />
      <path d="M8 10h8M8 14h8M8 18h5" />
    </Svg>
  ),
  shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  plug: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 3v6M15 3v6" />
      <path d="M6 9h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 18v3" />
    </Svg>
  ),
  users: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5" />
      <path d="M17 8.5a3 3 0 1 0 0-1M18 14c2 .6 3.2 2.1 3.5 4" />
    </Svg>
  ),
  person: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.1-3.1 3.9-4.8 7-4.8s5.9 1.7 7 4.8" />
    </Svg>
  ),
  menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  printer: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 9V4h10v5" />
      <path d="M5 9h14v7h-3v4H8v-4H5z" />
    </Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Svg>
  ),
  moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
    </Svg>
  ),
  monitor: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  ),
  more: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  ),
  logout: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 5V4H5v16h9v-1" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </Svg>
  ),
} as const;

export type IconName = keyof typeof Icons;
