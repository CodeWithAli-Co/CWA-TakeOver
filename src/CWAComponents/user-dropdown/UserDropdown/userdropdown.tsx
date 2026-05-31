import RefCompHolder from "@/MyComponents/refCompHolder";

// src/MyComponents/Userdropdown.tsx (Updated)
import { useState, useRef, useEffect } from "react";
import {
  Settings,
  User,
  LogOut,
  CreditCard,
  HelpCircle,
  ChevronDown,
  BookPlus,
  Crown,
  Bell,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { useNavigate } from "@tanstack/react-router";

// interface UserDropdownProps {
//   onSettingsClick?: () => void;
//   onProfileClick?: () => void;
//   onNotificationsClick?: () => void;
//   onSecurityClick?: () => void;
//   onHelpClick?: () => void;
// }

export const UserDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // const username = isPlaceholderData
  //   ? "Unknown"
  //   : user?.first_name + " " + user?.last_name;

  // close dropdown when click outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  // const onBillingClick = ( )  => {
  //   navigate({
  //      to: "/profile/$section", 
  //      params: {  section : "billing" },
  //      replace: true
  //     });
  //     setIsOpen(false);
  // };

  // const onLogoutClick = async () => {
  //   // const { error } = await takeOversupabase.auth.signOut();
  //   if (error) {
  //     console.log("There was an error signing you out", error.message);
  //   } else {
  //     localStorage.removeItem("loggedInState");
  //     window.location.reload();
  //   }
  // };

  // Navigate to profile sections
  const navigateToProfile = (section : string) => {
    // navigate({ 
    //   to: "/profile/$section", 
    //   params: { section } ,
    //   replace: true
    // });
    setIsOpen(false);
  };

  const onTutorialClick = async () => {
    // navigate({ to: '/tutorial' })
  }

  const handleMenuItemClick = (callback?: () => void) => {
    setIsOpen(false);
    callback?.();
  };

  // There is no supabase backend so I commented out the variable logic for profile account ( username and user email) and commented out the routing ( tauri routing ) 
  return (
    <div className="flex justify-center pt-150">
      <div
      className={`relative group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7 border px-5  group-data-[collapsible=icon]:self-center border-b h-12  dark:border-red-700 ${isOpen ? "dark:bg-black bg-white border-teal-400" : " border-teal-500"} `}
      ref={dropdownRef}
    >
      {/* User Button  */}
      <button
        onClick={toggleDropdown}
        className="group flex items-center group-data-[collapsible=icon]:h-full group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:gap-0 w-full gap-2 px-3 py-2 rounded-xs transition-all duration-200 hover:bg-zinc-200/40 dark:hover:bg-card  border-transparent"
      >
        {/* User Avatar */}
        <div className="w-7 h-7 group-data-[collapsible=icon]:justify-self-center group-data-[collapsible=icon]:bg-none bg-gradient-to-br from-teal-400 to-teal-500 dark:from-red-600 dark:to-red-800 rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {/* {user?.first_name!.charAt(0).toUpperCase()} */}
          HP
        </div>

        <section className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
        {/* UserName it won't show on smaller screen  */}
        <span className="hidden sm:flex justify-center items-center text-sm font-medium text-black dark:text-white max-w-fit truncate capitalize gap-2">
          {/* {username} */}
          {/* {currentPlan !== "free" && (
            <Crown size={15} className="text-yellow-600 dark:text-yellow-400" />
          )} */}
        </span>

        <ChevronDown
          className={`text-teal-600 dark:text-white transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={16}
        />
        </section>
      </button>

   {/* Dropdown Menu - Now slides upward */}
      <div className={`absolute group-data-[collapsible=icon]:left-10  bottom-full mb-2 w-58 bg-white dark:bg-card rounded-xs shadow-xl border border-teal-500 dark:border-red-800 z-50 overflow-hidden transition-all duration-300 ease-out ${
        isOpen 
          ? 'opacity-100 transform translate-y-0 scale-100' 
          : 'opacity-0 transform translate-y-2 scale-95 pointer-events-none'
      }`}>
        {/* user info header */}
        <div className="px-4 py-3 border-b border-teal-500 dark:border-red-500 bg-teal-500 dark:bg-red-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br border border-black/80 from-teal-600 to-teal-700 dark:from-red-500 dark:via-red-600 dark:to-red-800 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium select-none">
              {/* {user?.first_name?.charAt(0).toUpperCase()} */}
              B
            </div>
            <div className="flex-1 min-w-0">
              {/* <p className="flex gap-2 text-black dark:text-white text-sm capitalize font-medium">
                {username}
                {currentPlan !== "free" && (
                  <Crown
                    size={15}
                    className="justify-self-center self-center text-yellow-600 dark:text-yellow-400"
                  />
                )}
              </p> */}
              <p className="text-black dark:text-white font-medium text-xs text-pretty">
                {/* {user?.email} */}
                Blazehunterhp@gmail.com
              </p>
            </div>
          </div>
        </div>

          {/* Menu Items */}
          <div className="py-2 dark:bg-black">
            {/* Profile */}
            <Button
              onClick={() => navigateToProfile("general")}
              className="text-black hover:text-white dark:text-white  w-full justify-start flex items-center  px-4 py-2 text-sm rounded-none bg-white dark:bg-black dark:hover:bg-red-800 active:dark:hover:bg-red-900  hover:bg-teal-500 active:hover:bg-teal-600 "
            >
              <div className="ml-8 w-5">
                <User size={16} />
              </div>
              Profile Settings
            </Button>

            {/* Notifications */}
            <Button
              onClick={() => navigateToProfile("notifications")}
              className="text-black hover:text-white dark:text-white  w-full justify-start text-center  px-4 py-2 text-sm rounded-none bg-white dark:bg-black dark:hover:bg-red-800 active:dark:hover:bg-red-900  hover:bg-teal-500 active:hover:bg-teal-600 "
            >
              <div className="ml-8 w-5">
                <Bell size={16} />
              </div>
              Notifications
            </Button>

            {/* Security */}
            <Button
              onClick={() => navigateToProfile("security")}
              className="text-black hover:text-white dark:text-white  w-full justify-start text-center text-sm px-4 py-2  rounded-none bg-white dark:bg-black dark:hover:bg-red-800 active:dark:hover:bg-red-900  hover:bg-teal-500 active:hover:bg-teal-600  "
            >
              <div className=" ml-8 w-5">
                <Shield size={16} />
              </div>
              Security & Privacy
            </Button>

            {/* Billing Plans */}
            <Button
              onClick={() => navigateToProfile("billing")}
              className="text-black hover:text-white dark:text-white hover:cursor-pointer bg-white dark:bg-black w-full justify-start text-center px-4  py-2 rounded-none dark:hover:bg-red-800 active:dark:hover:bg-red-900 hover:bg-teal-500 active:hover:bg-teal-600"
            >
              <div className="ml-8 w-5">
                <CreditCard size={16} />
              </div>
              Billing & Plans
            </Button>

            {/* divider */}
            <div className="my-2 border-t border-teal-500 dark:border-red-900" />

            {/* App settings */}
            <Button
              onClick={() => navigateToProfile("app-settings")}
              className="text-black hover:text-white dark:text-white  bg-white dark:bg-black rounded-none w-full justify-start px-4 py-2 text-center dark:hover:bg-red-800 active:dark:hover:bg-red-900 hover:bg-teal-500 active:hover:bg-teal-600"
            >
              <div className="ml-8 w-5">
                <Settings size={16} />
              </div>
              App Settings
            </Button>

            {/* Help and Support */}
            <Button
              onClick={() => navigateToProfile("support")}
              className="text-black hover:text-white dark:text-white  bg-white dark:bg-black w-full justify-start rounded-none dark:hover:bg-red-800 active:dark:hover:bg-red-900 hover:bg-teal-500 active:hover:bg-teal-600 px-4 py-2  "
            >
              <div className="ml-8 w-5">
                <HelpCircle size={16} />
              </div>
              Help & Support
            </Button>

            {/* Tutorial */}
            <Button
              onClick={() => handleMenuItemClick(onTutorialClick)}
              className="text-black hover:text-white dark:text-white  bg-white dark:bg-black w-full justify-start rounded-none dark:hover:bg-red-800 active:dark:hover:bg-red-900 hover:bg-teal-500 active:hover:bg-teal-600 px-4 py-2  "
              title="Go Back to Tutorial"
            >
              <div className="ml-8 w-5">
                <BookPlus className="h-4 w-4" />
              </div>
              Tutorial
            </Button>

            {/* divider */}
            <div className="my-2 border-t border-teal-500 dark:border-red-900" />

            {/* Logout */}
            <Button
              // onClick={() => handleMenuItemClick(onLogoutClick)}
              className="text-teal-500 hover:text-white dark:text-red-500 bg-white dark:bg-black w-full justify-center rounded-none hover:cursor-pointer dark:hover:text-black dark:hover:bg-red-800 active:dark:hover:bg-red-900 hover:bg-teal-500 active:hover:bg-teal-600 px-4 py-2"
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
        
     
      
    </div>
    </div>
  );
};

export default UserDropdown;