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
import "../assets/root.css";
import { useAppStore } from "../stores/store";
import PinPage from "../components/pinPage";
import { SingUpPage } from "../components/signup";
import { LoginPage } from "../components/login";

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
          <div className="main-div">
            <section id="sidebar">
              <Link to="/" id="cwa-logo-link" draggable={false}>
                <img
                  src={cwa_logo}
                  alt="CodeWithAli Logo"
                  id="cwa-logo"
                  draggable={false}
                />
              </Link>
              <Link to="/details" draggable={false}>
                <img
                  src={book_icon}
                  alt="Book Icon"
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
        <button type="button" onClick={() => goBack()}>
          Back
        </button>
      </>
    );
  },
});
