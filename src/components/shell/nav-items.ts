import type { IconName } from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

/** The seven CFO modules, in the order the SOP lists them. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Executive Dashboard", icon: "grid" },
  { href: "/dashboard/pnl", label: "Profit & Loss", icon: "chart" },
  { href: "/dashboard/cash-flow", label: "Cash Flow", icon: "cash" },
  { href: "/dashboard/receivables", label: "Receivables", icon: "receivable" },
  { href: "/dashboard/payables", label: "Payables", icon: "payable" },
  { href: "/dashboard/bank", label: "Bank & Liquidity", icon: "bank" },
  { href: "/dashboard/mis", label: "MIS Reports", icon: "report" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Clients", icon: "users" },
  { href: "/admin/integrations", label: "Zoho Integration", icon: "plug" },
  { href: "/admin/audit", label: "Audit Log", icon: "shield" },
];
