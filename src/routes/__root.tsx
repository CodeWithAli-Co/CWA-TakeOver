import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import cwa_logo from "/codewithali_logo.png";
import book_icon from "/book_icon.svg";
import bot_icon from "/bot_icon.svg";
import employee_icon from "/employee_icon.svg";
import broadcast_icon from "/broadcast_icon.svg";
import "../assets/sidebar.css";
import { useAppStore } from "../stores/store";
import PinPage from "@/MyComponents/pinPage";
import { LoginPage } from "@/MyComponents/login";
import { SignUpPage } from "@/MyComponents/signup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import supabase from "@/MyComponents/supabase";
// import { AppSidebar } from "@/MyComponents/Dashboard/app-sidebar";

// Import Sidebar Components
// import { SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
// import { AppSidebar } from "../ui/components/app-sidebar";

export const Route = createRootRoute({
  component: () => {
    const { pinCheck, isLoggedIn } = useAppStore();
    // Listens to chat updates no matter where user is in the App
    supabase.channel('general').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cwa_chat' }, (payload) => console.log(payload)).subscribe();
    supabase.channel('dms').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cwa_dm_chat' }, (payload) => console.log(payload)).subscribe();
    // Add global pressence if possible

    return (
      <>
        {pinCheck === "false" ? (
          <PinPage />
        ) : pinCheck === "true" && isLoggedIn === "false" ? (
          <LoginPage />
        ) : pinCheck === "true" && isLoggedIn === "makeAcc" ? (
          <SignUpPage />
        ) : pinCheck === "true" && isLoggedIn === "true" ? (
          <SidebarProvider>
            {/* // root.tsx layout section */}
            <AppSidebar />
            <section id="main-section">
              <SidebarTrigger />
              <Outlet />
            </section>
          </SidebarProvider>
        ) : (
          <h3>Error Loading App Components</h3>
        )}
      </>
    );
  },
  errorComponent: () => {
    const navigate = useNavigate();

    const goBack = () => {
      navigate({ to: ".." });
    };
    return (
      <>
        <h3>
          <strong>Error</strong>
        </h3>
        <button type="button" onClick={goBack}>
          Back
        </button>
      </>
    );
  },
  notFoundComponent: () => {
    const navigate = useNavigate();

    const goBack = () => {
      navigate({ to: ".." });
    };
    return (
      <>
        <h3>
          <strong>Not Found</strong>
        </h3>
        <button type="button" onClick={goBack}>
          Back
        </button>
      </>
    );
  },
});
