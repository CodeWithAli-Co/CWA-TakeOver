// ───────────────────────────────────────────────────────────────────
// PrimaryNav — the left column. The 30-route sidebar collapses to four
// destinations that match the mission; the old modules drop into a
// quiet "go deep when needed" group below a divider. Product is labeled
// "Takeover"; the company switcher stays.
// ───────────────────────────────────────────────────────────────────
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Sun,
  Building2,
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  ClipboardList,
  PiggyBank,
  Inbox,
  MessageSquare,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { CompanyToggle } from "@/MyComponents/CompanyToggle/CompanyToggle";

interface NavRow {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  soon?: boolean;
}

function Row({ r }: { r: NavRow }) {
  const navigate = useNavigate();
  const go = () => {
    if (r.onClick) r.onClick();
    else if (r.to) navigate({ to: r.to as any });
  };
  return (
    <button
      type="button"
      onClick={go}
      className="group w-full flex items-center gap-3 h-9 px-3 rounded-md transition-colors"
      style={{ background: r.active ? "rgba(255,255,255,0.05)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!r.active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!r.active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <r.icon
        size={16}
        strokeWidth={1.6}
        style={{ color: r.active ? "#F4F4F5" : "#8A8A93" }}
      />
      <span
        className="text-[13px] tracking-tight"
        style={{ color: r.active ? "#F4F4F5" : "#A1A1AA", fontWeight: r.active ? 500 : 400 }}
      >
        {r.label}
      </span>
      {r.soon && (
        <span className="ml-auto text-[9px] uppercase tracking-[0.14em] text-zinc-600">soon</span>
      )}
    </button>
  );
}

export function PrimaryNav({ onAxon }: { onAxon: () => void }) {
  const primary: NavRow[] = [
    { label: "Axon", icon: Sparkles, onClick: onAxon },
    { label: "Today", icon: Sun, to: "/today", active: true },
    { label: "Companies & People", icon: Building2, to: "/sales", soon: true },
    { label: "Workspace", icon: FileText, to: "/workspace" },
  ];
  const deep: NavRow[] = [
    { label: "Sales", icon: TrendingUp, to: "/sales" },
    { label: "Finance", icon: DollarSign, to: "/financialDashboard" },
    { label: "Hiring", icon: Users, to: "/hiring" },
    { label: "Operations", icon: ClipboardList, to: "/operations" },
    { label: "Fundraise", icon: PiggyBank, to: "/fundraise" },
    { label: "Inbox", icon: Inbox, to: "/inbox" },
    { label: "Chat", icon: MessageSquare, to: "/chat" },
    { label: "Insights", icon: BarChart3, to: "/analytics" },
    { label: "Admin", icon: Settings, to: "/settings" },
  ];

  return (
    <nav
      className="h-full flex flex-col shrink-0 w-[232px] border-r border-white/[0.06]"
      style={{ background: "#0B0B0E" }}
    >
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center"
            style={{ background: "#E2435B" }}
          >
            <span className="text-[12px] font-bold text-white" style={{ fontFamily: "Newsreader, serif" }}>T</span>
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-zinc-100">Takeover</span>
        </div>
      </div>

      <div className="px-2 space-y-0.5">
        {primary.map((r) => (
          <Row key={r.label} r={r} />
        ))}
      </div>

      <div className="mx-4 my-4 h-px bg-white/[0.06]" />

      <div className="px-2">
        <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          Go deep
        </div>
        <div className="space-y-0.5 opacity-80">
          {deep.map((r) => (
            <Row key={r.label} r={r} />
          ))}
        </div>
      </div>

      <div className="mt-auto p-3 border-t border-white/[0.06]">
        <CompanyToggle />
      </div>
    </nav>
  );
}

export default PrimaryNav;
