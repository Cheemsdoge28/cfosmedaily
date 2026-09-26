import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Whether the viewport is phone-sized.
 *
 * Written against `useSyncExternalStore` rather than the setState-in-an-effect
 * the shadcn registry ships. That version renders once with the wrong answer
 * and then immediately re-renders — a cascading render the lint rule rejects,
 * and a visible flash of the desktop sidebar on a phone. Subscribing to the
 * media query instead gives the right answer on the first client render.
 *
 * The server has no viewport, so it reports "not mobile": the desktop sidebar
 * is what the markup should contain before hydration.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
