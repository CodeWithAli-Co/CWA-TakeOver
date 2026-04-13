import { Eye, EyeOff, X } from "lucide-react";
import { useRolePreview } from "@/stores/store";
import { Role } from "@/MyComponents/Reusables/userView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { useSidebar } from "@/components/ui/shadcnComponents/sidebar";

const previewableRoles = [
  { key: Role.Intern, label: "Intern" },
  { key: Role.Member, label: "Member" },
  { key: Role.Marketing, label: "Marketing" },
  { key: Role.Admin, label: "Admin" },
  { key: Role.ProjectManager, label: "Project Manager" },
  { key: Role.SecurityEngineer, label: "Security Engineer" },
  { key: Role.COO, label: "COO" },
  { key: Role.CEO, label: "CEO" },
];

export function RolePreviewSelector() {
  const { previewRole, setPreviewRole } = useRolePreview();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // When previewing, show a persistent banner
  if (previewRole) {
    return (
      <div className="mx-2 mb-1">
        <div className="flex items-center gap-2 px-2.5 py-2 bg-red-500/[0.08] border border-red-500/20 rounded-sm">
          <Eye className="h-3 w-3 text-red-400 shrink-0" />
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-red-400/60 uppercase tracking-wider leading-none">
                  Viewing as
                </p>
                <p className="text-[12px] text-red-400 font-medium truncate">
                  {previewRole}
                </p>
              </div>
              <button
                onClick={() => setPreviewRole(null)}
                className="p-1 rounded-sm hover:bg-red-500/10 text-red-400/50 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isCollapsed ? "mx-auto" : "mx-2"} mb-1`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-2 ${
              isCollapsed ? "p-2" : "px-2.5 py-2 w-full"
            } bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.07] rounded-sm transition-all duration-200 group`}
          >
            <Eye className="h-3.5 w-3.5 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
            {!isCollapsed && (
              <span className="text-[11px] text-white/20 group-hover:text-white/40 transition-colors">
                Preview Role
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          className="bg-[#0a0a0a] border border-white/[0.06] rounded-sm w-48"
        >
          <DropdownMenuLabel className="text-[10px] text-white/20 uppercase tracking-wider font-medium px-2 py-1.5">
            View dashboard as...
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/[0.04]" />
          {previewableRoles.map((role) => (
            <DropdownMenuItem
              key={role.key}
              onClick={() => setPreviewRole(role.key)}
              className="text-[12px] text-white/50 hover:text-white hover:bg-white/[0.04] cursor-pointer rounded-sm mx-1"
            >
              <Eye className="h-3 w-3 mr-2 text-white/15" />
              {role.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
