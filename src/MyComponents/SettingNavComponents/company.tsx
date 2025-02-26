import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/shadcnComponents/card";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Switch } from "@/components/ui/shadcnComponents/switch";
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion } from "framer-motion";

import {
  Building2,
  Users,
  CreditCard,
  FileText,
  Globe,
  Shield,
  Settings2,
  Upload,
  Clock,
  Briefcase,
  FileImage,
  Linkedin,
  X,
  Facebook,
  Instagram,
  Mail,
} from "lucide-react";

const EMPLOYEE_COUNT = "11-50";
const SOCIAL_MEDIA = [
  {
    platform: "LinkedIn",
    url: "https://www.linkedin.com/company/codewithali-co",
    icon: Linkedin,
    color: "text-[#0A66C2]", // LinkedIn brand color
  },
  {
    platform: "X",
    url: "https://twitter.com/codewithali",
    icon: () => (
      <img src="/public/logo-white.png" alt="Twitter X" className="h-4 w-4" />
    ),
    color: "text-[#1DA1F2]", // Twitter brand color
  },
  {
    platform: "Facebook",
    url: "https://facebook.com/codewithali",
    icon: Facebook,
    color: "text-[#1877F2]", // Facebook brand color
  },
  {
    platform: "Instagram",
    url: "https://instagram.com/codewithali",
    icon: Instagram,
    color: "text-[#E4405F]", // Instagram brand color
  },
];
export const CompanySettings = () => {
  return (
    <div className="min-h-screen bg-black p-6">
      <div className="space-y-6 max-w-8xl mx-auto ">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-amber-50">
              Company Settings
            </h2>
            <p className="text-sm text-amber-50/70">
              Manage your company profile and preferences
            </p>
          </div>
          <Button className="bg-red-900 hover:bg-red-800 text-amber-50">
            Save Changes
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Profile */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-amber-50">Company Profile</CardTitle>
              <CardDescription className="text-amber-50/70">
                Company information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-lg bg-red-900/20 border-2 border-dashed border-red-900/30 flex items-center justify-center">
                  <img
                    src="/public/codewithali_logo_full.png"
                    alt="Company Logo"
                    className="h-22 w-22 text-red-500/70"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-amber-50/70">
                    Company Name
                  </label>
                  <div className="bg-black/40 border-red-900/30 text-amber-50 p-2 rounded-md select-none hover:border-red-900">
                    CodeWithAli Co.
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-amber-50/70">Website</label>
                  <Input
                    className="bg-black/40 border-red-900/30 text-white hover:border-red-900  disabled:opacity-100"
                    //   placeholder="https://"
                    defaultValue="https://codewithali.com"
                    disabled
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-amber-50/70">
                    Description
                  </label>
                  <Textarea
                    className="bg-black/40 border-red-900/30  min-h-[100px] hover:border-red-900 cursor-not-allowed disabled:white  disabled:opacity-100"
                    placeholder="Brief company description"
                    defaultValue="We are to ensure everyone has a good time and we dedicte firstly to helping people reach the spotlight and showcase their hobbies"
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-amber-50 ">Business Hours</CardTitle>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-400"
                >
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
                  (day) => (
                    <div
                      key={day}
                      className="flex items-center justify-between py-2 border-b border-gray-800"
                    >
                      <span className="text-sm font-medium text-gray-300">
                        {day}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <span className="bg-black/40 px-3 py-1 rounded-l border border-gray-700 text-gray-200 hover:border-green-800">
                            9:00
                          </span>
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 text-sm font-medium rounded-r border-y border-r border-gray-700 hover:border-amber-50/70">
                            AM
                          </span>
                        </div>
                        <span className="text-gray-500">to</span>
                        <div className="flex items-center">
                          <span className="bg-black/40 px-3 py-1 rounded-l border border-gray-700 text-gray-200 hover:border-red-900 ">
                            20:00
                          </span>
                          <span className="bg-red-500/20 text-red-400 px-2 py-1 text-sm font-medium rounded-r border-y border-r border-gray-700 hover:border-amber-50/70">
                            PM
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Management */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-2 ">
            <CardHeader>
              <CardTitle className="text-amber-50">Team Management</CardTitle>
              <CardDescription className="text-amber-50/70">
                Configure team roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-4">
                  {[
                    {
                      role: "Administrator",
                      members: 3,
                      access: "Full access",
                    },
                    { role: "Manager", members: 5, access: "Limited access" },
                    {
                      role: "Developer",
                      members: 12,
                      access: "Development tools",
                    },
                    { role: "Designer", members: 4, access: "Design tools" },
                    { role: "Analyst", members: 6, access: "Analytics access" },
                  ].map((role, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30 hover:border-red-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-900/20">
                          <Users className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-amber-50">
                            {role.role}
                          </h3>
                          <p className="text-xs text-amber-50/70">
                            {role.access}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-red-900/20 text-amber-50"
                      >
                        {role.members} members
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Compliance Settings */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-amber-50">Compliance</CardTitle>
              <CardDescription className="text-amber-50/70">
                Security and compliance settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "2FA Requirement",
                    description: "Require two-factor authentication",
                  },
                  {
                    title: "Data Encryption",
                    description: "Enable end-to-end encryption",
                  },
                  {
                    title: "Audit Logging",
                    description: "Track all system activities",
                  },
                  {
                    title: "IP Restrictions",
                    description: "Restrict access by IP",
                  },
                ].map((setting, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-50">{setting.title}</p>
                      <p className="text-xs text-amber-50/70">
                        {setting.description}
                      </p>
                    </div>
                    <Switch className="bg-red-900/20 data-[state=checked]:bg-red-900" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Basic Company Information */}
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-amber-50/70">
                  Industry Type
                </label>
                <select className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg p-2">
                  <option value="software" className="bg-black">
                    Software Development
                  </option>
                  <option value="ecommerce" className="bg-black">
                    E-Commerce
                  </option>
                  <option value="biotech" className="bg-black">
                    Bio-Tech
                  </option>
                  <option value="ai" className="bg-black">
                    Artificial Intelligence
                  </option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-amber-50/70">Year Founded</label>
                <Input
                  className="bg-black/40 border-red-900/30 text-amber-50"
                  value="2024"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-amber-50/70">
                Company Tagline
              </label>
              <Textarea
                className="bg-black/40 border-red-900/30 text-amber-50  hover:border-red-900"
                placeholder="Beyond existence, we forge excellence."
                defaultValue="Where innovation meets ambition - We don't just exist, we excel."
                disabled
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-amber-50/70">
                Mission Statement
              </label>
              <Textarea
                className="bg-black/40 border-red-900/30 text-amber-50 min-h-[100px]  hover:border-red-900"
                defaultValue="To revolutionize software development through innovative solutions that empower businesses to thrive in the digital age, while maintaining the highest standards of quality and security."
              />
            </div>
          </div>

          {/* Company Status */}
          <Card className="bg-black/40 border-red-900/30 mt-6">
            <CardHeader>
              <CardTitle className="text-amber-50">Company Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm text-amber-50 mb-2">
                    Location Status
                  </h3>
                  <div className="p-3 rounded-lg bg-black/60 border border-red-900/30  hover:border-red-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-red-500" />
                      <span className="text-amber-50">Remote Operations</span>
                    </div>
                    <p className="text-xs text-amber-50/70 ">
                      Global team with flexible work arrangements
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm text-amber-50 mb-2 ">
                    Employee Count
                  </h3>

                  <div className="p-3 rounded-lg bg-black/60 border border-red-900/30   hover:border-red-900">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-red-500" />
                      <span className="text-amber-50">
                        {EMPLOYEE_COUNT} Employees
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm text-amber-50 mb-2 ">Hiring Status</h3>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/20 text-emerald-400  hover:border-red-900 hover:bg-red-900 hover:text-white"
                  >
                    Actively Hiring
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Compliance */}
          <Card className="bg-black/40 border-red-900/30 mt-6">
            <CardHeader>
              <CardTitle className="text-amber-50">
                Security & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-red-500" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-50">
                          Two-Factor Authentication
                        </h3>
                        <p className="text-xs text-amber-50/70">
                          Required for all team members
                        </p>
                      </div>
                    </div>
                    <Switch
                      className="bg-red-900/20 data-[state=checked]:bg-red-900"
                      defaultChecked
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-red-500" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-50">
                          Legal Documents
                        </h3>
                        <p className="text-xs text-amber-50/70">
                          Upload company policies & terms
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-900/30 text-amber-50"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social & Contact */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-amber-50">
                Social Media & Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {SOCIAL_MEDIA.map(({ platform, url, icon: Icon, color }) => (
                <div key={platform} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${color} transition-colors`} />
                    <label className="text-sm text-amber-50/70">
                      {platform}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={url}
                      disabled
                      className="bg-black/40 border-red-900/30 text-amber-50 hover:border-red-900"
                    />
                    <Button
                      variant="outline"
                      className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
                      onClick={() => window.open(url, "_blank")}
                    >
                      Visit
                    </Button>
                  </div>
                </div>
              ))}

              {/* Support Contact */}
              <div className="space-y-2 pt-4 border-t border-red-900/30">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-red-500" />
                  <label className="text-sm text-amber-50/70">
                    Support Contact
                  </label>
                </div>
                <Input
                  value="unfold@codewithali.com"
                  disabled
                  className="bg-black/40 border-red-900/30 text-amber-50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Newsletter & KPIs */}
          <Card className="bg-black/40 border-red-900/30 mt-6">
            <CardHeader>
              <CardTitle className="text-amber-50">
                Newsletter & Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Newsletter Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-amber-50 border-b border-red-900/30 pb-2">
                    Newsletter Settings
                  </h3>
                  <div className="grid gap-3">
                    {[
                      { type: "Company Updates", color: "emerald" },
                      { type: "Product Announcements", color: "blue" },
                      { type: "Industry News", color: "purple" },
                      { type: "Event Invitations", color: "amber" },
                    ].map((item) => (
                      <motion.div
                        key={item.type}
                        whileHover={{ scale: 1.01 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30"
                      >
                        <span className="text-sm text-amber-50">
                          {item.type}
                        </span>
                        <Switch
                          className={`bg-${item.color}-900/20 data-[state=checked]:bg-${item.color}-600`}
                          defaultChecked
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-amber-50 border-b border-red-900/30 pb-2">
                    Key Performance Metrics
                  </h3>
                  <div className="grid gap-3">
                    {[
                      {
                        metric: "User Growth",
                        value: "+25% YoY",
                        color: "emerald",
                      },
                      {
                        metric: "Customer Satisfaction",
                        value: "95%",
                        color: "blue",
                      },
                      {
                        metric: "Platform Uptime",
                        value: "99.9%",
                        color: "purple",
                      },
                      {
                        metric: "Response Time",
                        value: "< 2 hours",
                        color: "amber",
                      },
                    ].map((kpi) => (
                      <motion.div
                        key={kpi.metric}
                        whileHover={{ scale: 1.01 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full bg-${kpi.color}-500`}
                          />
                          <span className="text-sm text-amber-50">
                            {kpi.metric}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`bg-${kpi.color}-500/20 text-${kpi.color}-400`}
                        >
                          {kpi.value}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
