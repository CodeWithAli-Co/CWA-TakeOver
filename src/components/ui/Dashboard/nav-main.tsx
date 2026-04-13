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
import { Link, useNavigate } from "@tanstack/react-router";

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
  const totalUnread = useChatStore((s) => Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0));
  return (
    <SidebarGroup>
      <SidebarMenu className="space-y-0.5">
        {items.map((item) =>
          item.items && item.items.length > 0 ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    onClick={() => navigate({ to: item.url })}
                    className="hover:bg-white/[0.04] text-white/50 hover:text-white/80 rounded-sm transition-colors data-[active=true]:bg-red-500/[0.08] data-[active=true]:text-red-400"
                  >
                    {item.icon && <item.icon className="h-4 w-4 text-white/20" />}
                    <span className="text-[13px]">{item.title}</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/15 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l border-white/[0.04] ml-4">
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild className="hover:bg-white/[0.03] text-white/35 hover:text-white/60 rounded-sm">
                          <Link to={subItem.url}>
                            <span className="text-[12px]">{subItem.title}</span>
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
                onClick={() => navigate({ to: item.url })}
                className="hover:bg-white/[0.04] text-white/50 hover:text-white/80 rounded-sm transition-colors data-[active=true]:bg-red-500/[0.08] data-[active=true]:text-red-400"
              >
                {item.icon && (
                  <span className="relative">
                    <item.icon className="h-4 w-4 text-white/20" />
                    {item.title === "Chat" && totalUnread > 0 && (
                      <span className="absolute -top-1 -right-1">
                        <UnreadBadge count={totalUnread} />
                      </span>
                    )}
                  </span>
                )}
                <span className="text-[13px]">{item.title}</span>
                {item.title === "Chat" && totalUnread > 0 && (
                  <span className="ml-auto">
                    <UnreadBadge count={totalUnread} />
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
