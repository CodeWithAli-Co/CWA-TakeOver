/**
 * s-broadcast.lazy.tsx — Simplicity Broadcast Center
 * Send notifications and announcements to Simplicity users.
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Send,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Users,
  Trophy,
  Zap as ZapIcon,
} from "lucide-react";
import { useSimplicityUsers } from "@/MyComponents/Simplicity/api/simplicityQueries";

// ── Type preview styling ──
const typePreviewStyles: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: <Info className="h-4 w-4 text-blue-400" />,
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: <AlertCircle className="h-4 w-4 text-amber-400" />,
  },
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  },
  announcement: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    icon: <Trophy className="h-4 w-4 text-primary" />,
  },
  update: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    icon: <ZapIcon className="h-4 w-4 text-purple-400" />,
  },
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "normal":
      return "text-primary";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
};

// ── Main Broadcast Page ──────────────────────────────────────────────
function SimplicityBroadcastPage() {
  const { data: users = [] } = useSimplicityUsers();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success" | "announcement" | "update">("info");
  const [target, setTarget] = useState<"all" | "free" | "paid">("all");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate targets
  const totalRecipients =
    target === "all"
      ? users.length
      : target === "free"
        ? users.filter((u) => !u.plan || u.plan === "Ripple" || u.plan === "free").length
        : users.filter((u) => u.plan === "Tide" || u.plan === "premium").length;

  const charCount = message.length;
  const maxChars = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("Please fill in title and message");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement broadcast submission to Simplicity API
      console.log({
        title,
        message,
        type,
        target,
        priority,
        recipients: totalRecipients,
      });
      alert("Broadcast sent successfully!");
      setTitle("");
      setMessage("");
    } catch (error) {
      console.error("Error sending broadcast:", error);
      alert("Failed to send broadcast");
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeStyle = typePreviewStyles[type];

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Broadcast Center
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Send notifications and announcements to users
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="bg-card border border-border rounded-sm p-4">
              <label className="block text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Broadcast title..."
                maxLength={100}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {title.length}/100 characters
              </p>
            </div>

            {/* Message */}
            <div className="bg-card border border-border rounded-sm p-4">
              <label className="block text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here..."
                maxLength={maxChars}
                rows={8}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors resize-none"
              />
              <p className={`text-[10px] mt-1.5 ${
                charCount > maxChars * 0.8 ? "text-amber-400" : "text-muted-foreground"
              }`}>
                {charCount}/{maxChars} characters
              </p>
            </div>

            {/* Type */}
            <div className="bg-card border border-border rounded-sm p-4">
              <label className="block text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-3">
                Notification Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["info", "warning", "success", "announcement", "update"] as const).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                        type === t
                          ? "bg-primary text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Target & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-sm p-4">
                <label className="block text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-3">
                  Target Audience
                </label>
                <div className="space-y-2">
                  {["all", "free", "paid"].map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                      <input
                        type="radio"
                        name="target"
                        value={t}
                        checked={target === t}
                        onChange={(e) => setTarget(e.target.value as "all" | "free" | "paid")}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs text-muted-foreground">
                        {t === "all"
                          ? "All Users"
                          : t === "free"
                            ? "Free Plan Users"
                            : "Paid Plan Users"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-sm p-4">
                <label className="block text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-3">
                  Priority
                </label>
                <div className="space-y-2">
                  {(["low", "normal", "high", "critical"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={priority === p}
                        onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high" | "critical")}
                        className="h-3.5 w-3.5"
                      />
                      <span className={`text-xs font-medium ${getPriorityColor(p)}`}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !message.trim()}
              className="w-full py-3 px-4 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Broadcast
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview & Stats */}
        <div className="space-y-4">
          {/* Live Preview */}
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-3">
              Live Preview
            </h3>
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${typeStyle.bg} border ${typeStyle.border} rounded-sm p-4`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">{typeStyle.icon}</div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground truncate">
                    {title || "Broadcast Title"}
                  </h4>
                  <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-3">
                    {message || "Your message will appear here..."}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats */}
          <div className="bg-card border border-border rounded-sm p-4 space-y-3">
            <h3 className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">
              Broadcast Stats
            </h3>

            <div className="bg-muted/30 rounded-sm p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Target Recipients
              </span>
              <div className="flex items-center gap-2 mt-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-lg font-bold text-foreground">
                  {totalRecipients}
                </p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-sm p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Sent Today
              </span>
              <p className="text-lg font-bold text-muted-foreground mt-2">
                0
              </p>
            </div>

            <div className="text-[11px] text-muted-foreground/70 bg-muted/20 rounded-sm p-2 border-l-2 border-primary/30">
              <p>
                This broadcast will be sent to{" "}
                <span className="font-semibold text-foreground">{totalRecipients}</span>{" "}
                {target === "all" ? "users" : target === "free" ? "free plan users" : "paid plan users"}.
              </p>
            </div>
          </div>

          {/* Sent Today Card */}
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium mb-3">
              Broadcast History
            </h3>
            <div className="text-center py-6">
              <Zap className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No broadcasts sent yet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/s-broadcast")({
  component: SimplicityBroadcastPage,
});
