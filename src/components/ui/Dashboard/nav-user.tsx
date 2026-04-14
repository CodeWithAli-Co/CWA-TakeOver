import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/shadcnComponents/sidebar";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { useRolePreview } from "@/stores/store";

interface NavUserProps {
  userData: {
    name: string;
    email: string;
    avatar: string;
  };
}

export function NavUser({ }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { data: activeuser } = ActiveUser();
  const { previewRole } = useRolePreview();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Error Signing Out:", error.message);
    } else {
      localStorage.removeItem("isLoggedIn");
      window.location.reload();
    }
  };

  const user = activeuser[0] || {
    username: "Unknown",
    email: "unknown@example.com",
    avatar: "/public/codewithali_logo.png",
    role: "Member",
    avatarURL: "",
  };

  const displayRole = previewRole || user.role;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-muted/50 data-[state=open]:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
            >
              <Avatar className="h-7 w-7 rounded-sm border border-border">
                <AvatarImage
                  src={user.avatarURL}
                  alt={user.username}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-sm bg-muted/50 text-muted-foreground/70 text-[10px]">
                  {user.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-foreground/80 text-[13px]">{user.username}</span>
                <span className="truncate text-[11px] text-muted-foreground/50">
                  {displayRole}
                  {previewRole && (
                    <span className="ml-1 text-primary/60">(preview)</span>
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/40" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 bg-card border border-border rounded-sm"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-sm border border-border">
                  <AvatarImage src={user.avatarURL} alt={user.username} className="object-cover" />
                  <AvatarFallback className="rounded-sm bg-muted/50 text-muted-foreground/70 text-[10px]">
                    {user.username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-foreground/80 text-[13px]">{user.username}</span>
                  <span className="truncate text-[11px] text-muted-foreground/50">{displayRole}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                <Sparkles className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                Profile Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                <BadgeCheck className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                My Tasks
              </DropdownMenuItem>
              <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                <CreditCard className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                Manage Teams
              </DropdownMenuItem>
              <DropdownMenuItem className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 cursor-pointer rounded-sm text-[12px]">
                <Bell className="h-3.5 w-3.5 mr-2 text-muted-foreground/60" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuItem onClick={handleLogout} className="text-primary/60 hover:text-primary hover:bg-primary/[0.06] cursor-pointer rounded-sm text-[12px]">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
