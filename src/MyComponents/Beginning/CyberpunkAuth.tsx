/**
 * CyberpunkAuth.tsx — CWA TakeOver authentication (hardened-terminal variant).
 *
 * Preserved as a standalone component for later reuse. This is the
 * full HUD treatment: 4-corner screen registration marks, card with
 * corner brackets + vertical scan-line sweep, PIN slots with per-slot
 * brackets and a laser-line scan on the active slot, refined keypad
 * with phone-style sub-letters, shimmering Verify button, live mock
 * telemetry meters (CPU/RAM/NET) on the left, session block on the
 * right, and a typewriter bottom console.
 *
 * Auth logic matches EditorialAuth: PIN "8821", setPinCheck on success,
 * Tauri dialog on failure, OrionAnimation intro on mount.
 */

import { useForm } from "@tanstack/react-form";
import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "./particleBackground";
import LiveTime from "../Reusables/liveTime";
import {
  Lock,
  ShieldCheck,
  Fingerprint,
  Activity,
  Cpu,
  Wifi,
  HardDrive,
  Delete,
  AlertOctagon,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────
// HudCorner — L-shaped bracket used both for the 4 screen corners and the
// card corners. Accepts a position prop that rotates the shape into place.
// ────────────────────────────────────────────────────────────────────────
type CornerPos = "tl" | "tr" | "bl" | "br";
const HudCorner: React.FC<{
  pos: CornerPos;
  size?: number;
  className?: string;
}> = ({ pos, size = 18, className = "" }) => {
  const rot =
    pos === "tl" ? 0 : pos === "tr" ? 90 : pos === "br" ? 180 : 270;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`text-red-600/80 ${className}`}
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path
        d="M2 10 V2 H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────────────
// TelemetryMeter — a single animated bar + value used in the left HUD
// panel. The value walks randomly to simulate live data.
// ────────────────────────────────────────────────────────────────────────
const TelemetryMeter: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone?: "primary" | "neutral";
}> = ({ icon, label, value, suffix = "%", tone = "primary" }) => {
  const color =
    tone === "primary" ? "bg-red-600/70" : "bg-red-400/40";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] font-mono text-red-600/60 uppercase tracking-[0.15em]">
        <span className="flex items-center gap-1.5">
          <span className="text-red-500/80">{icon}</span>
          {label}
        </span>
        <span className="text-red-500/80 tabular-nums">
          {value.toFixed(0)}
          {suffix}
        </span>
      </div>
      <div className="relative h-1 bg-red-950/40 rounded-sm overflow-hidden border border-red-900/40">
        <motion.div
          className={`absolute inset-y-0 left-0 ${color}`}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// PinSlot — one digit position in the PIN row. Three states:
//   · empty   — thin bordered square
//   · active  — scanning laser-line sweeps across; glow pulses
//   · filled  — solid red dot (the entered digit is always masked)
// ────────────────────────────────────────────────────────────────────────
const PinSlot: React.FC<{
  filled: boolean;
  active: boolean;
  error: boolean;
}> = ({ filled, active, error }) => {
  return (
    <div
      className={`relative w-12 h-14 rounded-md border-2 overflow-hidden flex items-center justify-center transition-colors duration-200 ${
        error
          ? "border-red-500 bg-red-950/30"
          : filled
            ? "border-red-600/80 bg-red-950/20"
            : active
              ? "border-red-700/60 bg-black/70"
              : "border-red-900/60 bg-black/70"
      }`}
    >
      {/* Corner brackets for every slot */}
      <HudCorner pos="tl" size={8} className="absolute top-0.5 left-0.5" />
      <HudCorner pos="tr" size={8} className="absolute top-0.5 right-0.5" />
      <HudCorner pos="bl" size={8} className="absolute bottom-0.5 left-0.5" />
      <HudCorner pos="br" size={8} className="absolute bottom-0.5 right-0.5" />

      {/* Scanning laser line — only on the active (next-to-be-filled) slot */}
      {active && !filled && !error && (
        <motion.div
          className="absolute inset-x-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent"
          animate={{ top: ["10%", "90%", "10%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Filled indicator — smooth fade+scale in */}
      <AnimatePresence>
        {filled && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`h-3.5 w-3.5 rounded-full ${
              error ? "bg-red-400" : "bg-red-500"
            } shadow-[0_0_10px_rgba(239,68,68,0.6)]`}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// KeypadButton — refined phone-style key. Number on top, sub-label below.
// Press state sinks the button slightly (scale + subtle inner shadow).
// ────────────────────────────────────────────────────────────────────────
const LETTERS: Record<number, string> = {
  1: " ",
  2: "ABC",
  3: "DEF",
  4: "GHI",
  5: "JKL",
  6: "MNO",
  7: "PQRS",
  8: "TUV",
  9: "WXYZ",
  0: " ",
};

const KeypadButton: React.FC<{
  value: number | "del" | null;
  onPress: () => void;
}> = ({ value, onPress }) => {
  if (value === null) {
    return <div />;
  }
  const isDel = value === "del";
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.93 }}
      onClick={onPress}
      className={`group relative h-14 rounded-md overflow-hidden font-mono transition-all duration-150 ${
        isDel
          ? "border border-red-900/70 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:border-red-700/80"
          : "border border-red-900/50 bg-black/60 text-red-400 hover:bg-red-950/40 hover:border-red-800/80 hover:text-red-300"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-red-500/20 group-hover:bg-red-500/50 transition-colors" />

      <span className="relative flex flex-col items-center justify-center gap-0.5">
        {isDel ? (
          <Delete className="h-4 w-4" />
        ) : (
          <>
            <span className="text-lg leading-none">{value}</span>
            {LETTERS[value as number] &&
              LETTERS[value as number].trim().length > 0 && (
                <span className="text-[8px] tracking-[0.2em] text-red-700/70 leading-none">
                  {LETTERS[value as number]}
                </span>
              )}
          </>
        )}
      </span>
    </motion.button>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Typewriter — renders text one char at a time after an optional delay.
// Used for the bottom console lines so they appear in sequence.
// ────────────────────────────────────────────────────────────────────────
const Typewriter: React.FC<{
  text: string;
  delay?: number;
  speed?: number;
}> = ({ text, delay = 0, speed = 18 }) => {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const start = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
    }, delay);
    return () => clearTimeout(start);
  }, [text, delay, speed]);
  return <>{shown}</>;
};

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────
export default function CyberpunkAuth() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const [showContent, setShowContent] = useState(false);
  const [, setPinValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Walking mock telemetry — purely decorative.
  const [telemetry, setTelemetry] = useState({ cpu: 32, ram: 58, net: 14 });
  useEffect(() => {
    const iv = setInterval(() => {
      setTelemetry((t) => ({
        cpu: Math.max(8, Math.min(95, t.cpu + (Math.random() - 0.5) * 14)),
        ram: Math.max(30, Math.min(85, t.ram + (Math.random() - 0.5) * 6)),
        net: Math.max(2, Math.min(65, t.net + (Math.random() - 0.5) * 20)),
      }));
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  // Stable session identifier (mock). Regenerated each mount.
  const sessionId = useRef(
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase(),
    )
      .join("")
      .match(/.{1,4}/g)
      ?.join("-") ?? "0000-0000-0000-0000",
  );

  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, [setIsLoggedIn]);

  // Stable ref so OrionAnimation's effect doesn't re-run every telemetry tick.
  const handleAnimationComplete = useCallback(() => {
    setTimeout(() => setShowContent(true), 300);
  }, []);

  const form = useForm({
    defaultValues: { pin: "" },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setError(false);
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (value.pin === "8821") {
        document.startViewTransition(() => {
          setPinCheck("true");
        });
      } else {
        setError(true);
        setAttempts((a) => a + 1);
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
        className="relative flex flex-col items-center justify-center w-screen h-screen bg-black overflow-hidden"
      >
        {/* Particle network */}
        <ParticleBackground
          particleColor="red"
          lineColor="rgba(255, 0, 0, 0.2)"
          particleCount={120}
          connectionDistance={120}
        />

        {/* Soft radial vignette so the center card stands out */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_60%,rgba(0,0,0,0.85)_100%)] z-0" />

        {/* 4-corner screen registration marks */}
        <HudCorner pos="tl" size={26} className="absolute top-14 left-4 z-10" />
        <HudCorner pos="tr" size={26} className="absolute top-14 right-4 z-10" />
        <HudCorner pos="bl" size={26} className="absolute bottom-24 left-4 z-10" />
        <HudCorner pos="br" size={26} className="absolute bottom-24 right-4 z-10" />

        {/* ═════════════════ TOP STATUS BAR ═════════════════ */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute top-0 left-0 right-0 grid grid-cols-[1fr_auto_1fr] items-center text-[11px] font-mono text-red-600/80 border-b border-red-900/30 bg-black/70 backdrop-blur-sm z-10 px-5 py-2.5"
        >
          <div className="flex items-center gap-4">
            <span className="text-red-500/90">SYS</span>
            <span className="text-red-700/60">·</span>
            <span>TakeOver v1.6.0</span>
            <span className="text-red-700/60">·</span>
            <span className="text-red-700/70">BUILD 4f2c9a</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            <span className="tracking-[0.2em]">SECURE CONNECTION ACTIVE</span>
          </div>
          <div className="flex items-center justify-end gap-4">
            <span className="text-red-700/70">LAT 12ms</span>
            <span className="text-red-700/60">·</span>
            <LiveTime />
          </div>
        </motion.div>

        {/* ═════════════════ LEFT TELEMETRY PANEL (lg+) ═════════════════ */}
        <motion.aside
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="hidden lg:flex absolute left-10 top-1/2 -translate-y-1/2 w-48 flex-col gap-4 z-10"
        >
          <div className="flex items-center gap-2 text-[10px] font-mono text-red-700/80 uppercase tracking-[0.2em] border-b border-red-900/30 pb-2">
            <Activity className="h-3 w-3" /> Telemetry
          </div>
          <TelemetryMeter
            icon={<Cpu className="h-3 w-3" />}
            label="CPU"
            value={telemetry.cpu}
          />
          <TelemetryMeter
            icon={<HardDrive className="h-3 w-3" />}
            label="RAM"
            value={telemetry.ram}
          />
          <TelemetryMeter
            icon={<Wifi className="h-3 w-3" />}
            label="NET"
            value={telemetry.net}
            suffix="ms"
            tone="neutral"
          />
          <div className="text-[9px] font-mono text-red-800/60 pt-2 border-t border-red-900/30 leading-relaxed">
            NODE: axon-01
            <br />
            REGION: us-west-2
            <br />
            TLS: v1.3 / AES-256
          </div>
        </motion.aside>

        {/* ═════════════════ RIGHT SESSION PANEL (lg+) ═════════════════ */}
        <motion.aside
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 w-48 flex-col gap-4 z-10 text-right"
        >
          <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-red-700/80 uppercase tracking-[0.2em] border-b border-red-900/30 pb-2">
            Session <Fingerprint className="h-3 w-3" />
          </div>
          <div className="text-[9px] font-mono text-red-800/60 leading-loose">
            <div className="text-red-700/70 tabular-nums">
              {sessionId.current}
            </div>
            <div>INTERFACE: TAURI</div>
            <div>ROLE: PENDING</div>
            <div>VECTOR: LOCAL</div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-900/30 text-[10px] font-mono text-red-700/80 uppercase tracking-[0.2em]">
            <ShieldCheck className="h-3 w-3" />
            Security
          </div>
          <div className="text-[9px] font-mono text-red-800/60 leading-loose">
            <div>ENCRYPTION: ACTIVE</div>
            <div>
              ATTEMPTS: <span className="text-red-500/80">{attempts}/5</span>
            </div>
            <div>LOCKOUT: OFF</div>
          </div>
        </motion.aside>

        {/* ═════════════════ MAIN AUTH CARD ═════════════════ */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="relative z-10 w-full max-w-md border border-red-900/40 bg-black/85 backdrop-blur-md rounded-md overflow-hidden shadow-[0_0_60px_rgba(127,29,29,0.25)]"
        >
          {/* Card corner brackets */}
          <HudCorner pos="tl" size={14} className="absolute top-1.5 left-1.5 z-20" />
          <HudCorner pos="tr" size={14} className="absolute top-1.5 right-1.5 z-20" />
          <HudCorner pos="bl" size={14} className="absolute bottom-1.5 left-1.5 z-20" />
          <HudCorner pos="br" size={14} className="absolute bottom-1.5 right-1.5 z-20" />

          {/* Slow vertical scan-line sweep */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-[30%] bg-gradient-to-b from-transparent via-red-500/[0.04] to-transparent z-10"
            animate={{ top: ["-30%", "100%"] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 2,
            }}
          />

          {/* Header */}
          <div className="relative border-b border-red-900/50 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 px-5 py-3.5">
            <div className="flex items-center justify-center gap-3">
              <Lock className="h-3.5 w-3.5 text-red-400" />
              <h2 className="text-center font-mono text-[13px] text-red-300 uppercase tracking-[0.3em]">
                Authentication Required
              </h2>
              <Lock className="h-3.5 w-3.5 text-red-400 scale-x-[-1]" />
            </div>
          </div>

          <div className="px-7 py-6 relative">
            {/* Logo with animated ring */}
            <div className="flex justify-center mb-5 relative">
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              >
                <div className="h-24 w-24 rounded-full border border-red-900/40 border-dashed" />
              </motion.div>
              <motion.img
                src={cwa_logo_full}
                alt="CodeWithAli Logo"
                className="relative w-24 h-auto filter drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                draggable={false}
                animate={{
                  filter: [
                    "drop-shadow(0 0 8px rgba(220,38,38,0.4))",
                    "drop-shadow(0 0 14px rgba(220,38,38,0.7))",
                    "drop-shadow(0 0 8px rgba(220,38,38,0.4))",
                  ],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLoading) form.handleSubmit();
              }}
              className="space-y-5"
            >
              <div className="space-y-3">
                <div className="text-center font-mono text-[11px] tracking-[0.25em] uppercase text-red-500/90">
                  Enter security credentials
                </div>

                <form.Field
                  name="pin"
                  children={(field) => (
                    <div className="space-y-5">
                      <motion.div
                        animate={
                          error
                            ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                            : { x: 0 }
                        }
                        transition={{ duration: 0.45 }}
                        className="flex justify-center gap-3"
                      >
                        {[0, 1, 2, 3].map((idx) => (
                          <PinSlot
                            key={idx}
                            filled={field.state.value.length > idx}
                            active={field.state.value.length === idx}
                            error={error}
                          />
                        ))}
                      </motion.div>

                      <div className="h-4 text-center">
                        <AnimatePresence>
                          {error && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="inline-flex items-center gap-1.5 text-[10px] font-mono text-red-400 tracking-[0.2em]"
                            >
                              <AlertOctagon className="h-3 w-3" />
                              ACCESS DENIED · ATTEMPT {attempts}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <input
                        name={field.name}
                        type="password"
                        className="sr-only"
                        value={field.state.value}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);
                          setPinValue(value);
                          field.handleChange(value);
                          setError(false);
                        }}
                        autoFocus={showContent}
                        maxLength={4}
                      />

                      <div className="grid grid-cols-3 gap-2.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map(
                          (num, i) => (
                            <KeypadButton
                              key={i}
                              value={num as number | "del" | null}
                              onPress={() => {
                                if (num === null) return;
                                if (num === "del") {
                                  const next = field.state.value.slice(0, -1);
                                  setPinValue(next);
                                  field.handleChange(next);
                                } else if (field.state.value.length < 4) {
                                  const next = field.state.value + num;
                                  setPinValue(next);
                                  field.handleChange(next);
                                }
                                setError(false);
                              }}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="relative w-full py-3 overflow-hidden rounded-md border border-red-800/60 bg-gradient-to-r from-red-900 via-red-700 to-red-900 text-amber-50 font-mono uppercase tracking-[0.25em] text-[12px] shadow-[0_0_18px_rgba(185,28,28,0.35)] hover:shadow-[0_0_28px_rgba(239,68,68,0.5)] transition-shadow disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "-150%" }}
                  animate={{ x: "350%" }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1.4,
                  }}
                />

                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
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
                      Authenticating
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Verify Identity
                    </>
                  )}
                </span>
              </motion.button>
            </form>
          </div>

          {/* Status footer */}
          <div className="relative border-t border-red-900/30 px-5 py-2.5 font-mono text-[10px] text-red-700/80 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-red-700/60">STATUS</span>
              <span
                className={
                  error
                    ? "text-red-400"
                    : isLoading
                      ? "text-amber-400"
                      : "text-red-500"
                }
              >
                {error
                  ? "ACCESS DENIED"
                  : isLoading
                    ? "VERIFYING…"
                    : "READY"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-red-600"
              />
              <span>ENCRYPTION ACTIVE</span>
            </div>
          </div>
        </motion.div>

        {/* ═════════════════ BOTTOM CONSOLE ═════════════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-4 left-4 right-4 text-[11px] font-mono text-red-800/70 overflow-hidden z-10"
        >
          <div className="flex flex-col gap-0.5 leading-relaxed">
            <div>
              <span className="text-red-700/60">$</span>{" "}
              <Typewriter text="./initialize_security_protocol.sh" delay={0} />
            </div>
            <div>
              <span className="text-red-700/60">$</span>{" "}
              <Typewriter text="loading security modules....... " delay={700} />
              <span className="text-red-500">COMPLETE</span>
            </div>
            <div>
              <span className="text-red-700/60">$</span>{" "}
              <Typewriter
                text="establishing secure connection... "
                delay={1600}
              />
              <span className="text-red-500">COMPLETE</span>
            </div>
            <div>
              <span className="text-red-700/60">$</span>{" "}
              <Typewriter
                text="handshake verified · tls 1.3 · aes-256 · sha-384"
                delay={2500}
              />
            </div>
            <div className="flex items-center">
              <span className="text-red-700/60">$</span>{" "}
              <span className="ml-1.5">waiting for authentication</span>
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ...
              </motion.span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
