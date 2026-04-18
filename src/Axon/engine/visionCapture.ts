// ───────────────────────────────────────────────────────────────────
// Vision capture.
// Produces a PNG data URL of the currently-visible page (excluding the
// AXON UI itself) so Claude Sonnet's vision can see charts, layouts,
// and anything else the DOM text missed.
//
// Uses html2canvas via dynamic import. If the library isn't installed,
// captureScreenshot returns null and AXON degrades gracefully.
// To enable: `bun add html2canvas`
// ───────────────────────────────────────────────────────────────────

const VISION_KEYWORDS = [
  "see",
  "look",
  "looks like",
  "looking at",
  "what's on",
  "what is on",
  "what am i",
  "on screen",
  "on the screen",
  "on my screen",
  "this chart",
  "the chart",
  "this graph",
  "this page",
  "this view",
  "this layout",
  "this image",
  "this picture",
  "visual",
  "visually",
  "show me what",
  "describe",
  "read this",
  "take a look",
  "screenshot",
  "capture",
];

/** Heuristic: does this user message want visual perception? */
export function suggestsVision(text: string): boolean {
  const t = text.toLowerCase();
  return VISION_KEYWORDS.some((k) => t.includes(k));
}

export interface CapturedScreen {
  /** PNG data URL. Use Anthropic's image content block with base64. */
  dataUrl: string;
  mediaType: "image/png";
  widthPx: number;
  heightPx: number;
}

/**
 * Attempt to capture the visible page (minus AXON UI) as a PNG.
 * Returns null if html2canvas isn't available or capture fails.
 */
export async function captureScreenshot(opts?: {
  maxWidth?: number;
  scale?: number;
}): Promise<CapturedScreen | null> {
  if (typeof window === "undefined") return null;

  // Dynamic import — no hard dep, fails quietly if not installed.
  let html2canvas: any;
  try {
    const mod = await import(/* @vite-ignore */ "html2canvas");
    html2canvas = mod.default ?? mod;
  } catch {
    return null;
  }

  const scope =
    (document.querySelector("#main-section") as HTMLElement) ?? document.body;
  const scale = opts?.scale ?? Math.min(1, (opts?.maxWidth ?? 1600) / scope.offsetWidth);

  try {
    const canvas: HTMLCanvasElement = await html2canvas(scope, {
      useCORS: true,
      logging: false,
      backgroundColor: null,
      scale,
      // Exclude AXON's own UI so it doesn't scrape its own reflection.
      ignoreElements: (el: Element) => !!el.closest("[data-axon]"),
    });
    return {
      dataUrl: canvas.toDataURL("image/png"),
      mediaType: "image/png",
      widthPx: canvas.width,
      heightPx: canvas.height,
    };
  } catch (e) {
    console.warn("[AXON] screenshot failed:", e);
    return null;
  }
}

/** Convert data URL → base64 body (strip the "data:...;base64," prefix). */
export function dataUrlToBase64(url: string): string {
  const i = url.indexOf(",");
  return i === -1 ? url : url.slice(i + 1);
}
