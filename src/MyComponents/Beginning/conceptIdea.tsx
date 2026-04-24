/**
 * conceptIdea.tsx — Auth page entry point.
 *
 * This file is imported by the router as `SecurityBreach`. It acts as a
 * thin dispatcher that re-exports whichever auth variant is currently
 * shipped. Swap the export line below to flip between designs:
 *
 *   · EditorialAuth  — modern SaaS split-screen (currently active)
 *   · GlassAuth      — liquid-glass morphism + aurora
 *   · CyberpunkAuth  — hardened-terminal HUD
 *   · OperatorAuth   — wide integrated operator console
 *
 * All four variants share identical auth logic ("8821" PIN, setPinCheck
 * on success, Tauri error dialog, OrionAnimation intro) — only the
 * visual language differs, so flipping between them is safe.
 */

export { default } from "./EditorialAuth";
