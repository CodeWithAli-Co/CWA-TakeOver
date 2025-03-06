import { useForm } from "@tanstack/react-form";
import "../compAssets/pinPage.css";
import React from "react";

import cwa_logo_full from "/codewithali-removebg-preview.png";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/store";
import OrionAnimation from "./OrionAnimation";
import { message } from "@tauri-apps/plugin-dialog";

export default function PinPage() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const checkLogin = localStorage.getItem("isLoggedIn");
    if (checkLogin === "true") {
      setIsLoggedIn("true");
    }
  }, []);

  // Need to fix auto focus after initial orion animation
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
      if (value.pin === "8821") {
        document.startViewTransition(() => {
          setPinCheck("true");
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
      <div
        id="pin-div"
        style={{
          opacity: showContent ? 1 : 0,
          visibility: showContent ? "visible" : "hidden",
          transition: "opacity 0.5s ease-in-out, visibility 0.5s ease-in-out",
        }}
      >
        <h1 id="big-title">TakeOver</h1>
        <img
          src={cwa_logo_full}
          alt="CodeWithAli Logo Full"
          id="cwa-logo-full"
          draggable={false}
        />
        <form
          id="pin-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div>
            <form.Field
              name="pin"
              children={(field) => (
                <input
                  name={field.name}
                  id="pin-input"
                  type="password"
                  minLength={4}
                  maxLength={4}
                  autoFocus={true} // Only focus when content is shown --> but doesnt work
                  placeholder="Enter 4-digit PIN"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            />
          </div>
          <button type="submit" id="pin-submit" style={{ display: "none" }}>
            Submit
          </button>
        </form>
      </div>
    </>
  );
}
