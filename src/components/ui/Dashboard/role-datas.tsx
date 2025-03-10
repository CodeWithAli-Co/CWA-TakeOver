// const data = {
//   user: {
//     name: "CodeWithAli",
//     email: "unfold@codewithali.com",
//     avatar: "/public/codewithali_logo.png",
//   },
//   teams: [
//     {
//       name: "CodeWithAli Co.",
//       logo: GalleryVerticalEnd,
//       plan: "Enterprise",
//     },
//     {
//       name: "Interns",
//       logo: AudioWaveform,
//       plan: "Startup",
//     },
//     {
//       name: "Evil Corp.",
//       logo: Command,
//       plan: "Free",
//     },
//   ],
//   navMain: [
//     {
//       title: "Admin Permissions",
//       url: "/details",
//       icon: SquareTerminal,
//       isActive: true,
//       items: [
//         {
//           title: "Email Broadcast",
//           url: "/broadcast",
//         },
//         {
//           title: "Account Management",
//           url: "/details",
//         },
//         {
//           title: "Users",
//           url: "/employee",
//         },
//         {
//           title: "Mod logs",
//           url: "/mod_logs",
//         },
    
//       ],
//     },
//     {
//       title: "Bot Management",
//       url: "/bot",
//       icon: Bot,
//     },

//     {
//       title: "Chat",
//       url: "/chat",
//       isActive: false,
//       icon: MessageCircle,
//     },

//     {
//       title: "Task",
//       url: "/task",
//       isActive: false,
//       icon: ClipboardList,
//     },
//     {
//       title: "Home",
//       url: "/",
//       isActive: false,
//       icon: Home,
//     },
//     {
//       title: "Schedule",
//       url: "/schedule",
//       isActive: false,
//       icon: CalendarDays,
//     },
//     // {
//     //   title: "BioTech",
//     //   url: "/bio",
//     //   isActive: false,
//     //   icon: Cat,
//     // },

//     {
//       title: "Settings",
//       url: "/settings",
//       icon: Settings2,
//       items: [
//         {
//           // // In your sidebar navigation <Link to="/settings">Settings</Link>
//           title: "General",
//           url: "/settings",
//         },
//         {
//           title: "Team",
//           url: "/settings?tab=teams",
//         },
//         {
//           title: "Tasks",
//           url: "/settings?tab=tasks",
//         },
//         {
//           title: "Company",
//           url: "/settings?tab=company",
//         },
//         {
//           title: "Notification",
//           url: "/settings?tab=notification",
//         },
//       ],
//     },
//   ],
//   projects: [
//     {
//       name: "Design Engineering",
//       url: "#",
//       icon: Frame,
//     },
//     {
//       name: "Sales & Marketing",
//       url: "#",
//       icon: PieChart,
//     },
//     {
//       name: "Travel",
//       url: "#",
//       icon: Map,
//     },
//   ],
// };

import {
  Bot,
  Frame,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  MessageCircle,
  Home,
  ClipboardList,
  CalendarDays,
  GalleryVerticalEnd,
  AudioWaveform,
  Command,
} from "lucide-react";

// Intern Data set (What Interns can see)
export const internData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },
    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
    },
  ],
};

// Member Data set (What Members can see)
export const memberData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },
    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
    },
  ],
};

// Markerting Specialist Data set (What Markerting Specialists can see)
export const marketingData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },
    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
    },
  ],
};

// Admin Data set (What Admins can see)
export const adminData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  teams: [
    {
      name: "CodeWithAli Co.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Interns",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Bot Management",
      url: "/bot",
      icon: Bot,
    },

    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },

    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
    // {
    //   title: "BioTech",
    //   url: "/bio",
    //   isActive: false,
    //   icon: Cat,
    // },

    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          // // In your sidebar navigation <Link to="/settings">Settings</Link>
          title: "General",
          url: "/settings",
        },
        {
          title: "Team",
          url: "/settings?tab=teams",
        },
        {
          title: "Tasks",
          url: "/settings?tab=tasks",
        },
        {
          title: "Company",
          url: "/settings?tab=company",
        },
        {
          title: "Notification",
          url: "/settings?tab=notification",
        },
      ],
    },
  ],
};

// Project Manager Data set (What Project Managers can see)
export const projectManagerData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  teams: [
    {
      name: "CodeWithAli Co.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Interns",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Bot Management",
      url: "/bot",
      icon: Bot,
    },

    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },

    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
    // {
    //   title: "BioTech",
    //   url: "/bio",
    //   isActive: false,
    //   icon: Cat,
    // },

    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          // // In your sidebar navigation <Link to="/settings">Settings</Link>
          title: "General",
          url: "/settings",
        },
        {
          title: "Team",
          url: "/settings?tab=teams",
        },
        {
          title: "Tasks",
          url: "/settings?tab=tasks",
        },
        {
          title: "Company",
          url: "/settings?tab=company",
        },
        {
          title: "Notification",
          url: "/settings?tab=notification",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

// COO Data set (What the COO can see)
export const cooData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  teams: [
    {
      name: "CodeWithAli Co.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Interns",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Email Broadcast",
          url: "/broadcast",
        },
        {
          title: "Account Management",
          url: "/details",
        },
        {
          title: "Users",
          url: "/employee",
        },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
    
      ],
    },
    {
      title: "Bot Management",
      url: "/bot",
      icon: Bot,
    },

    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },

    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
    // {
    //   title: "BioTech",
    //   url: "/bio",
    //   isActive: false,
    //   icon: Cat,
    // },

    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          // // In your sidebar navigation <Link to="/settings">Settings</Link>
          title: "General",
          url: "/settings",
        },
        {
          title: "Team",
          url: "/settings?tab=teams",
        },
        {
          title: "Tasks",
          url: "/settings?tab=tasks",
        },
        {
          title: "Company",
          url: "/settings?tab=company",
        },
        {
          title: "Notification",
          url: "/settings?tab=notification",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

// CEO Data set (What the CEO can see)
export const ceoData = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  teams: [
    {
      name: "CodeWithAli Co.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Interns",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Email Broadcast",
          url: "/broadcast",
        },
        {
          title: "Account Management",
          url: "/details",
        },
        {
          title: "Users",
          url: "/employee",
        },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
    
      ],
    },
    {
      title: "Bot Management",
      url: "/bot",
      icon: Bot,
    },

    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },

    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
    // {
    //   title: "BioTech",
    //   url: "/bio",
    //   isActive: false,
    //   icon: Cat,
    // },

    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          // // In your sidebar navigation <Link to="/settings">Settings</Link>
          title: "General",
          url: "/settings",
        },
        {
          title: "Team",
          url: "/settings?tab=teams",
        },
        {
          title: "Tasks",
          url: "/settings?tab=tasks",
        },
        {
          title: "Company",
          url: "/settings?tab=company",
        },
        {
          title: "Notification",
          url: "/settings?tab=notification",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};
