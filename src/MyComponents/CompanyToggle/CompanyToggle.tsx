import { motion } from "framer-motion";
import { Code2, Droplets } from "lucide-react";
import { useCompanyFilter, type CompanyFilter } from "@/stores/store";
import { useSidebar } from "@/components/ui/shadcnComponents/sidebar";

const companies: {
  key: CompanyFilter;
  label: string;
  shortLabel: string;
  icon: typeof Code2;
}[] = [
  { key: "codeWithAli", label: "CodeWithAli", shortLabel: "CWA", icon: Code2 },
  {
    key: "simplicityFunds",
    label: "Simplicity",
    shortLabel: "SMP",
    icon: Droplets,
  },
];

export function CompanyToggle() {
  const { activeCompany, setActiveCompany } = useCompanyFilter();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="px-1">
      <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 p-0.5">
        {companies.map((company) => {
          const isActive = activeCompany === company.key;
          const Icon = company.icon;

          return (
            <button
              key={company.key}
              onClick={() => setActiveCompany(company.key)}
              className={`relative flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="company-toggle-bg"
                  className="absolute inset-0 rounded-sm bg-primary"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate">{company.label}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CompanyToggle;
