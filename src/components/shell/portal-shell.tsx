"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ADMIN_NAV, NAV_ITEMS, type NavItem } from "@/components/shell/nav-items";
import { ThemeToggle } from "@/components/theme/theme";
import { CfosmeMark } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/components/ui/primitives";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

/**
 * Portal chrome.
 *
 * Built on shadcn's Sidebar rather than the hand-rolled `fixed` panel this
 * replaced. That one was desktop-only and permanent: there was no way to
 * reclaim the 240px, and the phone drawer was a second copy of the same
 * markup. The component brings the parts that were missing — a desktop
 * toggle, collapse to an icon rail, ⌘/Ctrl+B, the state remembered in a
 * cookie so it survives navigation, and the mobile sheet with its focus trap
 * and scroll lock.
 */
export function PortalShell({
  user,
  defaultOpen,
  children,
}: {
  user: {
    name: string;
    clientName: string | null;
    role: string;
    isPlatformAdmin: boolean;
  };
  /** Read from the sidebar cookie on the server, so it does not flash open. */
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  // This region, not the window, is what scrolls, so the router's own
  // scroll-to-top on navigation lands on the wrong element: without this a
  // new page opens halfway down where the last one was left.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <PortalSidebar user={user} />

      {/*
        The sidebar floats 8px in from the window edge, so the content panel
        does too, and keeps the same 8px on the other three sides.

        The panel is a fixed-height column that clips: the header is a flex
        child at the top, and only the region beneath it scrolls. That is what
        keeps its rounded corners at the top of the window whatever the scroll
        position — and what keeps the scrollbar out of the header, which it
        crossed when the whole panel was the scrollport.
      */}
      <SidebarInset className="min-w-0 transition-[margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:my-2 md:mr-2 md:h-[calc(100svh-(--spacing(4)))] md:overflow-hidden md:rounded-[var(--radius-card)] md:ring-1 md:ring-foreground/5">
        <header className={cn(
            "glass no-print z-30 flex min-h-16 shrink-0 items-center gap-2",
            "border-b border-border/70 px-3 py-2.5 sm:gap-3 sm:px-6",
            // Not sticky: it is a flex child above the scrolling region, so
            // nothing passes over or under it and it needs no z-juggling.
            "max-md:sticky max-md:top-0",
          )}>
          <SidebarTrigger className="size-9 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-heading sm:text-base">
              Pulse Pro
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.clientName ?? "CFOSME"} &middot; Task Register
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <PrintButton />
            <form action="/api/auth/logout" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="lg"
                aria-label="Log out"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Icons.logout className="size-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </form>
          </div>
        </header>

        {/* The scrolling region. The footer travels with the content rather
            than sitting as a permanent bar, because it is the end of the
            page, not a status line. */}
        <div
          ref={scrollRef}
          className="panel-scroll print-full flex min-w-0 flex-1 flex-col md:overflow-y-auto"
        >
          <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5">
            {children}
          </main>

          <footer className="no-print px-4 pb-6 text-center text-xs text-muted-foreground sm:px-6">
            CFOSME Pulse Pro &middot; Confidential client information
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PortalSidebar({
  user,
}: {
  user: { name: string; clientName: string | null; isPlatformAdmin: boolean };
}) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      // The inner panel on desktop, and the sheet itself on phones.
      className="no-print [&_[data-sidebar=sidebar]]:glass-sidebar"
    >
      <SidebarHeader className="gap-0">
        <Link
          href="/dashboard"
          aria-label="CFOSME Pulse Pro"
          className={cn(
            // 8px inside the panel, so it takes the panel's radius less 8px.
            "flex items-center gap-2.5 rounded-[var(--radius-inset-2)] py-2",
            "transition-[background-color,gap] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-sidebar-accent",
            // The gap closes with the wordmark, or the mark stays pushed off
            // the rail's centre line by an empty 10px.
            "group-data-[collapsible=icon]:gap-0",
            // On the rail there is no room for the padding, and the mark has
            // to sit in the middle of the 3rem column rather than hard left.
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
          )}
        >
          {/* Deliberately not a SidebarMenuButton: that forces every glyph
              inside it to 16px, which is what shrank the mark to a speck. */}
          <CfosmeMark size={32} className="w-8 shrink-0 text-sidebar-primary" />
          <span className={cn(
              "min-w-0 overflow-hidden text-xl leading-none font-extrabold tracking-wide whitespace-nowrap text-sidebar-foreground",
              "transition-[opacity,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              // Fades *and* gives up its width: fading alone left an
              // invisible label holding the mark 5px off centre on the rail.
              "group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0",
            )}>
            CFOS<span className="text-sidebar-primary">ME</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Views" items={NAV_ITEMS} pathname={pathname} />
        {user.isPlatformAdmin && (
          <NavGroup label="Administration" items={ADMIN_NAV} pathname={pathname} />
        )}
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Account settings"
              isActive={pathname === "/account"}
              render={<Link href="/account" />}
              // The rail squeezes this to a 32px square. Two stacked lines of
              // name and client do not survive that, so they are dropped and
              // the icon is centred — the tooltip still says where it goes.
              className="group-data-[collapsible=icon]:justify-center"
            >
              <Icons.person className="shrink-0" />
              <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.clientName ?? "CFOSME"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* No SidebarRail: it puts an invisible hit strip in the gutter between
          the two panels, which on a floating sidebar is just an odd dead zone
          beside the edge. The header trigger and ⌘/Ctrl+B already collapse it. */}
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = Icons[item.icon];
            // "/dashboard" must not stay active on "/dashboard/register".
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                >
                  <Icon className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => window.print()}
      aria-label="Print or save as PDF"
      className="hidden sm:inline-flex"
    >
      <Icons.printer className="size-4" />
      <span className="hidden lg:inline">Print / PDF</span>
    </Button>
  );
}
