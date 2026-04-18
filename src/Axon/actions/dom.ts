// ───────────────────────────────────────────────────────────────────
// DOM actions — AXON reaches into the current page.
//
// fill_input  — type into an input/textarea by label, placeholder, or name.
// click_button — click a button by its visible text.
// read_screen — return the visible text on the page, so the brain can
//               answer "what's on this screen" and resolve "that" / "this".
//
// These actions are intentionally conservative: only AXON-scoped tags are
// ignored, and interactions dispatch native events so React controlled
// inputs pick up the change.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

const AXON_ROOT_SELECTOR = "[data-axon]";

function mainContent(): HTMLElement {
  // Everything outside the AXON UI is fair game. Default to document.body.
  return (
    (document.querySelector("#main-section") as HTMLElement) ??
    document.body
  );
}

function insideAxon(el: Element): boolean {
  return !!el.closest(AXON_ROOT_SELECTOR);
}

function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Flash a focus halo around the element AXON just touched. */
function flashFocusCue(el: Element) {
  el.classList.add("axon-focus-cue");
  window.setTimeout(() => el.classList.remove("axon-focus-cue"), 1900);
}

/** Simulate typing so React onChange fires. */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── fill_input ────────────────────────────────────────────────────

export const fillInputAction: AxonAction<
  { target: string; value: string; submit?: boolean },
  { matched: string | null }
> = {
  name: "fill_input",
  description:
    "Type `value` into the input/textarea that best matches `target`. `target` can be a visible label, placeholder, aria-label, or name. If `submit` is true and the matched input is inside a form, the form is submitted after filling.",
  input_schema: {
    type: "object",
    properties: {
      target: { type: "string", description: "Label, placeholder, or name of the input." },
      value: { type: "string", description: "What to type." },
      submit: { type: "boolean", description: "Submit the form after filling." },
    },
    required: ["target", "value"],
  },
  mutating: true,
  handler: async ({ target, value, submit }, ctx) => {
    const scope = mainContent();
    const needle = normText(target);

    // Search strategy, in order of confidence:
    // 1. An input/textarea whose aria-label matches
    // 2. An input/textarea whose placeholder matches
    // 3. An input/textarea whose name matches
    // 4. A <label for="…"> whose text matches — follow to the input
    const candidates = Array.from(
      scope.querySelectorAll<HTMLElement>("input, textarea")
    ).filter((el) => !insideAxon(el));

    const byAria = candidates.find((el) =>
      normText(el.getAttribute("aria-label") ?? "").includes(needle)
    );
    const byPlaceholder = candidates.find((el) =>
      normText((el as HTMLInputElement).placeholder ?? "").includes(needle)
    );
    const byName = candidates.find((el) =>
      normText(el.getAttribute("name") ?? "").includes(needle)
    );
    let byLabel: HTMLElement | undefined;
    const labels = Array.from(scope.querySelectorAll("label")).filter(
      (l) => !insideAxon(l)
    );
    for (const lbl of labels) {
      if (normText(lbl.textContent ?? "").includes(needle)) {
        const forId = lbl.getAttribute("for");
        if (forId) {
          const el = scope.querySelector(`#${CSS.escape(forId)}`) as HTMLElement | null;
          if (el) {
            byLabel = el;
            break;
          }
        }
        const nested = lbl.querySelector("input,textarea") as HTMLElement | null;
        if (nested) {
          byLabel = nested;
          break;
        }
      }
    }

    const match = byAria ?? byLabel ?? byPlaceholder ?? byName ?? null;
    if (!match) {
      return {
        summary: `I couldn't find an input matching "${target}" on this page.`,
        data: { matched: null },
      };
    }

    if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) {
      match.focus();
      setInputValue(match, value);
      flashFocusCue(match);
      if (submit && match.form) {
        // Defer submission a tick so React state catches up.
        setTimeout(() => match.form?.requestSubmit?.(), 50);
      }
      ctx.logActivity({
        actionName: "fill_input",
        params: { target, value: value.length > 80 ? value.slice(0, 80) + "…" : value },
        summary: `Filled "${target}" with ${value.length} chars`,
      });
      return {
        summary: `Filled "${target}".`,
        data: { matched: match.getAttribute("name") ?? match.id ?? null },
      };
    }

    return {
      summary: `Matched something but it's not a typeable input.`,
      data: { matched: null },
    };
  },
};

// ── click_button ──────────────────────────────────────────────────

export const clickButtonAction: AxonAction<
  { label: string },
  { clicked: boolean }
> = {
  name: "click_button",
  description:
    "Click a button on the current page, matched by its visible label (case-insensitive substring).",
  input_schema: {
    type: "object",
    properties: {
      label: { type: "string", description: "Visible text or aria-label." },
    },
    required: ["label"],
  },
  mutating: true,
  handler: async ({ label }, ctx) => {
    const needle = normText(label);
    const scope = mainContent();
    const clickable = Array.from(
      scope.querySelectorAll<HTMLElement>(
        'button, [role="button"], a[href], input[type="submit"], input[type="button"]'
      )
    ).filter((el) => !insideAxon(el));

    const match = clickable.find((el) => {
      const t = normText(el.textContent ?? "");
      const aria = normText(el.getAttribute("aria-label") ?? "");
      return t.includes(needle) || aria.includes(needle);
    });

    if (!match) {
      return { summary: `I don't see a button called "${label}" here.`, data: { clicked: false } };
    }

    flashFocusCue(match);
    // Brief delay so the user perceives the halo before the action.
    window.setTimeout(() => match.click(), 140);
    ctx.logActivity({
      actionName: "click_button",
      params: { label },
      summary: `Clicked "${label}"`,
    });
    return { summary: `Clicked "${label}".`, data: { clicked: true } };
  },
};

// ── read_screen ───────────────────────────────────────────────────

export const readScreenAction: AxonAction<
  { limit?: number },
  { text: string }
> = {
  name: "read_screen",
  description:
    "Return a compact representation of the visible text on the current page. Use this when the operator refers to 'this', 'that', or 'what's on screen'. The return value is truncated to a reasonable size.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max characters. Default 2500." },
    },
  },
  handler: async ({ limit = 2500 }, _ctx) => {
    const scope = mainContent();
    // Grab visible text and compact it.
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const chunks: string[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const parent = n.parentElement;
      if (!parent) continue;
      if (insideAxon(parent)) continue;
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const t = (n.textContent ?? "").trim();
      if (t) chunks.push(t);
    }
    let text = chunks.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > limit) text = text.slice(0, limit) + "…";
    return {
      summary: `Read ${text.length} characters from the page.`,
      data: { text },
      silent: true,
    };
  },
};

export function registerDomActions() {
  registerAction(fillInputAction);
  registerAction(clickButtonAction);
  registerAction(readScreenAction);
}
