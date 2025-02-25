import React from "react"
import { motion, AnimatePresence } from "framer-motion"
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
  CreditCard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ActiveUser } from "@/stores/query"
import { DeveloperResourceHub } from "@/MyComponents/HomeDashboard/ResourceHub";
import { IntegrationsSettings } from "@/MyComponents/SettingNavComponents/integrations";
import { NotificationSetting } from "@/MyComponents/SettingNavComponents/notification";
import { CompanySettings } from "@/MyComponents/SettingNavComponents/company";

import UploadAvatar from "./uploadAvatar"
// import { useLocation } from 'react-router-dom';
// Replace the URL parameter handling code with:
import { createLazyFileRoute } from '@tanstack/react-router'

const formSchema = z.object({
  name: z.string().min(2).max(50),
  emailNotifications: z.boolean(),
  darkMode: z.boolean(),
})

const settingsTabs = [


  { value: "profile", label: "Profile Settings", icon: UserCircle },
  { value: "teams", label: "Teams & Projects", icon: Users2 },
  { value: "company", label: "Company", icon: Building2 },
  { value: "reports", label: "Reports", icon: LineChart },
  { value: "resources", label: "Resources", icon: Database },
  { value: "integrations", label: "Integrations", icon: Plug },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "security", label: "Security & Access Logs", icon: Shield },
];

export const Route = createLazyFileRoute('/settings')({
  component: SettingsPage
})

export default function SettingsPage() {

    // tab reading from sidebar

 // Replace the URL handling code block with:
 const searchParams = new URLSearchParams(window.location.search)
 const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') ?? 'profile')
 const navigate = Route.useNavigate()
 
 // Use URL tab or default to "profile"
//  const [activeTab, setActiveTab] = React.useState(tabFromUrl || "profile");

 // Update URL when tab changes
 const handleTabChange = (value: string) => {
  setActiveTab(value)
  navigate({ 
    to: '/settings',
    // search: {  } // Need to work on this
  })
}
  // 

  // const [activeTab, setActiveTab] = React.useState("profile")
  const [isSaving, setIsSaving] = React.useState(false)
  const { data: user } = ActiveUser()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user![0].username,
      emailNotifications: true,
      darkMode: true,
    },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log(data)
    setIsSaving(false)
  }

  const handleReset = () => {
    form.reset()
  }

  return (
    <div className="min-h-screen bg-black/95 flex justify-center pl-[160px]">
      <div className="w-full px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Settings</h2>
            <p className="text-red-200/60">Manage your account settings and preferences.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleReset} 
              disabled={isSaving}
              className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={isSaving}
              className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                       text-white border border-red-800/30 shadow-lg shadow-red-950/20"
            >
              {isSaving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="mr-2 h-4 w-4"
                  >
                    <Save className="h-4 w-4" />
                  </motion.div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          <TabsList className="h-12 w-full justify-start space-x-2 bg-black/40 p-1 text-red-200/60 border border-red-950/20">
            {settingsTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                         hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="profile" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Profile Settings</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Manage your profile information and preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              <FormDescription className="text-red-200/60">
                                This is your public display name.
                              </FormDescription>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />

                        <Separator className="border-red-950/20" />

                        <FormField
                          control={form.control}
                          name="emailNotifications"
                          render={({ field }) => (
                            <FormItem className="flex justify-between items-center space-y-0">
                              <div>
                                <FormLabel className="text-red-200">
                                  <Bell className="h-4 w-4 inline mr-2" />
                                  Email Notifications
                                </FormLabel>
                                <FormDescription className="text-red-200/60">
                                  Receive email notifications about account activity.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-red-900"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="darkMode"
                          render={({ field }) => (
                            <FormItem className="flex justify-between items-center space-y-0">
                              <div>
                                <FormLabel className="text-red-200">
                                  <Moon className="h-4 w-4 inline mr-2" />
                                  Dark Mode
                                </FormLabel>
                                <FormDescription className="text-red-200/60">
                                  Toggle between light and dark mode.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-red-900"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </form>
                    </Form>
                    
                    {/* You can also wrap it with anything */}
                    {/* ADD STYLING HERE! NOT INSIDE THE COMPONENT */}
                    <UploadAvatar className="text-white" />
                    
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="teams" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Teams & Projects</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Manage your team members and project assignments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add team management content */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="company" className="space-y-4 ">
              
                  <CardContent>
                    {/* Add company settings content */}
                    <CompanySettings />
                  </CardContent>
           
              </TabsContent>

              <TabsContent value="reports" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Reports</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Generate and view analytical reports.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add reports content */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="resources" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Resources</CardTitle>
                    <CardDescription className="text-red-200/60">
                    < DeveloperResourceHub />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add resources content */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="integrations" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Integrations</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Configure and manage third-party integrations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add integrations content */}
                    <IntegrationsSettings />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="billing" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Billing & Subscription</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Manage billing information and subscription details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add billing content */}

                    {/*  <Card className="bg-black/40 border-red-900/30 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-amber-50">Billing Overview</CardTitle>
              <CardDescription className="text-amber-50/70">
                Current plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-amber-50/70">Current Plan</h3>
                    <Badge variant="outline" className="bg-red-900/20 text-amber-50">
                      Enterprise
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">$499/mo</p>
                </div>
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-amber-50/70">Next Payment</h3>
                    <Clock className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">15 Days</p>
                </div>
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-amber-50/70">Team Size</h3>
                    <Users className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">30 Users</p>
                </div>
              </div>
            </CardContent>
          </Card> */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Notification Settings</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Customize your notification preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add notification settings content */}
                    <NotificationSetting />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Security & Access Logs</CardTitle>
                    <CardDescription className="text-red-200/60">
                      Manage security settings and view access history.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Add security settings content */}
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  )
}