import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import cwa_logo from "/codewithali_logo.png";
import book_icon from "/book_icon.svg";
import bot_icon from "/bot_icon.svg";
import employee_icon from "/employee_icon.svg";
import broadcast_icon from "/broadcast_icon.svg";
import "../assets/sidebar.css";
import { useAppStore } from "../stores/store";
import PinPage from "@/MyComponents/pinPage";
import { LoginPage } from "@/MyComponents/login";
import { SingUpPage } from "@/MyComponents/signup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

// Import Sidebar Components
// import { SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
// import { AppSidebar } from "../ui/components/app-sidebar";

export const Route = createRootRoute({
  component: () => {
    const { pinCheck, isLoggedIn } = useAppStore();

    return (
      <>
        {pinCheck === "false" ? (
          <PinPage />
        ) : pinCheck === "true" && isLoggedIn === "false" ? (
          <LoginPage />
        ) : pinCheck === "true" && isLoggedIn === "makeAcc" ? (
          <SingUpPage />
        ) : pinCheck === "true" && isLoggedIn === "true" ? (
          <SidebarProvider>
            // root.tsx layout section
            <div className="app-container">
              <AppSidebar />
              <section id="main-section">
                <Outlet />
              </section>
            </div>
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
});
