"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { Icons } from "@/components/ui/icons";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme-script";
import { cn } from "@/lib/utils";

/**
 * Theme handling.
 *
 * Three states, matching what people expect of an appearance setting: follow
 * the system, or pin light or dark. Only an explicit choice is stored, so a
 * user who never touches it keeps tracking their OS.
 *
 * The preference lives in localStorage and the OS setting in a media query —
 * both are external stores, so they are read through `useSyncExternalStore`
 * rather than mirrored into state by an effect. That keeps the server and
 * client snapshots explicit and avoids a render pass whose only job is to
 * catch up with the DOM.
 *
 * The resolved theme is stamped twice on `<html>`: `.dark` is what shadcn's
 * variant selector keys off, and `data-theme` is what the charts read, since a
 * Recharts fill needs a real colour value rather than a CSS variable.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export { THEME_INIT_SCRIPT, THEME_STORAGE_KEY };

const MEDIA = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Another tab changing the preference, and the OS switching appearance.
  const media = window.matchMedia(MEDIA);
  window.addEventListener("storage", emit);
  media.addEventListener("change", emit);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", emit);
    media.removeEventListener("change", emit);
  };
}

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Private browsing or blocked storage — follow the system instead.
    return "system";
  }
}

/**
 * Snapshot as a single string so it stays referentially stable between reads;
 * returning an object here would make React think the store changed on every
 * render.
 */
function snapshot(): string {
  const preference = storedPreference();
  const resolved =
    preference === "system"
      ? window.matchMedia(MEDIA).matches
        ? "dark"
        : "light"
      : preference;
  return `${preference}:${resolved}`;
}

/** The server cannot know either value; the pre-paint script corrects it. */
function serverSnapshot(): string {
  return "system:light";
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [preference, resolved] = value.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the choice still applies to this page.
    }
    // `storage` only fires in other tabs, so this one is told directly.
    emit();
  }, []);

  return { preference, resolved, setPreference };
}

/** Keeps `<html>` in step with the resolved theme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return <>{children}</>;
}

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: "sun" | "monitor" | "moon";
}[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "system", label: "System", icon: "monitor" },
  { value: "dark", label: "Dark", icon: "moon" },
];

/** Three-way appearance control for the top bar. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        const Icon = Icons[option.icon];

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={`${option.label} appearance`}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-all duration-200",
              active
                ? "bg-card text-heading shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
