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
  Send,
  Code as CodeIcon,
  BookCopy,
  Network,
  Wallet,
  Coins,
  Briefcase,
  Compass,
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
  items?: {
    title: string;
    url?: string;
    company?: "codeWithAli" | "simplicityFunds";
  }[];
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
          url: "/coldEmail",
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      // Code module — GitHub-lookalike repo dashboard. Folder with
      // collapsible children for the three primary surfaces.
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
    },

    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
};

export const headOfInternalAffairsData = {
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
    // {
    //   // Mixture-of-Operators control room. Surfaced for leadership
    //   // roles so they have visibility into the agent swarm.
    //   title: "Axon Swarm",
    //   url: "/axonSwarm",
    //   isActive: false,
    //   icon: Network,
    // },
    // {
    //   // Capital Plan — fundraising + budget + runway + AXON-advised
    //   // scenario modeling. Gated to CEO/COO/CFO via is_finance_role().
    //   title: "Capital Plan",
    //   url: "/capitalPlan",
    //   isActive: false,
    //   icon: Coins,
    // },
    // {
    //   title: "Roadmap",
    //   url: "/roadmap",
    //   isActive: false,
    //   icon: Map,
    // },
    // {
    //   title: "Analytics",
    //   url: "/analytics",
    //   isActive: false,
    //   icon: BarChart3,
    // },
    {
      title: "Candidates",
      url: "/hiring",
      isActive: false,
      icon: Inbox,
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
    // {
    //   title: "Submit Report",
    //   url: "/reports/submit",
    //   isActive: false,
    //   icon: Send,
    // },
    // {
    //   title: "Reports",
    //   url: "/reports",
    //   isActive: false,
    //   icon: Inbox,
    // },
    // {
    //   // Code module — GitHub-lookalike repo dashboard. The
    //   // `items` array makes the sidebar render it as a folder
    //   // with collapsible children (Repositories / Pull Requests
    //   // / Activity). The parent itself links to /code so a
    //   // click on the folder name also opens the dashboard.
    //   title: "Code",
    //   url: "/code",
    //   isActive: false,
    //   icon: CodeIcon,
    //   items: [
    //     { title: "Repositories",   url: "/code" },
    //     { title: "Pull Requests",  url: "/code" },
    //     { title: "AI Activity",    url: "/code" },
    //   ],
    // },
    // {
    //   title: "Components",
    //   url: "/components",
    //   isActive: false,
    //   icon: Package,
    // },
    // ── CWA-only items ──
    // {
    //   title: "Personal Life",
    //   url: "/personal",
    //   isActive: false,
    //   icon: User,
    //   company: "codeWithAli" as const,
    // },
    // {
    //   title: "Graduation Plan",
    //   url: "/graduationPlan",
    //   isActive: false,
    //   icon: GraduationCap,
    //   company: "codeWithAli" as const,
    // },
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        // {
        //   title: "Account Management",
        //   url: "/details",
        // },
        // {
        //   title: "Contract",
        //   url: "/contractGenerator",
        // },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
        // {
        //   title: "Bio",
        //   url: "/bio"
        // },
        {
          title: "Cold Email Generator",
          url: "/coldEmail",
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
      company: "codeWithAli" as const,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
      company: "codeWithAli" as const,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
      company: "codeWithAli" as const,
    },
    // // (Time Tracking has been merged into the Timesheet entry above.)
    // {
    //   title: "Arabic Learning",
    //   url: "/arabic",
    //   isActive: false,
    //   icon: Languages,
    //   company: "codeWithAli" as const,
    // },

    // ── Shared items ──
    // {
    //   title: "Users",
    //   url: "/employee",
    //   icon: Users,
    //   isActive: false,
    // },
    {
      title: "Finance Dashboard",
      url: "/financialDashboard",
      icon: DollarSign,
      isActive: false,
    },
    // {
    //   title: "Bookkeeping",
    //   url: "/bookkeeping",
    //   icon: BookCopy,
    //   isActive: false,
    // },

    // ── Simplicity-only items ──
    // {
    //   title: "Simplicity Admin",
    //   url: "/s-users",
    //   icon: SquareTerminal,
    //   isActive: true,
    //   company: "simplicityFunds" as const,
    //   items: [
    //     {
    //       title: "User Management",
    //       url: "/s-users",
    //     },
    //     {
    //       title: "Analytics & Surveys",
    //       url: "/s-analytics",
    //     },
    //     {
    //       title: "Broadcast Center",
    //       url: "/s-broadcast",
    //     },
    //     {
    //       title: "Manual Overrides",
    //       url: "/s-overrides",
    //     },
    //   ],
    // },
    // {
    //   title: "Financial Ops",
    //   url: "/s-finance-ops",
    //   icon: Activity,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // {
    //   title: "Subscriptions",
    //   url: "/invoicer",
    //   icon: CreditCard,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // {
    //   title: "Dev Console",
    //   url: "/s-dev-console",
    //   icon: Terminal,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    // {
    //   name: "Budgetary",
    //   url: "/budgetary",
    //   icon: Frame,
    //   company: "codeWithAli" as const,
    // },
  ],
};

export const headOfGrowthData = {
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
    // {
    //   // Mixture-of-Operators control room. Surfaced for leadership
    //   // roles so they have visibility into the agent swarm.
    //   title: "Axon Swarm",
    //   url: "/axonSwarm",
    //   isActive: false,
    //   icon: Network,
    // },
    // {
    //   // Capital Plan — fundraising + budget + runway + AXON-advised
    //   // scenario modeling. Gated to CEO/COO/CFO via is_finance_role().
    //   title: "Capital Plan",
    //   url: "/capitalPlan",
    //   isActive: false,
    //   icon: Coins,
    // },
    // {
    //   title: "Roadmap",
    //   url: "/roadmap",
    //   isActive: false,
    //   icon: Map,
    // },
    // {
    //   title: "Analytics",
    //   url: "/analytics",
    //   isActive: false,
    //   icon: BarChart3,
    // },
    {
      title: "Candidates",
      url: "/hiring",
      isActive: false,
      icon: Inbox,
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
    // {
    //   title: "Submit Report",
    //   url: "/reports/submit",
    //   isActive: false,
    //   icon: Send,
    // },
    // {
    //   title: "Reports",
    //   url: "/reports",
    //   isActive: false,
    //   icon: Inbox,
    // },
    // {
    //   // Code module — GitHub-lookalike repo dashboard. The
    //   // `items` array makes the sidebar render it as a folder
    //   // with collapsible children (Repositories / Pull Requests
    //   // / Activity). The parent itself links to /code so a
    //   // click on the folder name also opens the dashboard.
    //   title: "Code",
    //   url: "/code",
    //   isActive: false,
    //   icon: CodeIcon,
    //   items: [
    //     { title: "Repositories",   url: "/code" },
    //     { title: "Pull Requests",  url: "/code" },
    //     { title: "AI Activity",    url: "/code" },
    //   ],
    // },
    // {
    //   title: "Components",
    //   url: "/components",
    //   isActive: false,
    //   icon: Package,
    // },
    // ── CWA-only items ──
    // {
    //   title: "Personal Life",
    //   url: "/personal",
    //   isActive: false,
    //   icon: User,
    //   company: "codeWithAli" as const,
    // },
    // {
    //   title: "Graduation Plan",
    //   url: "/graduationPlan",
    //   isActive: false,
    //   icon: GraduationCap,
    //   company: "codeWithAli" as const,
    // },
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        // {
        //   title: "Account Management",
        //   url: "/details",
        // },
        // {
        //   title: "Contract",
        //   url: "/contractGenerator",
        // },
        {
          title: "Mod logs",
          url: "/mod_logs",
        },
        // {
        //   title: "Bio",
        //   url: "/bio"
        // },
        {
          title: "Cold Email Generator",
          url: "/coldEmail",
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
      company: "codeWithAli" as const,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
      company: "codeWithAli" as const,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
      company: "codeWithAli" as const,
    },
    // (Time Tracking has been merged into the Timesheet entry above.)
    {
      title: "Arabic Learning",
      url: "/arabic",
      isActive: false,
      icon: Languages,
      company: "codeWithAli" as const,
    },

    // ── Shared items ──
    // {
    //   title: "Users",
    //   url: "/employee",
    //   icon: Users,
    //   isActive: false,
    // },
    {
      title: "Finance Dashboard",
      url: "/financialDashboard",
      icon: DollarSign,
      isActive: false,
    },
    // {
    //   title: "Bookkeeping",
    //   url: "/bookkeeping",
    //   icon: BookCopy,
    //   isActive: false,
    // },

    // ── Simplicity-only items ──
    // {
    //   title: "Simplicity Admin",
    //   url: "/s-users",
    //   icon: SquareTerminal,
    //   isActive: true,
    //   company: "simplicityFunds" as const,
    //   items: [
    //     {
    //       title: "User Management",
    //       url: "/s-users",
    //     },
    //     {
    //       title: "Analytics & Surveys",
    //       url: "/s-analytics",
    //     },
    //     {
    //       title: "Broadcast Center",
    //       url: "/s-broadcast",
    //     },
    //     {
    //       title: "Manual Overrides",
    //       url: "/s-overrides",
    //     },
    //   ],
    // },
    // {
    //   title: "Financial Ops",
    //   url: "/s-finance-ops",
    //   icon: Activity,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // {
    //   title: "Subscriptions",
    //   url: "/invoicer",
    //   icon: CreditCard,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // {
    //   title: "Dev Console",
    //   url: "/s-dev-console",
    //   icon: Terminal,
    //   isActive: false,
    //   company: "simplicityFunds" as const,
    // },
    // Settings moved to the profile dropdown (see nav-user.tsx).
  ],
  projects: [
    // {
    //   name: "Budgetary",
    //   url: "/budgetary",
    //   icon: Frame,
    //   company: "codeWithAli" as const,
    // },
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
      title: "Candidates",
      url: "/hiring",
      isActive: false,
      icon: Inbox,
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
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      title: "Reports",
      url: "/reports",
      isActive: false,
      icon: Inbox,
    },
    {
      // Code module — GitHub-lookalike repo dashboard. The
      // `items` array makes the sidebar render it as a folder
      // with collapsible children (Repositories / Pull Requests
      // / Activity). The parent itself links to /code so a
      // click on the folder name also opens the dashboard.
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Strategy",
      url: "/strategy",
      isActive: false,
      icon: Compass,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      // Code module — GitHub-lookalike repo dashboard. Folder with
      // collapsible children for the three primary surfaces.
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
    },
    {
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      // Code module — GitHub-lookalike repo dashboard. Folder with
      // collapsible children for the three primary surfaces.
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
    // ── Standalones up top — the rest is grouped under collapsibles. ──
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
      company: "codeWithAli" as const,
    },
    {
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
      company: "codeWithAli" as const,
    },
    // ── Hiring & people ──
    {
      title: "Hiring",
      url: "/hiring",
      icon: ClipboardCheck,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Candidates", url: "/hiring" },
        { title: "Offer Letters", url: "/offers" },
        { title: "Onboarding", url: "/onboarding" },
        { title: "Users", url: "/employee" },
        { title: "Training Plan", url: "/trainingplan" },
        { title: "Contract", url: "/contractGenerator" },
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
        { title: "Dashboard", url: "/financialDashboard" },
        { title: "Invoicer", url: "/invoicer" },
        { title: "Bookkeeping", url: "/bookkeeping" },
      ],
    },

    // ── Day-to-day operations ──
    {
      title: "Operations",
      url: "/operations",
      icon: ClipboardList,
      isActive: false,
      company: "codeWithAli" as const,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      icon: Clock,
      isActive: false,
      company: "codeWithAli" as const,
    },

    // ── Insights, planning, building blocks ──
    {
      title: "Insights",
      url: "/analytics",
      icon: BarChart3,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Analytics", url: "/analytics" },
        { title: "Submit Report", url: "/reports/submit" },
        { title: "Reports", url: "/reports" },
        { title: "Code", url: "/code" },
        { title: "Roadmap", url: "/roadmap" },
        { title: "Components", url: "/components" },
      ],
    },

    // ── Personal space ──
    {
      title: "Personal",
      url: "/personal",
      icon: User,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Personal Life", url: "/personal" },
        { title: "Graduation Plan", url: "/graduationPlan" },
        { title: "Arabic Learning", url: "/arabic" },
        { title: "Bio", url: "/bio" },
        { title: "Cold Email", url: "/coldEmail" },
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
        { title: "Axon Swarm", url: "/axonSwarm" },
        { title: "Strategy", url: "/strategy" },
        { title: "Funding", url: "/funding" },
        { title: "Mod Logs", url: "/mod_logs" },
        { title: "Capital Plan", url: "/capitalPlan" },
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
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
      company: "codeWithAli" as const,
    },
    {
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
      company: "codeWithAli" as const,
    },
    // ── Hiring & people ──
    {
      title: "Hiring",
      url: "/hiring",
      icon: ClipboardCheck,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Candidates", url: "/hiring" },
        { title: "Offer Letters", url: "/offers" },
        { title: "Onboarding", url: "/onboarding" },
        { title: "Users", url: "/employee" },
        { title: "Training Plan", url: "/trainingplan" },
        { title: "Contract", url: "/contractGenerator" },
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
        { title: "Dashboard", url: "/financialDashboard" },
        { title: "Invoicer", url: "/invoicer" },
        { title: "Bookkeeping", url: "/bookkeeping" },
      ],
    },

    // ── Day-to-day operations ──
    {
      title: "Operations",
      url: "/operations",
      icon: ClipboardList,
      isActive: false,
      company: "codeWithAli" as const,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      icon: Clock,
      isActive: false,
      company: "codeWithAli" as const,
    },

    // ── Insights, planning, building blocks ──
    {
      title: "Insights",
      url: "/analytics",
      icon: BarChart3,
      isActive: false,
      company: "codeWithAli" as const,
      items: [
        { title: "Analytics", url: "/analytics" },
        { title: "Submit Report", url: "/reports/submit" },
        { title: "Reports", url: "/reports" },
        { title: "Code", url: "/code" },
        { title: "Roadmap", url: "/roadmap" },
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
        { title: "Personal Life", url: "/personal" },
        { title: "Graduation Plan", url: "/graduationPlan" },
        { title: "Arabic Learning", url: "/arabic" },
        { title: "Bio", url: "/bio" },
        { title: "Cold Email", url: "/coldEmail" },
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
        { title: "Axon Swarm", url: "/axonSwarm" },
        { title: "Strategy", url: "/strategy" },
        { title: "Funding", url: "/funding" },
        { title: "Mod Logs", url: "/mod_logs" },
        { title: "Capital Plan", url: "/capitalPlan" },
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
      // Capital Plan — fundraising + budget + runway + AXON-advised
      // scenario modeling. The CFO's primary command surface for the
      // raise-and-deploy workflow.
      title: "Capital Plan",
      url: "/capitalPlan",
      isActive: false,
      icon: Coins,
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
      title: "Candidates",
      url: "/hiring",
      isActive: false,
      icon: Inbox,
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
      title: "Submit Report",
      url: "/reports/submit",
      isActive: false,
      icon: Send,
    },
    {
      title: "Reports",
      url: "/reports",
      isActive: false,
      icon: Inbox,
    },
    {
      // Code module — GitHub-lookalike repo dashboard. Folder with
      // collapsible children for the three primary surfaces.
      title: "Code",
      url: "/code",
      isActive: false,
      icon: CodeIcon,
      items: [
        { title: "Repositories", url: "/code" },
        { title: "Pull Requests", url: "/code" },
        { title: "AI Activity", url: "/code" },
      ],
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
      title: "Workspace",
      url: "/workspace",
      isActive: false,
      icon: FileText,
    },
    {
      title: "Operations",
      url: "/operations",
      isActive: false,
      icon: Briefcase,
    },
    {
      title: "Strategy",
      url: "/strategy",
      isActive: false,
      icon: Compass,
    },
    {
      title: "Timesheet",
      url: "/timesheet",
      isActive: false,
      icon: Clock,
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

// ── Helpers ─────────────────────────────────────────────────────────
// Imported by app-sidebar.tsx. Keep their signatures in sync with the
// ProjectItem / NavItem shapes above.

type CompanyScope = "codeWithAli" | "simplicityFunds" | "all";

/**
 * Filter a navMain array by the current active company.
 *
 * Rules:
 *   • activeCompany === "all"            → include everything
 *   • entry has no `company` field       → include (company-agnostic)
 *   • entry.company === activeCompany    → include
 *   • otherwise                          → drop
 *
 * Recurses into `items` so groups with company-scoped children are
 * filtered too. Generic over the entry shape so it works for both
 * top-level NavItems and nested item shapes — only the optional
 * `company` and `items` fields are touched.
 */
export function filterNavByCompany<
  T extends { company?: string; items?: T[] }
>(navMain: T[], activeCompany: CompanyScope): T[] {
  if (activeCompany === "all") return navMain;
  return navMain
    .filter(
      (entry) =>
        entry.company === undefined || entry.company === activeCompany,
    )
    .map((entry) => {
      if (entry.items && entry.items.length > 0) {
        return {
          ...entry,
          items: filterNavByCompany(entry.items, activeCompany),
        };
      }
      return entry;
    });
}

/**
 * Filter a `projects` array (the sidebar's "PROJECTS" group, not the
 * /projects page) by the active company. Same gating rules as
 * filterNavByCompany — entries without a `company` field are
 * company-agnostic and always pass through.
 */
export function filterProjectsByCompany<
  T extends { company?: string }
>(projects: T[], activeCompany: CompanyScope): T[] {
  if (activeCompany === "all") return projects;
  return projects.filter(
    (p) => p.company === undefined || p.company === activeCompany,
  );
}