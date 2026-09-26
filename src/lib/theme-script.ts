/**
 * The pre-paint theme script.
 *
 * Kept in a plain module with no React or server imports so that
 * next.config.ts can import it too: the Content-Security-Policy pins this
 * script by SHA-256 hash rather than relaxing script-src to 'unsafe-inline'.
 * Editing the string therefore changes the hash automatically, and the two can
 * never drift apart.
 */

export const THEME_STORAGE_KEY = "risebit-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var p=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=(p==="light"||p==="dark")?p:(m?"dark":"light");var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.toggle("dark",t==="dark");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
