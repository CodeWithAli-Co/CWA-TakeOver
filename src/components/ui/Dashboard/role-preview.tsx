import { Eye, X } from "lucide-react";
import { useRolePreview } from "@/stores/store";
import { Role } from "@/MyComponents/Reusables/userView";
import { ActiveUser } from "@/stores/query";
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

  // Always check the REAL role — never the preview role.
  // This ensures the preview controls are always visible to CEO/COO
  // even when previewing a lower role.
  const { data: activeUser } = ActiveUser();
  const realRole = activeUser?.[0]?.role || "Member";

  // Only CEO and COO can use role preview
  if (realRole !== "CEO" && realRole !== "COO") {
    return null;
  }

  // When previewing, show a persistent banner with exit button
  if (previewRole) {
    return (
      <div className="mx-2 mb-1">
        <div className="flex items-center gap-2 px-2.5 py-2 bg-primary/[0.08] border border-primary/20 rounded-sm">
          <Eye className="h-3 w-3 text-primary shrink-0" />
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary/60 uppercase tracking-wider leading-none">
                  Viewing as
                </p>
                <p className="text-[12px] text-primary font-medium truncate">
                  {previewRole}
                </p>
              </div>
              <button
                onClick={() => setPreviewRole(null)}
                className="p-1 rounded-sm hover:bg-red-500/10 text-primary/50 hover:text-primary transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {isCollapsed && (
            <button
              onClick={() => setPreviewRole(null)}
              className="p-0.5 rounded-sm hover:bg-red-500/10 text-primary/50 hover:text-primary transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
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
            } bg-muted/30 hover:bg-muted/50 border border-border hover:border-white/[0.07] rounded-sm transition-all duration-200 group`}
          >
            <Eye className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
            {!isCollapsed && (
              <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground/70 transition-colors">
                Preview Role
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          className="bg-card border border-border rounded-sm w-48"
        >
          <DropdownMenuLabel className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium px-2 py-1.5">
            View dashboard as...
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-muted/50" />
          {previewableRoles.map((role) => (
            <DropdownMenuItem
              key={role.key}
              onClick={() => setPreviewRole(role.key)}
              className="text-[12px] text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm mx-1"
            >
              <Eye className="h-3 w-3 mr-2 text-muted-foreground/40" />
              {role.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
