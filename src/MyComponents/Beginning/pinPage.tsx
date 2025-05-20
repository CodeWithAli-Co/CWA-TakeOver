import { useForm } from "@tanstack/react-form";
import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import ParticleBackground from "./particleBackground";
import { Route, useNavigate } from "@tanstack/react-router";
import { URL } from "node:url";

export default function PinPage() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const [showContent, setShowContent] = useState(false);
  const [pinValue, setPinValue] = useState("");
   const navigate = useNavigate()
   
  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, []);

  const handleAnimationComplete = () => {
    console.log("Animation completed, showing content");
    // Use fade transition to show content
    setTimeout(() => {
      setShowContent(true);
    }, 300); // Small delay for better transition
  };

   const form = useForm({
    defaultValues: {
      pin: "",
    },
    onSubmit: async ({ value }) => {
      // Modified to handle different PINs
      if (value.pin === "8821") {
        document.startViewTransition(() => {
          setPinCheck("true");
        });
      } else if (value.pin === "1027") {
        // Client portal PIN - navigate to client portal
        document.startViewTransition(() => {
          setPinCheck("true"); // Still set login as valid
          setIsLoggedIn("true")
          setClientMode(true) // client mode Flag ( edit later for employees to enter client mode they would have no permission include CEO ahaha)
          // Navigate to client portal
          navigate({ to: "/client" });
        });
      } else {
        await message("Please enter a valid Pin!", {
          title: "Pin Error",
          kind: "error",
        });
      }
    },
  });

  return (
    <>
      {/* Animation component - will show before content */}
      <OrionAnimation onAnimationComplete={handleAnimationComplete} />

      {/* Content will only be displayed after animation is complete */}
      {/* Particle background with cyan color */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: showContent ? 1 : 0,
          visibility: showContent ? "visible" : "hidden" 
        }}
        transition={{ duration: 0.8 }}
        className="relative flex flex-col items-center justify-center w-screen h-screen bg-black overflow-hidden"
      >
      {/* Particle background with red color */}
      <ParticleBackground 
        particleColor="red" 
        lineColor="rgba(255, 0, 0, 0.2)"
        particleCount={150}
        connectionDistance={120}
      />

      {/* Grid pattern with reduced opacity */}
      {/* <div className="absolute inset-0 overflow-hidden opacity-5 z-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={`v-${i}`}
            className="absolute top-0 bottom-0 w-px bg-red-900/50"
            style={{ left: `${i * 5}%` }}
          ></div>
        ))}
        {Array.from({ length: 15 }).map((_, i) => (
          <div 
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-red-900/50"
            style={{ top: `${i * 7}%` }}
          ></div>
        ))}
      </div> */}

        {/* App title */}
        <motion.h1
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-7xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-800 via-red-600 to-red-800 drop-shadow-[0_0_10px_rgba(185,28,28,0.3)] z-10"
        >
          TakeOver
        </motion.h1>

        {/* Logo - bigger size */}
        <motion.img
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          src={cwa_logo_full}
          alt="CodeWithAli Logo"
          className="w-90 h-auto filter drop-shadow-[0_0_8px_rgba(220,38,38,0.4)] z-10 opacity-90 hover:opacity-100 transition-opacity duration-300"
          draggable={false}
        />

        {/* PIN form */}
        <form
          className="w-full max-w-md px-20 z-10"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="relative"
          >
            <form.Field
              name="pin"
              children={(field) => (
                <>
                  <input
                    name={field.name}
                    type="password"
                    minLength={4}
                    maxLength={4}
                    autoFocus={showContent}
                    placeholder="Enter 4-digit PIN"
                    value={field.state.value}
                    onChange={(e) => {
                      setPinValue(e.target.value);
                      field.handleChange(e.target.value);
                    }}
                    className="w-full bg-black/80 border-2 border-red-900/80 rounded-md py-3 px-4 text-center text-amber-50 text-xl placeholder:text-amber-50/30 focus:outline-none focus:border-red-700 focus:ring-1 focus:ring-red-800/60 transition-all duration-300 shadow-[0_0_10px_rgba(120,0,0,0.15)]"
                  />
                  
                  {/* Need you to learn this (fun way to map things) */}
                  {/* PIN indicator dots */}
                  <div className="flex justify-center gap-5 mt-5">
                    {[0, 1, 2, 3].map((index) => (
                      <motion.div
                        key={index}
                        initial={{ scale: 0.8 }}
                        animate={{ 
                          scale: field.state.value.length > index ? 1 : 0.8,
                          backgroundColor: field.state.value.length > index ? '#b91c1c' : 'rgba(127, 29, 29, 0.3)'
                        }}
                        className="w-3 h-3 rounded-sm"
                        style={{
                          boxShadow: field.state.value.length > index ? '0 0 5px rgba(185, 28, 28, 0.6)' : 'none'
                        }}
                        transition={{ duration: 0.2 }}
                      />
                    ))}
                  </div>
                </>
              )}
            />
          </motion.div>
          
          {/* Square-like submit button - now visible hehe */}
          <motion.button
            type="submit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-8 w-full bg-red-900/80 hover:bg-red-800 border border-red-700/50 text-amber-50 py-3 rounded-md transition-colors duration-300 flex items-center justify-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Authenticate
          </motion.button>
        </form>

        {/* Footer text - darker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="absolute bottom-6 text-amber-50/30 text-xs z-10"
        >
          Security Protocol Active • {new Date().getFullYear()}
        </motion.div>
      </motion.div>
    </>
  );
}

function setClientMode(arg0: boolean) {
  throw new Error("Function not implemented.");
}
