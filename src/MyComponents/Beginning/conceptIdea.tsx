/**
 * conceptIdea.tsx — Auth page entry point.
 *
 * This file is imported by the router as `SecurityBreach`. It now acts
 * as a thin dispatcher that re-exports whichever auth variant is
 * currently shipped. Swap the export to flip between designs:
 *
 *   · EditorialAuth  — modern SaaS split-screen (currently active)
 *   · CyberpunkAuth  — hardened-terminal HUD (preserved for reuse)
 *
 * Both variants share identical auth logic ("8821" PIN, setPinCheck on
 * success, Tauri error dialog, OrionAnimation intro) — only the visual
 * language differs, so flipping between them is safe.
 */

export { default } from "./EditorialAuth";
