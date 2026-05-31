import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { takeOversupabase } from "@/MyComponents/supabase";
import { useCompanyFilter } from "@/stores/store";

interface TeamMember {
  id: string;
  username: string;
  role: string;
  avatar: string;
  avatarUrl: string;
  // Since app_users doesn't have company_id yet, we'll assign visually
  company: "codeWithAli" | "simplicityFunds" | "both";
}

const companyDot: Record<string, string> = {
  codeWithAli: "bg-red-500",
  simplicityFunds: "bg-blue-500",
  both: "bg-white/20",
};

const companyLabel: Record<string, string> = {
  codeWithAli: "CWA",
  simplicityFunds: "SMP",
  both: "Both",
};

export const TeamPresence = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const { activeCompany } = useCompanyFilter();

  useEffect(() => {
    async function loadTeam() {
      const { data, error } = await takeOversupabase
  .from("app_users")
        .select("supa_id, username, role, avatar");

      if (error || !data) return;

      const mapped: TeamMember[] = data.map((m) => {
        const { data: avatarData } = takeOversupabase.storage
          .from("avatars")
          .getPublicUrl(m.avatar || "default_avatar.png");
        return {
          id: m.supa_id,
          username: m.username,
          role: m.role || "Member",
          avatar: m.avatar,
          avatarUrl: avatarData.publicUrl,
          // Assign company based on role heuristic for now
          // CEO/COO work on both, others default to CWA
          company:
            m.role === "CEO" || m.role === "COO"
              ? "both"
              : "codeWithAli",
        };
      });

      setMembers(mapped);
    }
    loadTeam();
  }, []);

  const filtered =
    activeCompany === "all"
      ? members
      : members.filter((m) => m.company === activeCompany || m.company === "both");

  return (
    <div className="space-y-2">
      {filtered.map((member, i) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 py-1 group"
        >
          <div className="relative">
            <img
              src={member.avatarUrl}
              alt={member.username}
              className="h-7 w-7 rounded-full object-cover border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/default_avatar.png";
              }}
            />
            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-card flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground/60 font-medium truncate group-hover:text-foreground/80 transition-colors">
              {member.username}
            </p>
            <p className="text-[11px] text-muted-foreground/40">{member.role}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className={`h-1 w-1 rounded-full ${companyDot[member.company]}`} />
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
              {companyLabel[member.company]}
            </span>
          </div>
        </motion.div>
      ))}
      {filtered.length === 0 && (
        <p className="text-[12px] text-muted-foreground/40 text-center py-4">No team members</p>
      )}
    </div>
  );
};
