// cyberpunkPinPage.tsx
import { useForm } from "@tanstack/react-form";
import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import ParticleBackground from "./particleBackground";
import { ActiveUser } from "@/stores/query";
import LiveTime from "../Reusables/liveTime";
import { Navigate, useNavigate } from "@tanstack/react-router";

export default function CyberpunkPinPage() {
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
            <div>TAKEOVER v1.2.1 // CYBERSEC MODULE ACTIVE</div>
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
