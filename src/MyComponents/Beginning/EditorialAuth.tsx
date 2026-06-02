/**
 * EditorialAuth.tsx — CWA TakeOver authentication (editorial variant).
 *
 * Modern editorial SaaS sign-in, inspired by Notion / Linear / Vercel
 * auth pages. This is the currently-shipped look; the previous
 * cyberpunk-HUD variant lives in CyberpunkAuth.tsx.
 *
 *   · Split screen (md+) with a branded statement on the left and a
 *     minimal centered PIN form on the right.
 *   · Left side: giant display typography establishing what TakeOver is,
 *     a slowly rotating hexagon wireframe for brand character, and two
 *     drifting soft-red aurora orbs behind it.
 *   · Right side: breathing room, "Welcome back" headline, circular PIN
 *     dots (not squares), borderless typography-first keypad, single
 *     Continue button. Auto-submits when the 4th digit lands.
 *   · On narrow screens, the brand side drops and only the auth panel
 *     shows — same pattern as every modern SaaS sign-in.
 *
 * All auth logic is preserved: hard-coded "8821" PIN, setPinCheck on
 * success, Tauri dialog on failure, OrionAnimation intro on mount.
 */

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Delete } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────
// PinDot — a single PIN position. Small circle, outlined when empty,
// solid + soft glow when filled. Scales in smoothly to feel responsive.
// ────────────────────────────────────────────────────────────────────────
const PinDot: React.FC<{
  filled: boolean;
  error: boolean;
}> = ({ filled, error }) => (
  <div
    className={`h-3 w-3 rounded-full border-2 transition-all duration-200 ${
      error
        ? "border-red-400 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]"
        : filled
          ? "border-red-500 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
          : "border-zinc-700 bg-transparent"
    }`}
  />
);

// ────────────────────────────────────────────────────────────────────────
// KeypadKey — borderless, typography-first. No box, no bracket. Just a
// number that lifts on hover and depresses on tap. Del key uses an icon.
// ────────────────────────────────────────────────────────────────────────
const KeypadKey: React.FC<{
  value: number | "del" | null;
  onPress: () => void;
}> = ({ value, onPress }) => {
  if (value === null) return <div aria-hidden />;

  const isDel = value === "del";
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className={`group h-14 rounded-full text-2xl font-light flex items-center justify-center transition-colors duration-150 ${
        isDel
          ? "text-zinc-500 hover:text-red-400"
          : "text-zinc-200 hover:text-white"
      } hover:bg-zinc-900/70`}
    >
      {isDel ? <Delete className="h-5 w-5" /> : value}
    </motion.button>
  );
};

// ────────────────────────────────────────────────────────────────────────
// AuroraOrbs — two drifting soft-red blobs behind the brand side. Slow,
// non-looping-looking motion, heavily blurred for an elegant background.
// ────────────────────────────────────────────────────────────────────────
const AuroraOrbs: React.FC = () => (
  <>
    <motion.div
      className="absolute -top-40 -left-20 h-[520px] w-[520px] rounded-full bg-red-600/18 blur-3xl"
      animate={{ x: [0, 40, -20, 0], y: [0, 20, -10, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-0 -right-20 h-[560px] w-[560px] rounded-full bg-rose-500/14 blur-3xl"
      animate={{ x: [0, -30, 15, 0], y: [0, -20, 10, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
    />
  </>
);

// ────────────────────────────────────────────────────────────────────────
// HexagonWireframe — centered decorative element on the brand side. A
// large hexagon that slowly rotates, plus a dashed outer ring. Callback
// to the CWA hex logo without being the literal logo.
// ────────────────────────────────────────────────────────────────────────
const HexagonWireframe: React.FC = () => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    animate={{ rotate: 360 }}
    transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
  >
    <svg
      viewBox="0 0 300 300"
      className="w-[58%] max-w-[540px] opacity-[0.12]"
    >
      {/* Outer dashed ring */}
      <circle
        cx="150"
        cy="150"
        r="138"
        fill="none"
        stroke="#ef4444"
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      {/* Inner hex */}
      <polygon
        points="150,30 254,90 254,210 150,270 46,210 46,90"
        fill="none"
        stroke="#ef4444"
        strokeWidth="1.5"
      />
      {/* Counter-rotating cross lines */}
      <line x1="150" y1="30" x2="150" y2="270" stroke="#ef4444" strokeWidth="0.75" />
      <line x1="46" y1="90" x2="254" y2="210" stroke="#ef4444" strokeWidth="0.75" />
      <line x1="254" y1="90" x2="46" y2="210" stroke="#ef4444" strokeWidth="0.75" />
    </svg>
  </motion.div>
);

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────
export default function EditorialAuth() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const queryClient = useQueryClient();
  const [showContent, setShowContent] = useState(false);
  const [, setPinValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, [setIsLoggedIn]);

  // Stable reference — prevents re-running OrionAnimation's effect when
  // parent re-renders (learned that lesson last iteration).
  const handleAnimationComplete = useCallback(() => {
    setTimeout(() => setShowContent(true), 300);
  }, []);

  const form = useForm({
    defaultValues: { pin: "" },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setError(false);
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (value.pin === "8821") {
        // See stores/query.ts — refetch ActiveUser the moment we
        // pass the gate so the sidebar can't get stuck on the
        // "Unknown / Member" empty-cache fallback.
        queryClient.invalidateQueries({ queryKey: ["activeuser"] });
        document.startViewTransition(() => {
          setPinCheck("true");
        });
      } else {
        setError(true);
        setIsLoading(false);
        await message("Invalid PIN. Access denied.", {
          title: "Authentication Failed",
          kind: "error",
        });
      }
    },
  });

  return (
    <>
      <OrionAnimation onAnimationComplete={handleAnimationComplete} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: showContent ? 1 : 0,
          visibility: showContent ? "visible" : "hidden",
        }}
        transition={{ duration: 0.8 }}
        className="relative flex w-screen h-screen bg-black overflow-hidden"
      >
        {/* ═════════════════ LEFT — BRAND STATEMENT (md+) ═════════════════ */}
        <div className="relative hidden md:flex flex-[1.15] flex-col justify-between p-12 lg:p-16 overflow-hidden">
          {/* Background layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-black" />
          <AuroraOrbs />
          <HexagonWireframe />

          {/* Top-left logo mark */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative flex items-center gap-3"
          >
            <img
              src={cwa_logo_full}
              alt=""
              className="h-8 w-auto opacity-80"
              draggable={false}
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">
                CodeWithAli
              </span>
              <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">
                TakeOver
              </span>
            </div>
          </motion.div>

          {/* Middle — big display statement */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative max-w-2xl"
          >
            <h1 className="text-5xl lg:text-[64px] xl:text-[72px] font-bold text-white leading-[1.05] tracking-tight">
              The command
              <br />
              center for{" "}
              <span className="text-red-500 italic font-semibold">
                everything
              </span>
              .
            </h1>
            <p className="mt-6 text-base lg:text-lg text-zinc-400 max-w-lg leading-relaxed">
              One deck for employees, invoicing, timesheets, projections, and
              everything in between. Built for teams who ship.
            </p>
          </motion.div>

          {/* Bottom-left meta */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="relative flex items-center gap-3 text-[11px] text-zinc-600"
          >
            <span>v1.7.0</span>
            <span className="text-zinc-800">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              End-to-end encrypted
            </span>
          </motion.div>
        </div>

        {/* ═════════════════ RIGHT — PIN ENTRY ═════════════════ */}
        <div className="relative flex w-full md:w-[480px] lg:w-[520px] flex-col items-center justify-center bg-zinc-950 border-l border-zinc-900/60 px-8 py-10 shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full max-w-[320px] space-y-8"
          >
            {/* Mobile-only logo (brand side is hidden below md) */}
            <div className="md:hidden flex items-center gap-3">
              <img
                src={cwa_logo_full}
                alt=""
                className="h-7 w-auto opacity-80"
                draggable={false}
              />
              <span className="text-[11px] text-zinc-500 tracking-[0.25em] uppercase">
                TakeOver
              </span>
            </div>

            {/* Headline */}
            <div>
              <h2 className="text-3xl font-semibold text-white tracking-tight">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                Enter your 4-digit PIN to continue.
              </p>
            </div>

            {/* PIN dot row — shakes on error */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLoading) form.handleSubmit();
              }}
              className="space-y-8"
            >
              <form.Field
                name="pin"
                children={(field) => {
                  // Auto-submit once the 4th digit lands — feels more
                  // modern than making the user reach for a button.
                  const handleChange = (next: string) => {
                    setPinValue(next);
                    field.handleChange(next);
                    setError(false);
                    if (next.length === 4 && !isLoading) {
                      // Defer so React can paint the filled dot first,
                      // then kick off the submit animation.
                      setTimeout(() => form.handleSubmit(), 150);
                    }
                  };

                  return (
                    <>
                      <motion.div
                        animate={
                          error
                            ? { x: [0, -10, 10, -6, 6, -3, 3, 0] }
                            : { x: 0 }
                        }
                        transition={{ duration: 0.45 }}
                        className="flex justify-center gap-4"
                      >
                        {[0, 1, 2, 3].map((idx) => (
                          <PinDot
                            key={idx}
                            filled={field.state.value.length > idx}
                            error={error}
                          />
                        ))}
                      </motion.div>

                      {/* Reserved error message line */}
                      <div className="h-4 text-center">
                        <AnimatePresence>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-xs text-red-400"
                            >
                              Incorrect PIN. Try again.
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Hidden input so paste / HW keyboards still work */}
                      <input
                        name={field.name}
                        type="password"
                        className="sr-only"
                        value={field.state.value}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);
                          handleChange(value);
                        }}
                        autoFocus={showContent}
                        maxLength={4}
                      />

                      {/* Keypad — borderless typography */}
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map(
                          (num, i) => (
                            <KeypadKey
                              key={i}
                              value={num as number | "del" | null}
                              onPress={() => {
                                if (num === null) return;
                                if (num === "del") {
                                  handleChange(field.state.value.slice(0, -1));
                                } else if (field.state.value.length < 4) {
                                  handleChange(field.state.value + num);
                                }
                              }}
                            />
                          ),
                        )}
                      </div>

                      {/* Continue button — dims until the PIN has 4 digits */}
                      <motion.button
                        type="submit"
                        disabled={isLoading || field.state.value.length !== 4}
                        whileHover={
                          field.state.value.length === 4 && !isLoading
                            ? { scale: 1.01 }
                            : undefined
                        }
                        whileTap={
                          field.state.value.length === 4 && !isLoading
                            ? { scale: 0.99 }
                            : undefined
                        }
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-full text-[13px] font-medium transition-colors duration-200 ${
                          field.state.value.length === 4 && !isLoading
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-30"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="3"
                              />
                              <path
                                className="opacity-90"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Verifying
                          </>
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </motion.button>
                    </>
                  );
                }}
              />
            </form>

            {/* Footer */}
            <div className="pt-2 text-center text-[11px] text-zinc-600">
              Secured by CWA · Contact an admin if you&apos;re locked out.
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
