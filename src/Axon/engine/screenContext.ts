// ───────────────────────────────────────────────────────────────────
// Screen Context
// Grab a compact snapshot of the visible page so the brain can resolve
// "that", "this", "the first one" without needing a tool round-trip.
// ───────────────────────────────────────────────────────────────────

const MAX_SCREEN_TEXT = 2200;

function mainContent(): HTMLElement {
  return (
    (document.querySelector("#main-section") as HTMLElement) ??
    document.body
  );
}

/** Pull visible text from the active view, excluding AXON's own UI. */
export function captureScreenContext(): string {
  if (typeof window === "undefined") return "";
  const scope = mainContent();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const parent = n.parentElement;
    if (!parent) continue;
    // Skip AXON's own tree.
    if (parent.closest("[data-axon]")) continue;
    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const t = (n.textContent ?? "").trim();
    if (t) chunks.push(t);
  }
  let text = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (text.length > MAX_SCREEN_TEXT) {
    // Keep both ends — beginning (headings usually) and end (recent items).
    const half = Math.floor(MAX_SCREEN_TEXT / 2);
    text = text.slice(0, half) + " […] " + text.slice(text.length - half);
  }
  return text;
}
