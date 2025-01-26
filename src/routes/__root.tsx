import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import cwa_logo from "/codewithali_logo.png";
import home_icon from "/home_icon.svg";
import bot_icon from "/bot_icon.svg";
import employee_icon from "/employee_icon.svg";
import broadcast_icon from "/broadcast_icon.svg";
import "../assets/root.css";
import { useAppStore } from "../stores/main";
import PinPage from "../components/pinPage";

export const Route = createRootRoute({
  component: () => {
    const { loggedIn } = useAppStore();
    return (
      <>
        {loggedIn ? (
          <div className="main-div">
            <section id="sidebar">
              <Link to="/" draggable={false}>
                <img
                  src={cwa_logo}
                  alt="CodeWithAli Logo"
                  id="cwa-logo"
                  draggable={false}
                />
              </Link>
              <Link to="/" draggable={false}>
                <img
                  src={home_icon}
                  alt="Home Icon"
                  className="sidebar-icon"
                  draggable={false}
                />
              </Link>
              <Link to="/employee" draggable={false}>
                <img
                  src={employee_icon}
                  alt="Employee Icon"
                  className="sidebar-icon"
                  draggable={false}
                />
              </Link>
              <Link to="/bot" draggable={false}>
                <img
                  src={bot_icon}
                  alt="Bot Icon"
                  className="sidebar-icon"
                  draggable={false}
                />
              </Link>
              <Link to="/broadcast" draggable={false}>
                <img
                  src={broadcast_icon}
                  alt="Broadcast Icon"
                  className="sidebar-icon"
                  draggable={false}
                />
              </Link>
            </section>

            <section id="main-section">
              <Outlet />
            </section>
          </div>
        ) : (
          <PinPage />
        )}
      </>
    );
  },
});
