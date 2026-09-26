import type { IconName } from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

/**
 * The two views.
 *
 * Deliberately two and not seven. The dashboard this replaces had exactly these —
 * an executive summary and the register behind it — and the register is the thing
 * the practice works in daily. Splitting the summary's cards into separate pages
 * would mean a reader had to visit four of them to learn what one screen already
 * tells them.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Executive Dashboard", icon: "grid" },
  { href: "/dashboard/register", label: "Task Register", icon: "list" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Clients", icon: "grid" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/import", label: "Workbook Import", icon: "upload" },
  { href: "/admin/audit", label: "Audit Log", icon: "shield" },
];
