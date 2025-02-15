"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserCircle, ClipboardList, Users2, Bell, Shield, Save, Undo2, Moon } from "lucide-react"
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

const formSchema = z.object({
  name: z.string().min(2).max(50),
  emailNotifications: z.boolean(),
  darkMode: z.boolean(),
})

const settingsTabs = [
  {
    value: "profile",
    label: "Profile Settings",
    icon: UserCircle,
  },
  {
    value: "tasks",
    label: "My Tasks",
    icon: ClipboardList,
  },
  {
    value: "teams",
    label: "Manage Teams",
    icon: Users2,
  },
  {
    value: "notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    value: "security",
    label: "Security & Access Logs",
    icon: Shield,
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("profile")
  const [isSaving, setIsSaving] = React.useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "Ali",
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
    <div className="min-h-screen bg-background flex justify-center pl-[160px]">
      <div className="w-full px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">Manage your account settings and preferences.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              <Undo2 className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="h-12 w-full justify-start space-x-2 bg-muted p-1 text-muted-foreground">
            {settingsTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background flex items-center space-x-2 px-3 py-2"
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
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Manage your profile information and preferences.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <UserCircle className="h-4 w-4 inline mr-2" />
                                Name
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormDescription>This is your public display name.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator />

                        <FormField
                          control={form.control}
                          name="emailNotifications"
                          render={({ field }) => (
                            <FormItem className="flex justify-between items-center space-y-0">
                              <div>
                                <FormLabel>
                                  <Bell className="h-4 w-4 inline mr-2" />
                                  Email Notifications
                                </FormLabel>
                                <FormDescription>Receive email notifications about account activity.</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                                <FormLabel>
                                  <Moon className="h-4 w-4 inline mr-2" />
                                  Dark Mode
                                </FormLabel>
                                <FormDescription>Toggle between light and dark mode.</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Add other tab contents with similar structure */}
              <TabsContent value="tasks">
                <Card>
                  <CardHeader>
                    <CardTitle>My Tasks</CardTitle>
                    <CardDescription>View and manage your tasks.</CardDescription>
                  </CardHeader>
                  <CardContent>{/* Add task management content */}</CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="teams">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Management</CardTitle>
                    <CardDescription>Manage your team members and roles.</CardDescription>
                  </CardHeader>
                  <CardContent>{/* Add team management content */}</CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Customize your notification settings.</CardDescription>
                  </CardHeader>
                  <CardContent>{/* Add notification settings content */}</CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage your security preferences and view access logs.</CardDescription>
                  </CardHeader>
                  <CardContent>{/* Add security settings content */}</CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  )
}

