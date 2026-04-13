import { motion } from "framer-motion";
import { Building2, TrendingUp, Users, FolderKanban, ArrowUpRight } from "lucide-react";
import { useCompanyFilter, type CompanyFilter } from "@/stores/store";

interface CompanyCardProps {
  name: string;
  description: string;
  memberCount: number;
  projectCount: number;
  revenue: string;
  status: "active" | "growing" | "stable";
  accentPosition?: "left" | "right";
  companyKey: CompanyFilter;
}

export const CompanyCard = ({
  name,
  description,
  memberCount,
  projectCount,
  revenue,
  status,
  accentPosition = "left",
  companyKey,
}: CompanyCardProps) => {
  const { setActiveCompany, activeCompany } = useCompanyFilter();
  const isSelected = activeCompany === companyKey;

  const statusMap = {
    active: { label: "Active", dot: "bg-emerald-500" },
    growing: { label: "Growing", dot: "bg-red-500" },
    stable: { label: "Stable", dot: "bg-amber-500" },
  };

  const s = statusMap[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
      onClick={() => setActiveCompany(isSelected ? "all" : companyKey)}
      className="relative group h-full cursor-pointer"
    >
      {/* Red accent edge */}
      <div
        className={`absolute top-3 bottom-3 w-[2px] bg-gradient-to-b from-red-500 via-red-600 to-transparent ${
          accentPosition === "left" ? "left-0" : "right-0"
        } ${isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-70"} transition-opacity`}
      />

      <div
        className={`h-full bg-[#0a0a0a] border rounded-sm p-6 transition-all duration-300 overflow-hidden ${
          isSelected
            ? "border-red-500/20"
            : "border-white/[0.04] hover:border-white/[0.08]"
        }`}
      >
        <div className="relative space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-sm bg-white/[0.03] border border-white/[0.04]">
                <Building2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg tracking-tight">{name}</h3>
                <p className="text-[13px] text-white/25 mt-0.5">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${s.dot} animate-pulse`} />
              <span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">
                {s.label}
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-white/15" />
                <span className="text-[11px] text-white/20 uppercase tracking-wider">Team</span>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{memberCount}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3 text-white/15" />
                <span className="text-[11px] text-white/20 uppercase tracking-wider">Projects</span>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{projectCount}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-white/15" />
                <span className="text-[11px] text-white/20 uppercase tracking-wider">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{revenue}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {[...Array(Math.min(memberCount, 4))].map((_, i) => (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
                  >
                    <span className="text-[9px] text-white/30 font-medium">
                      {String.fromCharCode(65 + i)}
                    </span>
                  </div>
                ))}
                {memberCount > 4 && (
                  <div className="h-6 w-6 rounded-full bg-white/[0.03] border border-white/[0.04] flex items-center justify-center">
                    <span className="text-[9px] text-white/20">+{memberCount - 4}</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-white/15">members</span>
            </div>
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-1 text-[11px] text-white/15 hover:text-red-400 transition-colors"
            >
              {isSelected ? "Selected" : "Select"}
              <ArrowUpRight className="h-3 w-3" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
