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
  /** Data URL (JPEG by default, PNG on request). Use Anthropic's image
   *  content block with the matching media_type. */
  dataUrl: string;
  mediaType: "image/png" | "image/jpeg";
  widthPx: number;
  heightPx: number;
}

// PERF: Anthropic's vision endpoint resizes anything over ~1568px on either
// side before inference, so sending larger images just burns upload bandwidth
// and token budget. We render with html2canvas, then hard-clamp the output
// to MAX_DIM on the longer side via a second canvas, and re-encode as JPEG
// (screenshots compress ~10x better than PNG for virtually no quality loss
// on UI content at this size).
const MAX_DIM = 1568;
const JPEG_QUALITY = 0.85;

/**
 * Attempt to capture the visible page (minus AXON UI).
 * Returns null if html2canvas isn't available or capture fails.
 *
 * Output is always clamped to {@link MAX_DIM} on its longer side and
 * encoded as JPEG unless `format: "png"` is explicitly requested.
 */
export async function captureScreenshot(opts?: {
  /** CSS-width cap passed to html2canvas before render. Default 1568. */
  maxWidth?: number;
  /** html2canvas scale override. Default auto-fit to maxWidth. */
  scale?: number;
  /** Output format. JPEG is much smaller; PNG preserves lossless text. */
  format?: "png" | "jpeg";
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
  const maxWidth = opts?.maxWidth ?? MAX_DIM;
  const scale =
    opts?.scale ?? Math.min(1, maxWidth / Math.max(scope.offsetWidth, 1));

  try {
    const raw: HTMLCanvasElement = await html2canvas(scope, {
      useCORS: true,
      logging: false,
      backgroundColor: null,
      scale,
      // Exclude AXON's own UI so it doesn't scrape its own reflection.
      ignoreElements: (el: Element) => !!el.closest("[data-axon]"),
    });

    // Post-render clamp: html2canvas respects `scale` for width but not
    // height, so a tall scrollable region can still come out > MAX_DIM on
    // the vertical axis. Downscale here if either dimension overshoots.
    const finalCanvas = clampCanvas(raw, MAX_DIM);

    const format = opts?.format ?? "jpeg";
    const mediaType = format === "png" ? "image/png" : "image/jpeg";
    const dataUrl =
      format === "png"
        ? finalCanvas.toDataURL("image/png")
        : finalCanvas.toDataURL("image/jpeg", JPEG_QUALITY);

    return {
      dataUrl,
      mediaType,
      widthPx: finalCanvas.width,
      heightPx: finalCanvas.height,
    };
  } catch (e) {
    console.warn("[AXON] screenshot failed:", e);
    return null;
  }
}

/**
 * Returns a canvas whose longer side is ≤ maxDim. If the input already fits,
 * it is returned unchanged. Otherwise the content is drawn onto a new canvas
 * scaled down uniformly.
 */
function clampCanvas(
  src: HTMLCanvasElement,
  maxDim: number,
): HTMLCanvasElement {
  const longest = Math.max(src.width, src.height);
  if (longest <= maxDim) return src;

  const ratio = maxDim / longest;
  const w = Math.round(src.width * ratio);
  const h = Math.round(src.height * ratio);

  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const ctx = dst.getContext("2d");
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return dst;
}

/** Convert data URL → base64 body (strip the "data:...;base64," prefix). */
export function dataUrlToBase64(url: string): string {
  const i = url.indexOf(",");
  return i === -1 ? url : url.slice(i + 1);
}
