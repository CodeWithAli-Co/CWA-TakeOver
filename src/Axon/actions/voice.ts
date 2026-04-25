// ───────────────────────────────────────────────────────────────────
// Voice actions — switch and inspect the TTS voice at runtime.
//
// Operator says "Axon, switch to British accent" or "use the warm
// British voice" and the brain calls `set_voice({ id: "british-george" })`.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  VOICE_PRESETS,
  getVoicePreset,
  presetsByAccent,
  type VoiceAccent,
} from "../engine/voiceCatalog";

// Mutator passed in from the provider. We don't import the React
// context here to avoid a cycle; the provider binds this on mount.
type VoiceMutator = (presetId: string | null) => void;
let _setVoicePreset: VoiceMutator | null = null;
let _getCurrentPresetId: (() => string | null) | null = null;

export function _bindVoiceAccessors(
  setPreset: VoiceMutator,
  getPreset: () => string | null
) {
  _setVoicePreset = setPreset;
  _getCurrentPresetId = getPreset;
}

/** Best-effort match of a free-text utterance to a preset id.
 *  Lets brain (or fallback heuristics) say "british male" and have
 *  it resolve to british-george. */
function matchPresetByDescription(text: string): string | null {
  const t = text.toLowerCase();
  // Exact id wins.
  const idMatch = VOICE_PRESETS.find((p) => p.id.toLowerCase() === t);
  if (idMatch) return idMatch.id;
  // Label match.
  const labelMatch = VOICE_PRESETS.find(
    (p) => p.label.toLowerCase() === t || p.label.toLowerCase().startsWith(t)
  );
  if (labelMatch) return labelMatch.id;

  const accentHints: Array<{ acc: VoiceAccent; pat: RegExp }> = [
    { acc: "british", pat: /british|english|uk\b|england|posh/ },
    { acc: "american", pat: /american|us\b|usa|states/ },
    { acc: "australian", pat: /australian|aussie|au\b/ },
  ];
  let accent: VoiceAccent | null = null;
  for (const { acc, pat } of accentHints) {
    if (pat.test(t)) {
      accent = acc;
      break;
    }
  }
  let gender: "male" | "female" | null = null;
  if (/\b(male|man|guy|sir|gentleman)\b/.test(t)) gender = "male";
  else if (/\b(female|woman|lady|girl)\b/.test(t)) gender = "female";

  // Filter by hints; pick highest-priority sort.
  const candidates = VOICE_PRESETS.filter((p) => {
    if (accent && p.accent !== accent) return false;
    if (gender && p.gender !== gender) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.sort - b.sort);
  return candidates[0].id;
}

export const setVoiceAction: AxonAction<
  { id?: string; description?: string },
  { switched: boolean; presetId: string | null; label: string }
> = {
  name: "set_voice",
  description:
    "Switch AXON's TTS voice to a curated preset. Pass `id` for an exact preset (e.g. 'british-george', 'british-lily', 'american-adam') OR `description` for a free-text request like 'British male' or 'warm female English voice'. Available accents: british, american, australian. Use this when the operator asks for a different accent or voice character.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Exact preset id (preferred when known).",
      },
      description: {
        type: "string",
        description:
          "Free-text description like 'British male' or 'soft American female'. Used when id is unknown.",
      },
    },
  },
  handler: async ({ id, description }, ctx) => {
    if (!_setVoicePreset) {
      return { summary: "Voice mutator not bound." };
    }
    let resolved = id ?? null;
    if (!resolved && description) resolved = matchPresetByDescription(description);
    const preset = getVoicePreset(resolved ?? null);
    if (!preset) {
      const ids = VOICE_PRESETS.map((p) => p.id).join(", ");
      return {
        summary: `I don't know that voice. Available presets: ${ids}.`,
        data: { switched: false, presetId: null, label: "" },
      };
    }
    _setVoicePreset(preset.id);
    ctx.logActivity({
      actionName: "set_voice",
      params: { id: preset.id },
      summary: `Switched voice to ${preset.label}`,
    });
    // Speak a short confirmation IN THE NEW VOICE so the operator
    // immediately hears the switch — settling effect.
    setTimeout(() => {
      ctx.speak(`Voice set to ${preset.label.split(" — ")[0]}.`);
    }, 80);
    return {
      summary: `Voice switched to ${preset.label}.`,
      data: { switched: true, presetId: preset.id, label: preset.label },
      // We narrate via ctx.speak above — don't double-speak.
      silent: true,
    };
  },
};

export const listVoicesAction: AxonAction<
  Record<string, never>,
  { presets: Array<{ id: string; label: string; accent: string; gender: string }> }
> = {
  name: "list_voices",
  description:
    "Return the curated TTS voice presets AXON can switch to. Operator can ask 'what voices do you have?' and you'll relay the list.",
  input_schema: { type: "object", properties: {} },
  handler: async (_, _ctx) => {
    const grouped = presetsByAccent();
    const lines: string[] = [];
    for (const acc of ["british", "american", "australian"] as VoiceAccent[]) {
      const items = grouped[acc];
      if (items.length === 0) continue;
      lines.push(
        `${acc[0].toUpperCase() + acc.slice(1)}: ${items.map((p) => p.label).join("; ")}`
      );
    }
    return {
      summary:
        `${VOICE_PRESETS.length} voice presets available. ` + lines.join(" — "),
      data: {
        presets: VOICE_PRESETS.map((p) => ({
          id: p.id,
          label: p.label,
          accent: p.accent,
          gender: p.gender,
        })),
      },
    };
  },
};

export const currentVoiceAction: AxonAction<
  Record<string, never>,
  { presetId: string | null; label: string }
> = {
  name: "current_voice",
  description: "Returns the currently active TTS voice preset.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const cur = _getCurrentPresetId?.() ?? null;
    const preset = getVoicePreset(cur);
    return {
      summary: preset
        ? `Currently using ${preset.label}.`
        : "Currently using the system default voice.",
      data: { presetId: cur, label: preset?.label ?? "system default" },
    };
  },
};

export function registerVoiceActions() {
  registerAction(setVoiceAction);
  registerAction(listVoicesAction);
  registerAction(currentVoiceAction);
}
