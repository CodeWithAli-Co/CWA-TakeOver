import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Settings,
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
import { useNavigate } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";

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
  const navigate = useNavigate();

  // Helper — pushes to a route. Keeping it defined here so the
  // onClick handlers below are terse + consistent. All use Tanstack
  // Router's useNavigate so back/forward + active state behave.
  const goTo = (to: string) => {
    navigate({ to }).catch(() => { /* noop — stale route, ignore */ });
  };

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
              className="data-[state=open]:bg-muted/60 data-[state=open]:text-foreground hover:bg-muted/60 rounded-sm transition-colors"
            >
              <Avatar className="h-7 w-7 rounded-sm border border-border">
                <AvatarImage
                  src={user.avatarURL}
                  alt={user.username}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-sm bg-muted text-foreground/80 text-[10px] font-semibold">
                  {user.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-foreground text-[13px]">{user.username}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {displayRole}
                  {previewRole && (
                    <span className="ml-1 text-primary font-semibold">(preview)</span>
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/70" />
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
                  <AvatarFallback className="rounded-sm bg-muted text-foreground/80 text-[10px] font-semibold">
                    {user.username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-foreground text-[13px]">{user.username}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{displayRole}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => goTo("/settings")}
                className="text-foreground/90 hover:text-foreground hover:bg-muted/60 focus:bg-muted/60 cursor-pointer rounded-sm text-[12px] font-medium"
              >
                <Settings className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => goTo("/task")}
                className="text-foreground/90 hover:text-foreground hover:bg-muted/60 focus:bg-muted/60 cursor-pointer rounded-sm text-[12px] font-medium"
              >
                <BadgeCheck className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                My Tasks
              </DropdownMenuItem>
              <UserView userRole={[Role.CEO, Role.COO]}>
                <DropdownMenuItem
                onClick={() => goTo("/employee")}
                className="text-foreground/90 hover:text-foreground hover:bg-muted/60 focus:bg-muted/60 cursor-pointer rounded-sm text-[12px] font-medium"
              >
                <CreditCard className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Manage Teams
              </DropdownMenuItem>
              </UserView>
              <DropdownMenuItem
                onClick={() => goTo("/settings")}
                className="text-foreground/90 hover:text-foreground hover:bg-muted/60 focus:bg-muted/60 cursor-pointer rounded-sm text-[12px] font-medium"
              >
                <Bell className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 focus:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer rounded-sm text-[12px] font-medium"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
