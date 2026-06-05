import { ChevronRight, type LucideIcon } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { UnreadBadge } from "@/MyComponents/Chat/UnreadBadge";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/shadcnComponents/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/shadcnComponents/sidebar";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const totalUnread = useChatStore((s) => Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0));

  // Active when the current route matches the item exactly, or is a
  // child of it (e.g. /workspace/docs/123 lights up "Workspace").
  // Guard against "/" matching everything.
  const isPathActive = (url: string) => {
    if (!url || url === "#") return false;
    if (url === "/") return pathname === "/";
    return pathname === url || pathname.startsWith(url + "/");
  };

  // Shared active treatment — rounded-sm tinted pill, coral text +
  // icon. No left accent bar (it fought the rounded corners).
  const ACTIVE_CLS =
    "data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-semibold " +
    "data-[active=true]:rounded-sm data-[active=true]:[&_svg]:text-primary";

  // Centering in collapsed mode: shadcn's SidebarMenuButton flexes
  // left-aligned by default. When the rail collapses to 32px wide,
  // text/badges still take up flex space (just clipped by overflow)
  // which drifts the icon off-center to the left. Force
  // justify-center while collapsed and hide the text/badge spans.
  const COLLAPSED_CENTER =
    "group-data-[collapsible=icon]:justify-center " +
    "group-data-[collapsible=icon]:px-0";

  return (
    <SidebarGroup>
      <SidebarMenu className="space-y-0.5">
        {items.map((item) => {
          const childActive = item.items?.some((s) => isPathActive(s.url)) ?? false;
          const selfActive = isPathActive(item.url);
          const groupActive = selfActive || childActive;
          return item.items && item.items.length > 0 ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive || groupActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={groupActive}
                    onClick={() => navigate({ to: !item.isActive ? "#" : item.url })}
                    className={`hover:bg-muted/60 text-foreground/90 hover:text-foreground rounded-sm transition-colors ${ACTIVE_CLS} ${COLLAPSED_CENTER}`}
                  >
                    {item.icon && (
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l border-border ml-4">
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isPathActive(subItem.url)}
                          className="hover:bg-muted/60 text-foreground/80 hover:text-foreground rounded-sm data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-semibold"
                        >
                          <Link to={subItem.url}>
                            <span className="text-[12px] font-medium">{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={selfActive}
                onClick={() => navigate({ to: item.url })}
                className={`hover:bg-muted/60 text-foreground/90 hover:text-foreground rounded-sm transition-colors ${ACTIVE_CLS} ${COLLAPSED_CENTER}`}
              >
                {item.icon && (
                  <span className="relative shrink-0">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.title === "Chat" && totalUnread > 0 && (
                      <span className="absolute -top-1 -right-1">
                        <UnreadBadge count={totalUnread} />
                      </span>
                    )}
                  </span>
                )}
                <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">
                  {item.title}
                </span>
                {item.title === "Chat" && totalUnread > 0 && (
                  <span className="ml-auto group-data-[collapsible=icon]:hidden">
                    <UnreadBadge count={totalUnread} />
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
