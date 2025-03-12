import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  UserCircle,
  Github,
  GitCommit,
  Briefcase,
  CalendarIcon,
  Globe,
  Linkedin,
  Network,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";
import GitHubWebhookComponent from "../Webhooks/GithubHook";
// In ModLogsPage component, import the GitHubWebhookComponent


// Mock data to match the Discord webhook format - replace with your API call
const mockCommitData = [
  {
    id: "github_1",
    type: "GitHub",
    appBadge: true,
    timestamp: "Yesterday at 7:27 AM",
    commits: [
      {
        author: "blazehp",
        authorAvatar: "/avatars/blazehp.png",
        repo: "Budgetary:blaze",
        commitCount: 1,
        commitId: "8a45495",
        message: "Added Neon DB to Project",
      }
    ]
  },
  // ... other mock data items
];

// Mock data for other service types
const mockLinkedInData = [
  {
    id: "linkedin_1",
    type: "LinkedIn",
    appBadge: true,
    timestamp: "Today at 10:15 AM",
    activity: {
      type: "Connection",
      user: "John Developer",
      details: "New connection request"
    }
  }
];

const mockCalendlyData = [
  {
    id: "calendly_1",
    type: "Calendly",
    appBadge: true,
    timestamp: "Today at 9:30 AM",
    event: {
      type: "Meeting Scheduled",
      with: "Jane Client",
      time: "Tomorrow at 2:00 PM",
      duration: "30 minutes"
    }
  }
];

interface CommitDetailProps {
  commitId: string;
  message: string;
  author?: string;
}

const CommitDetail: React.FC<CommitDetailProps> = ({ commitId, message, author }) => {
  return (
    <div className="flex items-start space-x-2 py-1 text-sm">
      <div className="flex-shrink-0 w-16 font-mono text-red-300">{commitId.substring(0, 7)}</div>
      <div className="flex-grow">
        <span className="text-white">{message}</span>
        {author && author !== "blazehp" && (
          <span className="text-red-400 ml-2">- {author}</span>
        )}
      </div>
    </div>
  );
};

interface CommitGroupProps {
  data: typeof mockCommitData[0];
}

const CommitGroup: React.FC<CommitGroupProps> = ({ data }) => {
  return (
    <Card className="mb-4 bg-black/60 border-red-950/30 overflow-hidden backdrop-blur-sm">
      <CardHeader className="p-4 flex flex-row items-center space-x-2">
        <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
          <Github className="h-full w-full p-2 text-white" />
        </div>
        <div className="flex-grow">
          <CardTitle className="text-lg flex items-center">
            {data.type}
            {data.appBadge && (
              <Badge className="ml-2 bg-blue-600 hover:bg-blue-700 text-xs">APP</Badge>
            )}
            <span className="text-xs text-red-300 ml-auto">{data.timestamp}</span>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {data.commits.map((commit, i) => (
          <div key={i} className="border-t border-red-950/30 p-4">
            <div className="flex items-center mb-2">
              <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 mr-2">
                {commit.authorAvatar ? (
                  <img src={commit.authorAvatar} alt={commit.author} className="h-full w-full object-cover" />
                ) : (
                  <UserCircle className="h-full w-full p-1 text-gray-400" />
                )}
              </div>
              <div className="font-medium text-white">{commit.author}</div>
            </div>
            
            <div className="pl-10">
              <div className="text-blue-400 hover:underline mb-2">
                [{commit.repo}] {commit.commitCount} new {commit.commitCount === 1 ? 'commit' : 'commits'}
              </div>
              
              {/* Single commit */}
              {commit.commitId && (
                <CommitDetail commitId={commit.commitId} message={commit.message} />
              )}
              
              {/* Multiple commits */}
              {commit.commitDetails && commit.commitDetails.map((detail: any, idx: any) => (
                <CommitDetail 
                  key={idx} 
                  commitId={detail.commitId} 
                  message={detail.message}
                  author={detail.author}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// LinkedIn Activity Component
const LinkedInActivity = ({ data }: {data: any}) => {
  return (
    <Card className="mb-4 bg-black/60 border-red-950/30 overflow-hidden backdrop-blur-sm">
      <CardHeader className="p-4 flex flex-row items-center space-x-2">
        <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
          <Linkedin className="h-full w-full p-2 text-white" />
        </div>
        <div className="flex-grow">
          <CardTitle className="text-lg flex items-center">
            {data.type}
            {data.appBadge && (
              <Badge className="ml-2 bg-blue-600 hover:bg-blue-700 text-xs">APP</Badge>
            )}
            <span className="text-xs text-red-300 ml-auto">{data.timestamp}</span>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="text-white">
          <div className="font-medium">{data.activity.type}</div>
          <div className="text-gray-300 mt-1">{data.activity.user}</div>
          <div className="text-gray-400 mt-2">{data.activity.details}</div>
        </div>
      </CardContent>
    </Card>
  );
};

// Calendly Event Component
const CalendlyEvent = ({ data }: {data: any}) => {
  return (
    <Card className="mb-4 bg-black/60 border-red-950/30 overflow-hidden backdrop-blur-sm">
      <CardHeader className="p-4 flex flex-row items-center space-x-2">
        <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
          <CalendarIcon className="h-full w-full p-2 text-white" />
        </div>
        <div className="flex-grow">
          <CardTitle className="text-lg flex items-center">
            {data.type}
            {data.appBadge && (
              <Badge className="ml-2 bg-blue-600 hover:bg-blue-700 text-xs">APP</Badge>
            )}
            <span className="text-xs text-red-300 ml-auto">{data.timestamp}</span>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="text-white">
          <div className="font-medium">{data.event.type}</div>
          <div className="text-gray-300 mt-1">With: {data.event.with}</div>
          <div className="text-gray-400 mt-2">
            <div>{data.event.time}</div>
            <div>{data.event.duration}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function ModLogsPage() {
  const [activeTab, setActiveTab] = useState("github");

  return (
    <div className="min-h-screen bg-black/95">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-red-950/40 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <GitCommit className="h-6 w-6 mr-2 text-red-500" />
              <h1 className="text-xl font-bold text-white">Mod Logs</h1>
              <Badge className="ml-3 bg-red-900/60 border border-red-800 text-red-100">Admin Only</Badge>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Service Selector Tabs */}
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="mb-6"
          >
            <TabsList className="h-12 bg-black/40 p-1 text-red-200/60 border border-red-950/20 flex-nowrap overflow-x-auto">
              <TabsTrigger 
                value="github" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </TabsTrigger>
              <TabsTrigger 
                value="linkedin" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Linkedin className="h-4 w-4" />
                <span>LinkedIn</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendly" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Calendly</span>
              </TabsTrigger>
              <TabsTrigger 
                value="upwork" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Briefcase className="h-4 w-4" />
                <span>Upwork</span>
              </TabsTrigger>
              <TabsTrigger 
                value="indeed" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Network className="h-4 w-4" />
                <span>Indeed</span>
              </TabsTrigger>
              <TabsTrigger 
                value="hostinger" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                <span>Hostinger</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <TabsContent value="github" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <Github className="h-6 w-6 mr-2 text-red-300" />
                  <h2 className="text-xl font-semibold text-white">GitHub Activity</h2>
                </div>
                <Button 
                  className="bg-red-900 hover:bg-red-800 text-sm"
                  size="sm"
                >
                  Refresh
                </Button>
              </div>
              <GitHubWebhookComponent />
            </TabsContent>

            <TabsContent value="linkedin" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <Linkedin className="h-6 w-6 mr-2 text-red-300" />
                  <h2 className="text-xl font-semibold text-white">LinkedIn Activity</h2>
                </div>
                <Button 
                  className="bg-red-900 hover:bg-red-800 text-sm"
                  size="sm"
                >
                  Refresh
                </Button>
              </div>
              {mockLinkedInData.length > 0 ? (
                mockLinkedInData.map((item) => (
                  <LinkedInActivity key={item.id} data={item} />
                ))
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No LinkedIn activity available
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendly" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <CalendarIcon className="h-6 w-6 mr-2 text-red-300" />
                  <h2 className="text-xl font-semibold text-white">Calendly Events</h2>
                </div>
                <Button 
                  className="bg-red-900 hover:bg-red-800 text-sm"
                  size="sm"
                >
                  Refresh
                </Button>
              </div>
              {mockCalendlyData.length > 0 ? (
                mockCalendlyData.map((item) => (
                  <CalendlyEvent key={item.id} data={item} />
                ))
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No Calendly events available
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="upwork" className="mt-4">
              <div className="text-gray-400 text-center py-8">
                No Upwork activity available
              </div>
            </TabsContent>
            
            <TabsContent value="indeed" className="mt-4">
              <div className="text-gray-400 text-center py-8">
                No Indeed activity available
              </div>
            </TabsContent>
            
            <TabsContent value="hostinger" className="mt-4">
              <div className="text-gray-400 text-center py-8">
                No Hostinger activity available
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

export default ModLogsPage;