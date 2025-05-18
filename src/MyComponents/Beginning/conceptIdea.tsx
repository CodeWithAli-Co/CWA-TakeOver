import { useForm } from "@tanstack/react-form";
import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import ParticleBackground from "./particleBackground";
import LiveTime from "../Reusables/liveTime";

export default function SecurityBreach() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const [showContent, setShowContent] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, []);

  const handleAnimationComplete = () => {
    console.log("Animation completed, showing content");
    setTimeout(() => {
      setShowContent(true);
    }, 300);
  };

  const form = useForm({
    defaultValues: {
      pin: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setError(false);

      // Simulate authentication delay
      await new Promise((resolve) => setTimeout(resolve, 800));

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

  // Generate cyberpunk style binary data for background
  const generateBinaryRows = () => {
    return Array.from({ length: 24 }).map((_, i) => (
      <div
        key={i}
        className="text-red-900/20 text-xs font-mono whitespace-nowrap overflow-hidden"
      >
        {Array.from({ length: 120 })
          .map((_, j) => (Math.random() > 0.5 ? "1" : "0"))
          .join("")}
      </div>
    ));
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
        {/* Binary code background overlay */}
        <div className="absolute inset-0 overflow-hidden opacity-20 z-0">
          <motion.div
            initial={{ y: -1000 }}
            animate={{ y: 0 }}
            transition={{
              duration: 60,
              repeat: Infinity,
              repeatType: "loop",
              ease: "linear",
            }}
            className="flex flex-col"
          >
            {generateBinaryRows()}
          </motion.div>
        </div>

        {/* Hexagon grid background */}
        {/* <div className="absolute inset-0 z-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexGrid" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                <path d="M0,0 l25,0 l12.5,21.7 l-12.5,21.7 l-25,0 l-12.5,-21.7 z" fill="none" stroke="#b91c1c" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexGrid)" />
          </svg>
        </div> */}

        {/* Particle background with red color */}
        <ParticleBackground
          particleColor="red"
          lineColor="rgba(255, 0, 0, 0.2)"
          particleCount={150}
          connectionDistance={120}
        />

        {/* Top security info panel */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center text-xs font-mono text-red-700/80 border-b border-red-900/30 bg-black/60 backdrop-blur-sm z-10"
        >
          <div>SYSTEM: TakeOver v1.2.1</div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-700 animate-ping mr-2"></div>
            <span>SECURE CONNECTION ACTIVE</span>
          </div>
          <LiveTime />
        </motion.div>

        {/* Main authentication container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="relative z-10 w-full max-w-md border border-red-900/40 bg-black/80 backdrop-blur-md rounded-lg overflow-hidden shadow-[0_0_40px_rgba(127,29,29,0.15)]"
        >
          {/* Header with glitchy effect */}
          <div className="relative bg-gradient-to-r from-red-950 via-red-900 to-red-950 p-4 border-b border-red-900/50">
            <h2 className="text-center font-mono text-lg text-red-500 uppercase tracking-wider relative inline-block w-full">
              <motion.span
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative z-10"
              >
                Authentication Required
              </motion.span>

              {/* Glitch effect overlay */}
              <motion.span
                animate={{
                  x: [0, -3, 3, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatType: "loop",
                  repeatDelay: 5,
                }}
                className="absolute left-0 top-0 text-red-300 z-0 w-full"
                style={{ clipPath: "inset(0 0 50% 0)" }}
              >
                Authentication Required
              </motion.span>
              <motion.span
                animate={{
                  x: [0, 3, -3, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatType: "loop",
                  repeatDelay: 5,
                  delay: 0.1,
                }}
                className="absolute left-0 top-0 text-blue-500 z-0 w-full opacity-70"
                style={{ clipPath: "inset(50% 0 0 0)" }}
              >
                Authentication Required
              </motion.span>
            </h2>
          </div>

          <div className="p-6">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <motion.img
                src={cwa_logo_full}
                alt="CodeWithAli Logo"
                className="w-32 h-auto filter drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                draggable={false}
                animate={{
                  scale: [1, 1.05, 1],
                  filter: [
                    "drop-shadow(0 0 8px rgba(220,38,38,0.4))",
                    "drop-shadow(0 0 12px rgba(220,38,38,0.6))",
                    "drop-shadow(0 0 8px rgba(220,38,38,0.4))",
                  ],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLoading) {
                  form.handleSubmit();
                }
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="text-center text-red-500 font-mono text-sm mb-3">
                  ENTER SECURITY CREDENTIALS
                </div>

                <form.Field
                  name="pin"
                  children={(field) => (
                    <div className="space-y-4">
                      {/* Individual PIN digit boxes */}
                      <div className="flex justify-center gap-3">
                        {[0, 1, 2, 3].map((index) => (
                          <motion.div
                            key={index}
                            className={`w-12 h-14 flex items-center justify-center border-2 ${error ? "border-red-600" : "border-red-900/80"} bg-black rounded-md text-2xl font-mono text-red-500`}
                            animate={{
                              borderColor:
                                field.state.value.length > index
                                  ? error
                                    ? "#dc2626"
                                    : "#b91c1c"
                                  : error
                                    ? "rgba(220, 38, 38, 0.6)"
                                    : "rgba(127, 29, 29, 0.6)",
                              backgroundColor:
                                field.state.value.length === index
                                  ? [
                                      "rgba(127, 29, 29, 0.1)",
                                      "rgba(127, 29, 29, 0.2)",
                                      "rgba(127, 29, 29, 0.1)",
                                    ]
                                  : "rgba(0, 0, 0, 0.5)",
                            }}
                            transition={{
                              duration:
                                field.state.value.length === index ? 1.5 : 0.2,
                              repeat:
                                field.state.value.length === index
                                  ? Infinity
                                  : 0,
                            }}
                          >
                            {field.state.value.length > index ? "*" : ""}
                          </motion.div>
                        ))}
                      </div>

                      {/* Hidden real input field */}
                      <input
                        name={field.name}
                        type="password"
                        className="sr-only"
                        value={field.state.value}
                        onChange={(e) => {
                          // Only allow digits and max 4 characters
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

                      {/* PIN pad */}
                      <div className="grid grid-cols-3 gap-2 mt-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map(
                          (num, i) => (
                            <motion.button
                              key={i}
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`w-full h-12 flex items-center justify-center rounded border ${
                                num === "del"
                                  ? "border-red-900/60 bg-red-950/30 text-red-500"
                                  : "border-red-900/40 bg-black text-red-500"
                              } font-mono ${num === null ? "cursor-default" : "hover:bg-red-950/40"}`}
                              onClick={() => {
                                if (num === null) return;
                                if (num === "del") {
                                  const newValue = field.state.value.slice(
                                    0,
                                    -1
                                  );
                                  setPinValue(newValue);
                                  field.handleChange(newValue);
                                } else if (field.state.value.length < 4) {
                                  const newValue = field.state.value + num;
                                  setPinValue(newValue);
                                  field.handleChange(newValue);
                                }
                                setError(false);
                              }}
                            >
                              {num === "del" ? "⌫" : num === null ? "" : num}
                            </motion.button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-amber-50 font-mono uppercase tracking-wider rounded border border-red-900/50 shadow-[0_0_15px_rgba(127,29,29,0.3)] hover:shadow-[0_0_20px_rgba(185,28,28,0.4)] transition-shadow"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                    AUTHENTICATING...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg
                      className="h-5 w-5 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    VERIFY IDENTITY
                  </div>
                )}
              </motion.button>
            </form>
          </div>

          {/* Status footer */}
          <div className="border-t border-red-900/30 p-3 font-mono text-xs text-red-700/70 flex justify-between items-center">
            <div>SYSTEM STATUS: {error ? "ACCESS DENIED" : "READY"}</div>
            <div className="flex items-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-red-700 mr-2"
              ></motion.div>
              <div>ENCRYPTION ACTIVE</div>
            </div>
          </div>
        </motion.div>

        {/* Bottom console text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-4 left-4 right-4 text-xs font-mono text-red-900/60 overflow-hidden z-10"
        >
          <div className="flex flex-col gap-1">
            <div>$ ./initialize_security_protocol.sh</div>
            <div>
              $ loading security modules.......{" "}
              <span className="text-red-500">COMPLETE</span>
            </div>
            <div>
              $ establishing secure connection...{" "}
              <span className="text-red-500">COMPLETE</span>
            </div>
            <div>
              $ waiting for authentication
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
