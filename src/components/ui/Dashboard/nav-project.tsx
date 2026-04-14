import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/shadcnComponents/sidebar";
import { Link } from "@tanstack/react-router";

export function NavProjects({
  projects,
}: {
  projects: {
    name: string;
    url: string;
    icon: LucideIcon;
  }[];
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">
        Projects
      </SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild className="hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground/80 rounded-sm">
              <Link to={item.url} draggable={false}>
                <item.icon className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-[13px]">{item.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover className="text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/50 rounded-sm">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 bg-card border border-border rounded-sm"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                  <Folder className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                  <Forward className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-muted/50" />
                <DropdownMenuItem className="text-primary/60 hover:text-primary hover:bg-primary/[0.06] cursor-pointer rounded-sm text-[12px]">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
