import {
  Frame,
  SquareTerminal,
  MessageCircle,
  Home,
  ClipboardList,
  GalleryVerticalEnd,
  AudioWaveform,
  Command,
  Target,
  File,
  CalendarDays,
  Bot,
  Clock,
  GraduationCap,
  User,
  Languages,
  Users,
  BarChart3,
  Radio,
  DollarSign,
  Wrench,
  Terminal,
  CreditCard,
  Activity,
  Map,
  FileText,
  Package,
  ClipboardCheck,
  Inbox,
  BookCopy,
  Network,
  type LucideIcon,
} from "lucide-react";

/* ─── Types ─── */
export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  /** Which company this item belongs to. undefined = shared (both). */
  company?: "codeWithAli" | "simplicityFunds";
  items?: { title: string; url?: string; company?: "codeWithAli" | "simplicityFunds" }[];
}

export interface ProjectItem {
  name: string;
  url: string;
  icon: LucideIcon;
  company?: "codeWithAli" | "simplicityFunds";
}

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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
    },

    // Settings moved to the profile dropdown (see nav-user.tsx).
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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
    },
 
    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
};

// Account Manager data set ( What account managers can see )
export const accountManagerData = {
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
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      company: "codeWithAli" as const,
      items: [
        {
          title: "Contract",
          url: "/contractGenerator",
        },
        {
          title: "Cold Email Generator",
          url: "/coldEmail"
        },
      ],
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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
    // Settings moved to the profile dropdown (see nav-user.tsx).
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
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        // {
        //   title: "Email Broadcast",
        //   url: "/broadcast",
        // },
        {
          title: "Account Management",
          url: "/details",
        },
        // {
        //   title: "Users",
        //   url: "/employee",
        // },
        // {
        //   title: "Mod logs",
        //   url: "/mod_logs",
        // },
      ],
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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
    },
 
    // Settings moved to the profile dropdown (see nav-user.tsx).
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
      name: "Members",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      // Mixture-of-Operators control room. Shows every Axon's live
      // status, capabilities, signal sources, and inter-agent
      // bridges. Admin-only — surfaced here for the founder & ops
      // leads who need visibility into the agent swarm.
      title: "Axon Swarm",
      url: "/axonSwarm",
      isActive: false,
      icon: Network,
    },
    {
      title: "Analytics",
      url: "/analytics",
      isActive: false,
      icon: BarChart3,
    },
    {
      title: "Offer Letters",
      url: "/offers",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Onboarding",
      url: "/onboarding",
      isActive: false,
      icon: ClipboardCheck,
    },
    {
      title: "Reports",
      url: "/reports",
      isActive: false,
      icon: Inbox,
    },
    {
      title: "Components",
      url: "/components",
      isActive: false,
      icon: Package,
    },
    {
      title: "Admin Permissions",
      url: "/mod_logs",
      icon: SquareTerminal,
      isActive: true,
      // items: [
      //   // {
      //   //   title: "Email Broadcast",
      //   //   url: "/broadcast",
      //   // },
      //   // {
      //   //   title: "Account Management",
      //   //   url: "/details",
      //   // },
      //   // {
      //   //   title: "Users",
      //   //   url: "/employee",
      //   // },
      //   // {
      //   //   title: "Mod logs",
      //   //   url: "/mod_logs",
      //   // },

      // ],
    },
    // {
    //   title: "Bot Management",
    //   url: "/bot",
    //   icon: Bot,
    // },

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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
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

 
    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    {
      name: "Budgetary",
      url: "/budgetary",
      icon: Frame,
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
      name: "Members",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        // {
        //   title: "Email Broadcast",
        //   url: "/broadcast",
        // },
        {
          title: "Account Management",
          url: "/details",
        },
        // {
        //   title: "Users",
        //   url: "/employee",
        // },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
      ],
    },
    // {
    //   title: "Bot Management",
    //   url: "/bot",
    //   icon: Bot,
    // },
    {
      title: "Invoicer",
      url: "/invoicer",
      icon: File,
      isActive: false,
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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
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

    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    {
      name: "Budgetary",
      url: "/budgetary",
      icon: Frame,
    },
  ],
};

export const securityEngineerData = {
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
      name: "Members",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        // {
        //   title: "Email Broadcast",
        //   url: "/broadcast",
        // },
        {
          title: "Account Management",
          url: "/details",
        },
        // {
        //   title: "Users",
        //   url: "/employee",
        // },
        {
          title: "Finance Dashboard",
          url: "/financialDashboard",
        },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
      ],
    },
    // {
    //   title: "Bot Management",
    //   url: "/bot",
    //   icon: Bot,
    // },
    {
      title: "Invoicer",
      url: "/invoicer",
      icon: File,
      isActive: false,
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
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
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


    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    {
      name: "Budgetary",
      url: "/budgetary",
      icon: Frame,
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
      name: "Members",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      // Mixture-of-Operators control room. Surfaced for leadership
      // roles so they have visibility into the agent swarm.
      title: "Axon Swarm",
      url: "/axonSwarm",
      isActive: false,
      icon: Network,
    },
    {
      title: "Roadmap",
      url: "/roadmap",
      isActive: false,
      icon: Map,
    },
    {
      title: "Analytics",
      url: "/analytics",
      isActive: false,
      icon: BarChart3,
    },
    {
      title: "Offer Letters",
      url: "/offers",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Onboarding",
      url: "/onboarding",
      isActive: false,
      icon: ClipboardCheck,
    },
    {
      title: "Reports",
      url: "/reports",
      isActive: false,
      icon: Inbox,
    },
    {
      title: "Components",
      url: "/components",
      isActive: false,
      icon: Package,
    },
    // ── CWA-only items ──
    {
      title: "Personal Life",
      url: "/personal",
      isActive: false,
      icon: User,
      company: "codeWithAli" as const,
    },
    {
      title: "Graduation Plan",
      url: "/graduationPlan",
      isActive: false,
      icon: GraduationCap,
      company: "codeWithAli" as const,
    },
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      company: "codeWithAli" as const,
      items: [
        {
          title: "Account Management",
          url: "/details",
        },
        {
          title: "Contract",
          url: "/contractGenerator",
        },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
        {
          title: "Bio",
          url: "/bio"
        },
        {
          title: "Cold Email Generator",
          url: "/coldEmail"
        },
      ],
    },
    {
      title: "Invoicer",
      url: "/invoicer",
      icon: File,
      isActive: false,
      company: "codeWithAli" as const,
    },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
      company: "codeWithAli" as const,
    },
    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
      company: "codeWithAli" as const,
    },
    {
      title: "Weekly Quotas",
      url: "/quota",
      isActive: false,
      icon: Target,
      company: "codeWithAli" as const,
    },
    {
      title: "Schedule",
      url: "/schedule",
      isActive: false,
      icon: CalendarDays,
      company: "codeWithAli" as const,
    },
    {
      title: "Time Tracking",
      url: "/timetracking",
      isActive: false,
      icon: Clock,
      company: "codeWithAli" as const,
    },
    {
      title: "Arabic Learning",
      url: "/arabic",
      isActive: false,
      icon: Languages,
      company: "codeWithAli" as const,
    },

    // ── Shared items ──
    {
      title: "Users",
      url: "/employee",
      icon: Users,
      isActive: false,
    },
    {
      title: "Finance Dashboard",
      url: "/financialDashboard",
      icon: DollarSign,
      isActive: false,
    },
    {
      title: "Bookkeeping",
      url: "/bookkeeping",
      icon: BookCopy,
      isActive: false,
    },

    // ── Simplicity-only items ──
    {
      title: "Simplicity Admin",
      url: "/s-users",
      icon: SquareTerminal,
      isActive: true,
      company: "simplicityFunds" as const,
      items: [
        {
          title: "User Management",
          url: "/s-users",
        },
        {
          title: "Analytics & Surveys",
          url: "/s-analytics",
        },
        {
          title: "Broadcast Center",
          url: "/s-broadcast",
        },
        {
          title: "Manual Overrides",
          url: "/s-overrides",
        },
      ],
    },
    {
      title: "Financial Ops",
      url: "/s-finance-ops",
      icon: Activity,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Subscriptions",
      url: "/invoicer",
      icon: CreditCard,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Dev Console",
      url: "/s-dev-console",
      icon: Terminal,
      isActive: false,
      company: "simplicityFunds" as const,
    },

    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    {
      name: "Budgetary",
      url: "/budgetary",
      icon: Frame,
      company: "codeWithAli" as const,
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
      name: "Members",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    // ── Standalones up top — the rest is grouped under collapsibles. ──
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      // Mixture-of-Operators control room. Surfaced for leadership
      // roles so they have visibility into the agent swarm.
      title: "Axon Swarm",
      url: "/axonSwarm",
      isActive: false,
      icon: Network,
    },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
      company: "codeWithAli" as const,
    },

    // ── Hiring & people ──
    {
      title: "Hiring",
      url: "/offers",
      icon: ClipboardCheck,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Offer Letters",  url: "/offers" },
        { title: "Onboarding",     url: "/onboarding" },
        { title: "Users",          url: "/employee" },
        { title: "Training Plan",  url: "/trainingplan" },
        { title: "Contract",       url: "/contractGenerator" },
      ],
    },

    // ── Finance ──
    {
      title: "Finance",
      url: "/financialDashboard",
      icon: DollarSign,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Dashboard",  url: "/financialDashboard" },
        { title: "Invoicer",   url: "/invoicer" },
        { title: "Bookkeeping", url: "/bookkeeping" },
      ],
    },

    // ── Day-to-day operations ──
    {
      title: "Operations",
      url: "/task",
      icon: ClipboardList,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Tasks",         url: "/task" },
        { title: "Weekly Quotas", url: "/quota" },
        { title: "Schedule",      url: "/schedule" },
        { title: "Time Tracking", url: "/timetracking" },
      ],
    },

    // ── Insights, planning, building blocks ──
    {
      title: "Insights",
      url: "/analytics",
      icon: BarChart3,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Analytics",  url: "/analytics" },
        { title: "Reports",    url: "/reports" },
        { title: "Roadmap",    url: "/roadmap" },
        { title: "Components", url: "/components" },
      ],
    },

    // ── Ali's personal space (private to CEO) ──
    {
      title: "Personal",
      url: "/personal",
      icon: User,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Personal Life",    url: "/personal" },
        { title: "Graduation Plan",  url: "/graduationPlan" },
        { title: "Arabic Learning",  url: "/arabic" },
        { title: "Bio",              url: "/bio" },
        { title: "Cold Email",       url: "/coldEmail" },
      ],
    },

    // ── Admin / privileged controls ──
    {
      title: "Admin",
      url: "/details",
      icon: SquareTerminal,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Account Management", url: "/details" },
        { title: "Mod Logs",           url: "/mod_logs" },
      ],
    },

    // ── Simplicity-only items ──
    {
      title: "Simplicity Admin",
      url: "/s-users",
      icon: SquareTerminal,
      isActive: true,
      company: "simplicityFunds" as const,
      items: [
        {
          title: "User Management",
          url: "/s-users",
        },
        {
          title: "Analytics & Surveys",
          url: "/s-analytics",
        },
        {
          title: "Broadcast Center",
          url: "/s-broadcast",
        },
        {
          title: "Manual Overrides",
          url: "/s-overrides",
        },
      ],
    },
    {
      title: "Financial Ops",
      url: "/s-finance-ops",
      icon: Activity,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Subscriptions",
      url: "/invoicer",
      icon: CreditCard,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Dev Console",
      url: "/s-dev-console",
      icon: Terminal,
      isActive: false,
      company: "simplicityFunds" as const,
    },

    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    {
      name: "Budgetary",
      url: "/budgetary",
      icon: Frame,
      company: "codeWithAli" as const,
    },
  ],
};

// CFO Data set (What the CFO can see) — finance-first, cross-company.
export const cfoData = {
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
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    },
    {
      // Mixture-of-Operators control room. Surfaced for leadership
      // roles so they have visibility into the agent swarm.
      title: "Axon Swarm",
      url: "/axonSwarm",
      isActive: false,
      icon: Network,
    },
    {
      title: "Roadmap",
      url: "/roadmap",
      isActive: false,
      icon: Map,
    },
    {
      title: "Analytics",
      url: "/analytics",
      isActive: false,
      icon: BarChart3,
    },
    {
      title: "Offer Letters",
      url: "/offers",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Onboarding",
      url: "/onboarding",
      isActive: false,
      icon: ClipboardCheck,
    },
    {
      title: "Reports",
      url: "/reports",
      isActive: false,
      icon: Inbox,
    },
    {
      title: "Components",
      url: "/components",
      isActive: false,
      icon: Package,
    },
    {
      title: "Finance Dashboard",
      url: "/financialDashboard",
      icon: DollarSign,
      isActive: false,
    },
    {
      title: "Bookkeeping",
      url: "/bookkeeping",
      icon: BookCopy,
      isActive: false,
    },
    {
      title: "Invoicer",
      url: "/invoicer",
      icon: File,
      isActive: false,
      company: "codeWithAli" as const,
    },
    {
      title: "Financial Ops",
      url: "/s-finance-ops",
      icon: Activity,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Subscriptions",
      url: "/invoicer",
      icon: CreditCard,
      isActive: false,
      company: "simplicityFunds" as const,
    },
    {
      title: "Users",
      url: "/employee",
      icon: Users,
      isActive: false,
    },
    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [] as ProjectItem[],
};

/* ─── Helper: filter nav items by active company ─── */
export function filterNavByCompany(
  items: NavItem[],
  activeCompany: "all" | "codeWithAli" | "simplicityFunds"
): NavItem[] {
  if (activeCompany === "all") return items;
  return items.filter((item) => {
    if (!item.company) return true; // shared — always show
    return item.company === activeCompany;
  });
}

export function filterProjectsByCompany(
  projects: ProjectItem[],
  activeCompany: "all" | "codeWithAli" | "simplicityFunds"
): ProjectItem[] {
  if (activeCompany === "all") return projects;
  return projects.filter((p) => {
    if (!p.company) return true;
    return p.company === activeCompany;
  });
}
