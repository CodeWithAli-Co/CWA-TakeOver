"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Search,
  MessageSquare,
  Settings,
  Menu,
  Plus,
  FileImage,
  Smile,
  Send,
  MoreVertical,
  ChevronLeft,
  Pin,
  Archive,
  Inbox,
} from "lucide-react"
import { ChatInputBox } from "@/MyComponents/chatInput"
import { ActiveUser, DMGroups, DMs, Employees } from "@/stores/query"
import { useAppStore } from "@/stores/store"
import { createLazyFileRoute } from "@tanstack/react-router"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup"
import { formatDistanceToNow, isValid } from "date-fns"
import { cn } from "@/lib/utils"

const formatMessageDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    if (!isValid(date)) return "Invalid date"
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (error) {
    return "Date unavailable"
  }
}

function DMChannels() {
  const { DMGroupName, setDMGroupName } = useAppStore()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [currentView, setCurrentView] = useState<"inbox" | "pinned" | "archived">("inbox")
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const [activeSection, setActiveSection] = useState('dm');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const { data: AllEmployees, error: AllEmpError, isLoading: loadingEmployees } = Employees();
  const { data: user, error: userError, isLoading: loadingUser } = ActiveUser();
  const { data: DmGroups, error: groupsError, isLoading: loadingGroups } = DMGroups(user![0].username);
  const { data: DM } = DMs(DMGroupName);

  if (loadingEmployees || loadingUser || loadingGroups) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (userError || AllEmpError || groupsError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1f22]">
        <div className="text-red-400">
          Error: {userError?.message || AllEmpError?.message || groupsError?.message}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden text-white"
        onClick={() => setShowMobileMenu(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Left Sidebar - Chat List */}
      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent side="left" className="w-80 p-0 bg-black/95 backdrop-blur-xl border-r border-white/10">
          <ChatSidebar
            user={user![0]}
            groups={DmGroups || []}
            currentDM={DMGroupName}
            onSelectDM={setDMGroupName}
            currentView={currentView}
            setCurrentView={setCurrentView}
            employees={AllEmployees || []}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-80 border-r border-white/10 bg-black/95 backdrop-blur-xl">
        <ChatSidebar
          user={user![0]}
          groups={DmGroups || []}
          currentDM={DMGroupName}
          onSelectDM={setDMGroupName}
          currentView={currentView}
          setCurrentView={setCurrentView}
          employees={AllEmployees || []}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {DMGroupName ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              {/* Chat Header */}
              <div className="h-16 flex items-center justify-between px-6 bg-black/50 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-white"
                    onClick={() => setDMGroupName("")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8 ring-2 ring-red-500/50">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${DMGroupName}`} />
                    <AvatarFallback>{DMGroupName?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-white font-semibold">{DMGroupName}</h2>
                    <p className="text-xs text-zinc-400">Active now</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    onClick={() => setIsSearchOpen(true)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                    <Pin className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 px-6">
                <motion.div
                  className="py-6 space-y-6"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.1,
                      },
                    },
                  }}
                >
                  {DM?.map((dm) => (
                    <motion.div
                      key={dm.msg_id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="group"
                    >
                      <Card className="bg-white/5 border-0 hover:bg-white/10 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-4">
                            <Avatar className="h-10 w-10 ring-2 ring-red-500/20">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.sent_by}`} />
                              <AvatarFallback>{dm.sent_by?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-red-400 font-medium">{dm.sent_by}</span>
                                <span className="text-zinc-500 text-sm">{formatMessageDate(dm.created_at)}</span>
                              </div>
                              <p className="text-white mt-1">{dm.message}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-4 bg-black/50 backdrop-blur-xl border-t border-white/10">
                <div className="max-w-4xl mx-auto">
                  <div className="relative flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <Plus className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 relative">
                      <ChatInputBox
                        activeUser={user![0].username as string}
                        table="cwa_dm_chat"
                        DmGroup={DMGroupName}
                        className="w-full bg-white/5 border-0 focus:ring-1 focus:ring-red-500 text-white placeholder:text-zinc-500 rounded-full py-6"
                        placeholder={`Message ${DMGroupName}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                          <FileImage className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                          <Smile className="h-5 w-5" />
                        </Button>
                        <Button size="icon" className="bg-red-500 hover:bg-red-600 text-white rounded-full">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center p-4"
            >
              <div className="text-center space-y-6 max-w-md mx-auto">
                <motion.div
                  className="w-24 h-24 bg-gradient-messages shadow-lg rounded-3xl mx-auto flex items-center justify-center"
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                >
                  <MessageSquare className="h-12 w-12 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white  ">Welcome to Messages</h3>
                <p className="text-zinc-400 max-w-sm mx-auto">
                  Choose a conversation from the sidebar or start a new one to begin messaging
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-red-800 to-red-900 text-amber-50  hover:opacity-90">
                      Start New Conversation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black/95 backdrop-blur-xl border border-white/10">
                    <DialogTitle>New Conversation</DialogTitle>
                    <AddDMGroup Users={AllEmployees || []} />
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Dialog */}
        <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <CommandInput placeholder="Search messages..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              {DmGroups?.map((group) => (
                <CommandItem
                  key={group.id}
                  onSelect={() => {
                    setDMGroupName(group.name)
                    setIsSearchOpen(false)
                  }}
                >
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`} />
                    <AvatarFallback>{group.name?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {group.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </div>
  )
}

function ChatSidebar({
  user,
  groups,
  currentDM,
  onSelectDM,
  currentView,
  setCurrentView,
  employees,
}: {
  user: any
  groups: any[]
  currentDM: string
  onSelectDM: (name: string) => void
  currentView: "inbox" | "pinned" | "archived"
  setCurrentView: (view: "inbox" | "pinned" | "archived") => void
  employees: any[]
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-900 bg-clip-text text-transparent">
            Messages
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="rounded-full bg-gradient-to-r from-red-500 to-red-900 text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/95 backdrop-blur-xl border border-white/10">
              <DialogTitle>New Conversation</DialogTitle>
              <AddDMGroup Users={employees || []} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search conversations"
            className="w-full bg-white/5 border-0 pl-9 text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      <Tabs defaultValue="inbox" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start px-2 h-12 bg-transparent border-b border-white/10">
          <TabsTrigger
            value="inbox"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            onClick={() => setCurrentView("inbox")}
          >
            <Inbox className="h-4 w-4 mr-2" />
            Inbox
          </TabsTrigger>
          <TabsTrigger
            value="pinned"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            onClick={() => setCurrentView("pinned")}
          >
            <Pin className="h-4 w-4 mr-2" />
            Pinned
          </TabsTrigger>
          <TabsTrigger
            value="archived"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            onClick={() => setCurrentView("archived")}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archived
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-2">
          <motion.div
            className="py-4 space-y-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
          >
            {groups?.map((group) => (
              <motion.div
                key={group.id}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => onSelectDM(group.name)}
                  className={cn(
                    "w-full justify-start px-3 py-6 space-x-3 group relative",
                    currentDM === group.name
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/5",
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 ring-2 ring-red-500/20">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`} />
                      <AvatarFallback>{group.name?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-black" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{group.name}</span>
                      <span className="text-xs text-zinc-500">12m</span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">Latest message preview...</p>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ scale: currentDM === group.name ? 1 : 0 }}
                    className="absolute left-0 w-1 h-full bg-red-500 rounded-r"
                  />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </ScrollArea>
      </Tabs>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 ring-2 ring-red-500/20">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} />
            <AvatarFallback>{user?.username?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{user?.username}</p>
            <Badge variant="outline" className="mt-1 text-xs text-zinc-400 bg-white/5">
              Admin
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export const Route = createLazyFileRoute("/chats/dm")({
  component: DMChannels,
})

export default DMChannels

