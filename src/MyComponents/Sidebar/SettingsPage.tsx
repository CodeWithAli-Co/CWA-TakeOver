import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle,
  ClipboardList,
  Users2,
  Bell,
  Shield,
  Save,
  Undo2,
  Moon,
  Building2,
  LineChart,
  Database,
  Plug,
  CreditCard,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/shadcnComponents/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/shadcnComponents/form";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Switch } from "@/components/ui/shadcnComponents/switch";
import { Separator } from "@/components/ui/shadcnComponents/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ActiveUser } from "@/stores/query";
import { DeveloperResourceHub } from "@/MyComponents/HomeDashboard/ResourceHub";
import { IntegrationsSettings } from "@/MyComponents/SettingNavComponents/integrations";
import { NotificationSetting } from "@/MyComponents/SettingNavComponents/notification";
import { CompanySettings } from "@/MyComponents/SettingNavComponents/company";
import { createLazyFileRoute } from "@tanstack/react-router";
import UploadAvatar from "../Reusables/uploadAvatar";
import ReportSettings from "../SettingNavComponents/reports";
import TeamsAndProjects from "../SettingNavComponents/TeamProject";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  emailNotifications: z.boolean(),
  darkMode: z.boolean(),
});

const settingsTabs = [
  { value: "profile", label: "Profile Settings", icon: UserCircle },
];

export const Route = createLazyFileRoute("/settings")({
  component: SettingsPage,
});

export default function SettingsPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = React.useState(
    searchParams.get("tab") ?? "profile"
  );
  const navigate = Route.useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);
  const { data: user } = ActiveUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Handle screen width for responsive design
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;
  const is4K = windowWidth >= 2560;

  // Update URL when tab changes
  const handleTabChange = (value) => {
    setActiveTab(value);
    navigate({
      to: "/settings",
      // search: { tab: value } // Uncomment to add tab to URL
    });

    // Close mobile menu after selection on mobile
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user ? user[0].username : "",
      emailNotifications: true,
      darkMode: true,
    },
  });

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(data);
    setIsSaving(false);
  };

  const handleReset = () => {
    form.reset();
  };

  return (
    // Main container - no padding or position adjustments to respect app layout
    <div className="min-h-screen bg-black/95 flex">
      {/* Content container - full width with overflow control */}
      <div className="w-full max-w-[1400px] overflow-x-auto">
        <div className="w-full px-4 py-4">
          {/* Header with title and action buttons */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Settings
              </h2>
              <p className="text-red-200/60 text-sm md:text-base">
                Manage your account settings and preferences.
              </p>
            </div>
          </div>

          {/* Tabs container */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4 md:space-y-6"
          >
            {/* Mobile dropdown for tabs */}
            {isMobile && (
              <div className="w-full mb-4">
                <DropdownMenu
                  open={isMobileMenuOpen}
                  onOpenChange={setIsMobileMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-black/40 text-red-200/60 border border-red-950/20"
                    >
                      <div className="flex items-center">
                        {(() => {
                          const activeTabInfo = settingsTabs.find(
                            (tab) => tab.value === activeTab
                          );
                          if (activeTabInfo?.icon) {
                            const IconComponent = activeTabInfo.icon;
                            return <IconComponent className="mr-2 h-4 w-4" />;
                          }
                          return null;
                        })()}
                        <span>
                          {settingsTabs.find((tab) => tab.value === activeTab)
                            ?.label || "Settings"}
                        </span>
                      </div>
                      <Menu className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[94vw] max-w-md bg-black/90 border-red-950/30 text-red-200">
                    {settingsTabs.map((tab) => (
                      <DropdownMenuItem
                        key={tab.value}
                        onClick={() => handleTabChange(tab.value)}
                        className="flex items-center py-2 px-3 hover:bg-red-950/20 cursor-pointer"
                      >
                        <tab.icon className="mr-2 h-4 w-4" />
                        <span>{tab.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Tablet & desktop horizontal tabs with scroll capability */}
            {!isMobile && (
              <div className="overflow-x-auto">
                <TabsList className="h-12 w-full justify-start space-x-2 bg-black/40 p-1 text-red-200/60 border border-red-950/20 flex-nowrap">
                  {settingsTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                              hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2 whitespace-nowrap"
                    >
                      <tab.icon className="h-4 w-4" />
                      <span className={isTablet ? "hidden lg:inline" : ""}>
                        {tab.label}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Profile Settings Tab */}
                <TabsContent value="profile" className="space-y-4">
                  <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-xl md:text-2xl text-white">
                        Profile Settings
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm text-red-200/60">
                        Manage your profile information and preferences.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2">
                          <Form {...form}>
                            <form
                              onSubmit={form.handleSubmit(onSubmit)}
                              className="space-y-6"
                            >
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-red-200">
                                      <UserCircle className="h-4 w-4 inline mr-2" />
                                      Name
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        className="bg-black/40 border-red-950/30 text-white 
                                                focus:border-red-500 focus:ring-red-500/20"
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs sm:text-sm text-red-200/60">
                                      This is your public display name.
                                    </FormDescription>
                                    <FormMessage className="text-red-500" />
                                  </FormItem>
                                )}
                              />
                            </form>
                          </Form>
                        </div>

                        <div className="xl:col-span-1 flex flex-col items-center justify-start">
                          <UploadAvatar
                            className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                       text-white border border-red-800/30 shadow-lg shadow-red-950/20 p-2"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
