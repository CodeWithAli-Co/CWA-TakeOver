/**
 * BugReportDialog.tsx — Modal for filing an in-app bug report.
 *
 * Trigger: "Report a bug" item in the user dropdown (nav-user.tsx).
 *
 * On submit:
 *   1. (Optional) Upload screenshot to `bug-screenshots` bucket.
 *   2. Snapshot diagnostics (console + network) via captureBuffer.
 *   3. Insert row into `bug_reports` with reporter + page URL +
 *      browser info + logs.
 *   4. Show success state with the report ID for tracking.
 *
 * Visual language follows CreateChannelDialog — same border, same
 * mono-uppercase labels, same primary button. Stays in-theme.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bug, Loader2, X, Image as ImageIcon, Check, AlertTriangle,
} from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";
import { ActiveUser, getActiveCompanyLabel } from "@/stores/query";
import {
  snapshotDiagnostics,
  browserInfo,
} from "@/diagnostics/captureBuffer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Severity = "low" | "medium" | "high" | "critical";
type Area = "chat" | "huddle" | "onboarding" | "hiring" | "reports" | "tasks" | "axon" | "other";

const SEVERITIES: { value: Severity; label: string; tone: string }[] = [
  { value: "low",      label: "Low — minor annoyance",         tone: "border-border text-foreground/80" },
  { value: "medium",   label: "Medium — workable, but wrong",  tone: "border-amber-500/50 text-amber-300" },
  { value: "high",     label: "High — blocks a real workflow", tone: "border-orange-500/60 text-orange-300" },
  { value: "critical", label: "Critical — data loss / crash",  tone: "border-red-500/60 text-red-300" },
];

const AREAS: { value: Area; label: string }[] = [
  { value: "chat",       label: "Chat / messaging" },
  { value: "huddle",     label: "Huddle / call" },
  { value: "hiring",     label: "Hiring / candidates" },
  { value: "onboarding", label: "Onboarding" },
  { value: "tasks",      label: "Tasks" },
  { value: "reports",    label: "Reports / dashboards" },
  { value: "axon",       label: "Axon" },
  { value: "other",      label: "Other" },
];

export function BugReportDialog({ open, onOpenChange }: Props) {
  const { data: me } = ActiveUser();
  const meRow = me?.[0];
  const username = (meRow as any)?.username || "anonymous";
  const role = (meRow as any)?.role || "";
  const email = (meRow as any)?.email || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reproSteps, setReproSteps] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [area, setArea] = useState<Area>("other");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset on close. We DON'T reset on open so the user can re-open
  // with the form they were filling in (in case the dialog closes
  // mid-typing — Esc, click-outside, etc).
  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccessId(null);
    } else {
      // Focus the title field once visible.
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setReproSteps("");
    setSeverity("medium");
    setArea("other");
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const handleScreenshot = (file: File | null) => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    if (!file) {
      setScreenshot(null);
      setScreenshotPreview(null);
      return;
    }
    if (!/^image\//.test(file.type)) {
      setError("Screenshot must be an image (png, jpg, webp, gif).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Screenshot too large (max 10 MB).");
      return;
    }
    setError(null);
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      // 1. Upload screenshot first (if any). Best-effort — if it
      //    fails we still file the report without the image.
      let screenshotUrl: string | null = null;
      if (screenshot) {
        const safeName = screenshot.name.replace(/[^a-z0-9._-]/gi, "_");
        const path = `${username}/${Date.now()}-${safeName}`;
        const up = await companySupabase.storage
          .from("bug-screenshots")
          .upload(path, screenshot, {
            cacheControl: "3600",
            upsert: false,
            contentType: screenshot.type,
          });
        if (up.error) {
          console.warn("[bug-report] screenshot upload failed:", up.error.message);
        } else {
          const { data } = companySupabase.storage
            .from("bug-screenshots")
            .getPublicUrl(path);
          screenshotUrl = data?.publicUrl ?? null;
        }
      }

      // 2. Snapshot diagnostics right at submit time so the buffer
      //    reflects "what happened up until they clicked send".
      const diag = snapshotDiagnostics();
      const info = browserInfo();
      const pageUrl =
        typeof window !== "undefined" ? window.location.href : null;

      // 3. Insert the report.
      const { data, error: insertErr } = await companySupabase
  .from("bug_reports")
        .insert({
          reporter_username: username,
          reporter_role: role || null,
          reporter_email: email || null,
          title: title.trim(),
          description: description.trim(),
          repro_steps: reproSteps.trim() || null,
          severity,
          area,
          page_url: pageUrl,
          browser_info: info,
          console_logs: diag.console,
          network_logs: diag.network,
          screenshot_url: screenshotUrl,
          company: getActiveCompanyLabel(),
        })
        .select("id")
        .single();

      if (insertErr) {
        setError(insertErr.message);
        return;
      }
      setSuccessId(data?.id ?? "submitted");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground max-h-[calc(100vh-12vh)]"
            style={{ boxShadow: "0 28px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Report a bug"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Report a bug</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            {successId ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                <h4 className="text-[14px] font-semibold text-foreground">
                  Report submitted
                </h4>
                <p className="max-w-[360px] text-[12px] text-muted-foreground">
                  Thanks — your report is in the inbox.
                  Engineering will triage it shortly. You can track it from{" "}
                  <span className="font-mono">/reports</span> → Bug Reports.
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/70">
                  Report ID: {successId.slice(0, 8)}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSuccessId(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    File another
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 overflow-y-auto p-4">
                {/* Title */}
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    Title
                  </span>
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="One-line summary of what broke"
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                    maxLength={120}
                  />
                </label>

                {/* Description */}
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    What happened
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What you expected vs what actually happened."
                    rows={4}
                    className="resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                    maxLength={2000}
                  />
                </label>

                {/* Repro steps (optional) */}
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    Steps to reproduce (optional)
                  </span>
                  <textarea
                    value={reproSteps}
                    onChange={(e) => setReproSteps(e.target.value)}
                    placeholder="1. Open chat 2. Click huddle 3. ..."
                    rows={3}
                    className="resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                    maxLength={1000}
                  />
                </label>

                {/* Severity + Area side-by-side */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                      Severity
                    </span>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground focus:border-foreground/30 focus:outline-none"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                      Area
                    </span>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value as Area)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground focus:border-foreground/30 focus:outline-none"
                    >
                      {AREAS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Screenshot drop / file picker */}
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    Screenshot (optional)
                  </span>
                  {screenshotPreview ? (
                    <div className="relative rounded-md border border-border overflow-hidden">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="max-h-44 w-full object-contain bg-black/40"
                      />
                      <button
                        type="button"
                        onClick={() => handleScreenshot(null)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-4 text-[12px] text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>Add a screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleScreenshot(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </label>

                {/* Auto-capture note */}
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[10.5px] text-muted-foreground leading-relaxed">
                  We&apos;ll attach the page URL, your browser info, the last
                  ~50 console messages, and recent network activity so
                  triage doesn&apos;t have to guess. No passwords or auth
                  tokens are captured.
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !title.trim() || !description.trim()}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bug className="h-3 w-3" />}
                    Submit report
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
