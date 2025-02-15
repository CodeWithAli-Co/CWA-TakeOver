import React from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Settings2,
  Users,
  CreditCard,
  GaugeCircle
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";

const SettingsPage = () => {
  const form = useForm({
    defaultValues: {
      workspaceName: "CodeWithAli Co.",
      emailNotifications: true,
      darkMode: false,
    }
  });

  const settingsTabs = [
    {
      value: "general",
      label: "General",
      icon: Settings2
    },
    {
      value: "team",
      label: "Team",
      icon: Users
    },
    {
      value: "billing",
      label: "Billing",
      icon: CreditCard
    },
    {
      value: "limits",
      label: "Limits",
      icon: GaugeCircle
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

interface FormValues {
    workspaceName: string;
    emailNotifications: boolean;
    darkMode: boolean;
}

const onSubmit = (data: FormValues) => {
    console.log(data);
    // Handle form submission
};

  return (
    <motion.div
      className="h-full w-full p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="flex flex-col space-y-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
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

          <TabsContent value="general">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure your general account preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="workspaceName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Workspace Name</FormLabel>
                            <FormControl>
                              <Input placeholder="CodeWithAli Co." {...field} />
                            </FormControl>
                            <FormDescription>
                              This is your workspace's visible name.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <FormField
                        control={form.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex justify-between items-center">
                            <div>
                              <FormLabel>Email Notifications</FormLabel>
                              <FormDescription>
                                Receive email notifications about account activity.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="darkMode"
                        render={({ field }) => (
                          <FormItem className="flex justify-between items-center">
                            <div>
                              <FormLabel>Dark Mode</FormLabel>
                              <FormDescription>
                                Toggle between light and dark mode.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default SettingsPage;