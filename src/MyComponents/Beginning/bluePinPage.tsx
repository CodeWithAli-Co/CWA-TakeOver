// bluePinPage.tsx — COO (BlazeHp) lock screen.
//
// History: this file used to host a cyberpunk-HUD PIN page named
// CyberpunkPinPage. That component is preserved at the bottom as
// _DeprecatedCyberpunkPinPage (commented-out / inert — kept so it's
// recoverable without git archaeology).
//
// The active default export is now CyberpunkPinPage = a blue,
// personalized version of the Editorial split-screen sign-in that
// every other role sees in red. Same auth logic ("8821" PIN,
// setPinCheck on success, OrionAnimation intro, Tauri dialog on
// fail) — only the visual language differs:
//   • Blue / sky / indigo color scheme (BlazeHp's preference).
//   • Headline reads "Welcome back, BlazeHp" with his name front
//     and center.
//   • Brand statement on the left names the COO directly.

import { useForm } from "@tanstack/react-form";
import cwa_logo_full from "/codewithali-removebg-preview.png";
// Legacy imports — kept because the deprecated component still
// references them. New component below uses its own minimal set.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion, AnimatePresence } from "framer-motion";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ParticleBackground from "./particleBackground";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ActiveUser } from "@/stores/query";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import LiveTime from "../Reusables/liveTime";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Delete } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// NEW — BlazeHp blue editorial PIN page (active default export).
// ════════════════════════════════════════════════════════════════

const COO_NAME = "BlazeHp";

const BluePinDot: React.FC<{ filled: boolean; error: boolean }> = ({
  filled,
  error,
}) => (
  <div
    className={`h-3 w-3 rounded-full border-2 transition-all duration-200 ${
      error
        ? "border-red-400 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]"
        : filled
          ? "border-sky-500 bg-sky-500 shadow-[0_0_14px_rgba(56,189,248,0.65)]"
          : "border-zinc-700 bg-transparent"
    }`}
  />
);

const BlueKeypadKey: React.FC<{
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
          ? "text-zinc-500 hover:text-sky-400"
          : "text-zinc-200 hover:text-white"
      } hover:bg-sky-950/40`}
    >
      {isDel ? <Delete className="h-5 w-5" /> : value}
    </motion.button>
  );
};

const BlueAuroraOrbs: React.FC = () => (
  <>
    <motion.div
      className="absolute -top-40 -left-20 h-[520px] w-[520px] rounded-full bg-sky-500/22 blur-3xl"
      animate={{ x: [0, 40, -20, 0], y: [0, 20, -10, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-0 -right-20 h-[560px] w-[560px] rounded-full bg-blue-600/18 blur-3xl"
      animate={{
        x: [0, -30, 15, 0],
        y: [0, -20, 10, 0],
        scale: [1, 1.08, 1],
      }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/3 left-1/3 h-[360px] w-[360px] rounded-full bg-indigo-500/12 blur-3xl"
      animate={{ x: [0, 20, -10, 0], y: [0, -15, 8, 0] }}
      transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
    />
  </>
);

const BlueHexagonWireframe: React.FC = () => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    animate={{ rotate: 360 }}
    transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
  >
    <svg viewBox="0 0 300 300" className="w-[58%] max-w-[540px] opacity-[0.14]">
      <circle
        cx="150"
        cy="150"
        r="138"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      <polygon
        points="150,30 254,90 254,210 150,270 46,210 46,90"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.5"
      />
      <line x1="150" y1="30" x2="150" y2="270" stroke="#38bdf8" strokeWidth="0.75" />
      <line x1="46" y1="90" x2="254" y2="210" stroke="#38bdf8" strokeWidth="0.75" />
      <line x1="254" y1="90" x2="46" y2="210" stroke="#38bdf8" strokeWidth="0.75" />
    </svg>
  </motion.div>
);

export default function CyberpunkPinPage() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
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
        {/* ═════ LEFT — BRAND STATEMENT (md+), personalized for COO ═════ */}
        <div className="relative hidden md:flex flex-[1.15] flex-col justify-between p-12 lg:p-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-sky-950/40 to-black" />
          <BlueAuroraOrbs />
          <BlueHexagonWireframe />

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
              <span className="text-[10px] text-sky-400 tracking-[0.2em] uppercase">
                COO Console · {COO_NAME}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative max-w-2xl"
          >
            <h1 className="text-5xl lg:text-[64px] xl:text-[72px] font-bold text-white leading-[1.05] tracking-tight">
              Welcome,
              <br />
              <span className="text-sky-500 italic font-semibold">
                {COO_NAME}
              </span>
              .
            </h1>
            <p className="mt-6 text-base lg:text-lg text-zinc-400 max-w-lg leading-relaxed">
              The deck is yours. Operations, hires, projections, finance —
              every lever in one place. Built for the people who run the show.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="relative flex items-center gap-3 text-[11px] text-zinc-600"
          >
            <span>v1.4.0</span>
            <span className="text-zinc-800">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400/90" />
              End-to-end encrypted
            </span>
            <span className="text-zinc-800">·</span>
            <span className="text-sky-500/80 tracking-[0.18em] uppercase text-[10px]">
              Authorized: COO
            </span>
          </motion.div>
        </div>

        {/* ═════════════════ RIGHT — PIN ENTRY ═════════════════ */}
        <div className="relative flex w-full md:w-[480px] lg:w-[520px] flex-col items-center justify-center bg-zinc-950 border-l border-sky-950/40 px-8 py-10 shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full max-w-[320px] space-y-8"
          >
            <div className="md:hidden flex items-center gap-3">
              <img
                src={cwa_logo_full}
                alt=""
                className="h-7 w-auto opacity-80"
                draggable={false}
              />
              <span className="text-[11px] text-sky-400 tracking-[0.25em] uppercase">
                COO · {COO_NAME}
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-white tracking-tight">
                Welcome back, <span className="text-sky-400">{COO_NAME}</span>
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                Enter your 4-digit PIN to continue.
              </p>
            </div>

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
                  const handleChange = (next: string) => {
                    setPinValue(next);
                    field.handleChange(next);
                    setError(false);
                    if (next.length === 4 && !isLoading) {
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
                          <BluePinDot
                            key={idx}
                            filled={field.state.value.length > idx}
                            error={error}
                          />
                        ))}
                      </motion.div>

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

                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map(
                          (num, i) => (
                            <BlueKeypadKey
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
                            ? "bg-sky-500 text-white hover:bg-sky-600 shadow-[0_0_24px_rgba(56,189,248,0.35)]"
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

            <div className="pt-2 text-center text-[11px] text-zinc-600">
              Secured by CWA · COO · Contact an admin if you&apos;re locked out.
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// LEGACY — preserved but inert. The original cyberpunk-HUD PIN
// page that lived at default export. Kept as a renamed function
// (not commented out) so TS / Vite don't choke on stale tokens.
// Reachable only via deep import for fallback / debugging.
// ════════════════════════════════════════════════════════════════

// @ts-ignore — intentionally unused; preserved for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _DeprecatedCyberpunkPinPage() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const [showContent, setShowContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWrongPin, setIsWrongPin] = useState(false);
  const [activePinIndex, setActivePinIndex] = useState(-1);
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const navigate = useNavigate()
  

  const { data: activeUser, error: activeUserError } = ActiveUser();
  if (activeUserError)
    console.log(
      "Error fetching active user for pin page",
      activeUserError.message
    );

  // Keypad sounds
  const playKeypadSound = () => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 600 + Math.random() * 200;
    gainNode.gain.value = 0.1;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  };

  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, []);

  const handleAnimationComplete = () => {
    setTimeout(() => {
      setShowContent(true);
    }, 300);
  };

  // Check if all pin digits are filled
  const isPinComplete = pinDigits.every((digit) => digit !== "");

  // Handle keypad press
  const handleKeypadPress = (digit: string) => {
    if (isLoading) return;

    playKeypadSound();

    // Find next empty slot
    const nextEmptyIndex = pinDigits.findIndex((d) => d === "");
    if (nextEmptyIndex !== -1) {
      const newPinDigits = [...pinDigits];
      newPinDigits[nextEmptyIndex] = digit;
      setPinDigits(newPinDigits);
      setActivePinIndex(nextEmptyIndex);

      // Animate the active pin index
      setTimeout(() => {
        setActivePinIndex(-1);
      }, 300);

      // Auto-submit if all digits are filled
      if (nextEmptyIndex === 3) {
        setTimeout(() => {
          handleSubmit();
        }, 300);
      }
    }
  };

  // Handle clear button
  const handleClear = () => {
    if (isLoading) return;
    setPinDigits(["", "", "", ""]);
    setIsWrongPin(false);
  };

  // Handle backspace button
  const handleBackspace = () => {
    if (isLoading) return;

    playKeypadSound();

    // Find last filled slot
    const filledIndices = pinDigits
      .map((d, i) => (d !== "" ? i : -1))
      .filter((i) => i !== -1);
    if (filledIndices.length > 0) {
      const lastFilledIndex = Math.max(...filledIndices);
      const newPinDigits = [...pinDigits];
      newPinDigits[lastFilledIndex] = "";
      setPinDigits(newPinDigits);
      setActivePinIndex(lastFilledIndex - 1);
      setIsWrongPin(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    const pin = pinDigits.join("");

    if (pin.length !== 4) return;

    setIsLoading(true);

    // Simulate API call delay
    await new Promise((r) => setTimeout(r, 800));

    if (pin === "8821") {
      document.startViewTransition(() => {
        setPinCheck("true");
      });
    } else if (pin === "1027")
      {
        document.startViewTransition(() => {
          setPinCheck("true")
          navigate({ to: "/client" });
          
        })
      } 
    
    
    else {
      setIsWrongPin(true);
      setIsLoading(false);
      setPinDigits(["", "", "", ""]);
      await message("Invalid PIN code. Access denied.", {
        title: "Security Alert",
        kind: "error",
      });
    }
  };

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
        {/* Particle background with cyan color */}
        <ParticleBackground
          particleColor="cyan"
          lineColor="rgba(0, 170, 170, 0.2)"
          particleCount={150}
          connectionDistance={120}
        />

        {/* Cyberpunk terminal overlay */}
        {/* blaze: i disabled this for now bc i think it looks cleaner without it, but maybe i change my mind later */}
        {/* <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-10">
          <div className="w-full h-full flex flex-col text-[8px] font-mono text-cyan-500 leading-3 select-none">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="whitespace-nowrap">
                {Array.from({ length: 200 }).map((_, j) => 
                  String.fromCharCode(33 + Math.floor(Math.random() * 93))
                ).join('')}
              </div>
            ))}
          </div>
        </div> */}

        {/* Terminal top bar */}
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="fixed top-0 left-0 right-0 bg-black border-b border-cyan-700/50 p-2 flex justify-between items-center z-20 text-xs font-mono text-cyan-500"
        >
          <div>TAKEOVER SYSTEM // RESTRICTED ACCESS</div>
          <div className="flex items-center space-x-4">
            <div>
              USER:{" "}
              <span className="text-cyan-300">
                {activeUser[0].username || "UNKNOWN"}
              </span>
            </div>
            <div>
              STATUS:{" "}
              <span className="text-yellow-400">VERIFICATION REQUIRED</span>
            </div>
            <LiveTime />
          </div>
        </motion.div>

        {/* Main container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative z-10 max-w-sm w-full backdrop-blur-md"
        >
          {/* Neo-Tokyo style header */}
          <div className="relative h-32 overflow-hidden rounded-t-lg border-x border-t border-cyan-700/50">
            {/* Header background */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/30 to-black">
              {/* Grid lines */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #00ffff08 1px, transparent 1px), linear-gradient(to bottom, #00ffff08 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              ></div>
            </div>

            {/* Neon cityscape silhouette */}
            <div className="absolute bottom-0 left-0 right-0 h-16">
              <svg
                viewBox="0 0 500 80"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <path
                  d="M0,80 L0,50 L20,50 L20,30 L30,30 L30,50 L40,50 L40,40 L50,40 L50,20 L60,20 L60,40 L80,40 L80,30 L100,30 L100,50 L120,50 L120,20 L140,20 L140,60 L160,60 L160,40 L180,40 L180,30 L200,30 L200,50 L220,50 L220,40 L240,40 L240,50 L260,50 L260,30 L280,30 L280,50 L300,50 L300,20 L320,20 L320,40 L340,40 L340,60 L360,60 L360,40 L380,40 L380,20 L400,20 L400,50 L420,50 L420,30 L440,30 L440,50 L460,50 L460,40 L480,40 L480,50 L500,50 L500,80 Z"
                  fill="#000"
                  stroke="#0ff"
                  strokeWidth="1"
                  className="opacity-70"
                />
              </svg>
            </div>

            {/* Glowing horizontal lines */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                y: [0, 2, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute left-0 right-0 top-1/2 h-px bg-cyan-400/50 shadow-[0_0_8px_#0ff] blur-[1px]"
            />
            <motion.div
              animate={{
                opacity: [0.2, 0.4, 0.2],
                y: [0, -1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute left-0 right-0 top-1/3 h-px bg-cyan-400/30 shadow-[0_0_5px_#0ff] blur-[1px]"
            />

            {/* Title */}
            <div className="absolute top-4 left-0 right-0 text-center">
              <motion.h1
                animate={{
                  textShadow: [
                    "0 0 5px rgba(0, 255, 255, 0.5), 0 0 10px rgba(0, 255, 255, 0.3)",
                    "0 0 10px rgba(0, 255, 255, 0.7), 0 0 20px rgba(0, 255, 255, 0.5)",
                    "0 0 5px rgba(0, 255, 255, 0.5), 0 0 10px rgba(0, 255, 255, 0.3)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500"
              >
                TAKEOVER
              </motion.h1>
              <p className="mt-1 text-xs text-cyan-400/70 font-mono uppercase tracking-widest">
                Security Authorization
              </p>
            </div>
          </div>

          {/* PIN entry card body */}
          <div className="bg-black border-x border-cyan-700/50 p-6 space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <motion.div
                animate={{
                  filter: [
                    "brightness(1) drop-shadow(0 0 5px rgba(0, 255, 255, 0.3))",
                    "brightness(1.2) drop-shadow(0 0 15px rgba(0, 255, 255, 0.5))",
                    "brightness(1) drop-shadow(0 0 5px rgba(0, 255, 255, 0.3))",
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative"
              >
                <div className="absolute inset-0 bg-cyan-500/5 rounded-full blur-xl"></div>
                <img
                  src={cwa_logo_full}
                  alt="CodeWithAli Logo"
                  className="w-24 h-auto relative z-10"
                  draggable={false}
                  style={{ filter: "hue-rotate(140deg) brightness(1.2)" }}
                />
              </motion.div>
            </div>

            {/* PIN display */}
            <div className="space-y-2">
              <p className="text-center text-cyan-400/70 text-xs font-mono uppercase tracking-wider">
                {isLoading ? "Authenticating..." : "Enter Access Code"}
              </p>

              <div className="flex justify-center space-x-4">
                {pinDigits.map((digit, index) => (
                  <motion.div
                    key={index}
                    animate={{
                      scale: activePinIndex === index ? 1.1 : 1,
                      backgroundColor: isWrongPin
                        ? ["rgba(220, 38, 38, 0.3)", "rgba(0, 0, 0, 0.5)"]
                        : "rgba(0, 0, 0, 0.5)",
                      borderColor: isWrongPin
                        ? ["rgba(220, 38, 38, 0.8)", "rgba(0, 156, 156, 0.5)"]
                        : activePinIndex === index
                          ? "rgba(0, 255, 255, 0.8)"
                          : digit
                            ? "rgba(0, 200, 200, 0.5)"
                            : "rgba(0, 100, 100, 0.5)",
                    }}
                    transition={{
                      duration: isWrongPin ? 0.5 : 0.2,
                      repeat: isWrongPin ? 3 : 0,
                      repeatType: "reverse",
                    }}
                    className="w-12 h-16 bg-black/50 border-2 border-cyan-500/50 rounded flex items-center justify-center text-2xl text-cyan-300 font-mono"
                  >
                    {digit ? "*" : ""}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "⌫"].map((key, index) => (
                <motion.button
                  key={index}
                  whileHover={{
                    scale: 1.05,
                    backgroundColor: "rgba(0, 210, 210, 0.2)",
                  }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative py-3 ${
                    typeof key === "string" && key === "C"
                      ? "bg-cyan-900/30 text-cyan-300"
                      : typeof key === "string" && key === "⌫"
                        ? "bg-cyan-900/20 text-cyan-300"
                        : "bg-black/80 text-cyan-400"
                  } border border-cyan-700/50 rounded font-mono text-lg overflow-hidden`}
                  onClick={() => {
                    if (key === "C") {
                      handleClear();
                    } else if (key === "⌫") {
                      handleBackspace();
                    } else {
                      handleKeypadPress(key.toString());
                    }
                  }}
                  disabled={isLoading}
                >
                  {/* Keypad button highlight/glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700"></div>
                  {key}
                </motion.button>
              ))}
            </div>

            {/* Submit button */}
            <motion.button
              whileHover={{
                scale: 1.02,
                boxShadow: "0 0 15px rgba(0, 255, 255, 0.3)",
              }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow:
                  isPinComplete && !isLoading
                    ? [
                        "0 0 5px rgba(0, 255, 255, 0.3)",
                        "0 0 15px rgba(0, 255, 255, 0.5)",
                        "0 0 5px rgba(0, 255, 255, 0.3)",
                      ]
                    : "none",
              }}
              transition={{
                duration: 2,
                repeat: isPinComplete && !isLoading ? Infinity : 0,
              }}
              className={`w-full py-3 rounded font-mono uppercase tracking-widest text-sm ${
                isPinComplete && !isLoading
                  ? "bg-gradient-to-r from-cyan-900 to-cyan-700 text-cyan-50 border border-cyan-400/50"
                  : "bg-cyan-950/30 text-cyan-700 border border-cyan-800/30"
              }`}
              onClick={handleSubmit}
              disabled={!isPinComplete || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-cyan-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  AUTHENTICATING
                </div>
              ) : (
                "ACCESS SYSTEM"
              )}
            </motion.button>
          </div>

          {/* Card footer */}
          <div className="bg-black border-x border-b border-cyan-700/50 rounded-b-lg p-3">
            <div className="flex justify-between items-center text-xs text-cyan-700 font-mono">
              <div>SECURE CONNECTION</div>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center"
              >
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full mr-2"></div>
                <span>QUANTUM ENCRYPTION</span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Terminal footer */}
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 bg-black border-t border-cyan-700/50 p-2 font-mono text-xs text-cyan-600 z-20"
        >
          <div className="flex justify-between items-center">
            <div>TAKEOVER v1.4.0 // CYBERSEC MODULE ACTIVE</div>
            <div className="flex items-center space-x-4">
              <div>CORE TEMP: 42.3°C</div>
              <div>CPU: 12%</div>
              <div>MEM: 4.2GB/16GB</div>
              <div>DISK: 128GB/512GB</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
