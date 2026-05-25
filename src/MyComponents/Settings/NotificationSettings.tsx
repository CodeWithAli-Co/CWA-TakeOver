/**
 * NotificationSettings.tsx — User-facing notification + autostart controls.
 *
 * Wires the autostart plugin (enable/disable system boot launch) and
 * stores notification preferences in localStorage.
 *
 * IMPORTANT — Background notification design:
 *   - When the X (close) button is clicked, the window hides instead of
 *     quitting (handled in src-tauri/src/lib.rs via WindowEvent).
 *   - The app continues running, the Supabase realtime channel stays
 *     subscribed, and OS notifications continue firing for new messages.
 *   - The tray icon provides "Open" and "Quit" menu options.
 *   - With autostart enabled, the app launches on system boot and goes
 *     straight to the tray, so notifications work even after a reboot.
 *
 * For TRUE app-fully-terminated push notifications, you'd need a separate
 * push service (FCM/APNS) — out of scope for this implementation.
 */

import { useEffect, useState } from "react";
import {
  Bell, Power, Volume2, VolumeX, Info, CheckCircle2,
  MessageSquare, MessagesSquare, Beaker, AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted, requestPermission, sendNotification,
} from "@tauri-apps/plugin-notification";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  className?: string;
}

const SETTINGS_KEY = "cwa-notification-prefs";

interface NotificationPrefs {
  enableNotifications: boolean;
  enableSound: boolean;
  enableAutostart: boolean;
}

const defaultPrefs: NotificationPrefs = {
  enableNotifications: true,
  enableSound: true,
  enableAutostart: false,
};

export const NotificationSettings: React.FC<Props> = ({ className = "" }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<null | "ok" | "denied" | "error">(null);
  const [testMessage, setTestMessage] = useState<string>("");
  const { threadStyle, setThreadStyle } = useChatStore();

  const sendTestNotification = async () => {
    setTestStatus(null);
    setTestMessage("");
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (!granted) {
        setTestStatus("denied");
        setTestMessage(
          "OS permission for notifications is denied. Open Windows Settings → System → Notifications and enable them for CWA Takeover.",
        );
        return;
      }
      await sendNotification({
        title: "Takeover notification test",
        body: "You'll receive real message pings the same way — from any page, even when the window is hidden to tray.",
      });
      setTestStatus("ok");
      setTestMessage("Test notification sent. If you didn't see it, check Focus Assist or notification history.");
    } catch (err) {
      setTestStatus("error");
      setTestMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // Load on mount
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
      } catch {}
    }

    // Sync autostart status from Tauri plugin
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const enabled = await isEnabled();
        setPrefs((p) => ({ ...p, enableAutostart: enabled }));
      } catch (err) {
        console.warn("Autostart plugin not available:", err);
      }
    })();
  }, []);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const toggleAutostart = async () => {
    setAutostartLoading(true);
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (prefs.enableAutostart) {
        await disable();
        update({ enableAutostart: false });
      } else {
        await enable();
        update({ enableAutostart: true });
      }
    } catch (err) {
      console.error("Autostart toggle error:", err);
    }
    setAutostartLoading(false);
  };

  const handleQuitFully = async () => {
    try {
      await invoke("quit_app");
    } catch (err) {
      console.error("Quit error:", err);
    }
  };

  const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? "bg-red-500" : "bg-muted/60"
      } ${disabled ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  return (
    <div className={`bg-card border border-border rounded-sm overflow-hidden ${className}`} data-notif-settings>
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-sm bg-primary/[0.08]">
            <Bell className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-[13px] font-semibold text-foreground/85">Notifications</h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Notifications enabled */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-foreground/70 font-medium">Enable Notifications</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Show OS notifications for new messages
            </p>
          </div>
          <Toggle checked={prefs.enableNotifications} onChange={() => update({ enableNotifications: !prefs.enableNotifications })} />
        </div>

        {/* Sound */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-foreground/70 font-medium flex items-center gap-1.5">
              {prefs.enableSound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              Notification Sound
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Play a sound when notifications appear
            </p>
          </div>
          <Toggle checked={prefs.enableSound} onChange={() => update({ enableSound: !prefs.enableSound })} />
        </div>

        {/* Autostart */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-foreground/70 font-medium flex items-center gap-1.5">
              <Power className="h-3 w-3" />
              Launch on Startup
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Start app in background when system boots
            </p>
          </div>
          <Toggle checked={prefs.enableAutostart} onChange={toggleAutostart} disabled={autostartLoading} />
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-muted/30 border border-border rounded-sm">
          <Info className="h-3.5 w-3.5 text-primary/70 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-muted-foreground/80 leading-snug">
              <strong className="text-foreground/70">Background mode:</strong>{" "}
              When you close the window with the X, the app hides to the system tray
              instead of quitting. Notifications continue to work. Right-click the tray
              icon to fully quit.
            </p>
          </div>
        </div>

        {/* Diagnostic status */}
        <NotificationDiagnostic />

        {/* Test notification */}
        <div className="pt-3 border-t border-border">
          <button
            onClick={sendTestNotification}
            className="flex w-full items-center justify-center gap-2 py-2 bg-muted/40 hover:bg-primary/[0.08] border border-border hover:border-primary/25 text-primary-foreground/75 hover:text-primary text-[11.5px] font-medium rounded-sm transition-colors"
          >
            <Beaker className="h-3.5 w-3.5" />
            Send Test Notification
          </button>
          {testStatus && (
            <div
              className={`mt-2 flex items-start gap-2 rounded-sm border p-2.5 text-[11px] leading-snug ${
                testStatus === "ok"
                  ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
                  : "border-destructive/25 bg-destructive/[0.08] text-destructive"
              }`}
            >
              {testStatus === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              )}
              <span>{testMessage}</span>
            </div>
          )}
        </div>

        {/* Chat thread style */}
        <div className="pt-3 border-t border-border">
          <p className="text-[12px] text-foreground/70 font-medium mb-1">Chat Thread Style</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            How replies-in-thread render in the chat page.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setThreadStyle("sidepanel")}
              className={`flex items-start gap-2 rounded-sm border px-2 py-2 text-left transition-colors ${
                threadStyle === "sidepanel"
                  ? "border-primary/40 bg-primary/[0.06] text-primary-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="block text-[11px] font-semibold">Side panel</span>
                <span className="block text-[10px] opacity-70">Slack-style</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setThreadStyle("inline")}
              className={`flex items-start gap-2 rounded-sm border px-2 py-2 text-left transition-colors ${
                threadStyle === "inline"
                  ? "border-primary/40 bg-primary/[0.06] text-primary-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessagesSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="block text-[11px] font-semibold">Inline</span>
                <span className="block text-[10px] opacity-70">Discord-style</span>
              </span>
            </button>
          </div>
        </div>

        {/* Quit fully button */}
        <button
          onClick={handleQuitFully}
          className="w-full py-2 bg-muted/30 hover:bg-primary/[0.06] border border-border hover:border-primary/15 text-muted-foreground/70 hover:text-primary text-[11px] font-medium rounded-sm transition-colors"
        >
          Quit App Fully
        </button>
      </div>
    </div>
  );
};

// ── Diagnostic panel ────────────────────────────────────────────────────

function NotificationDiagnostic() {
  const [perm, setPerm] = useState<string>("checking…");
  const [autostart, setAutostart] = useState<string>("checking…");
  const totalUnread = useChatStore((s) => s.totalUnread());

  useEffect(() => {
    (async () => {
      try {
        const granted = await isPermissionGranted();
        setPerm(granted ? "granted" : "denied");
      } catch {
        setPerm("unavailable");
      }
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const enabled = await isEnabled();
        setAutostart(enabled ? "enabled" : "disabled");
      } catch {
        setAutostart("unavailable");
      }
    })();
  }, []);

  const Row = ({
    label, value, tone,
  }: {
    label: string;
    value: string;
    tone: "ok" | "warn" | "neutral";
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono text-[11px] font-semibold ${
          tone === "ok"
            ? "text-emerald-400"
            : tone === "warn"
              ? "text-destructive"
              : "text-foreground/80"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="pt-3 border-t border-border">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-foreground/70">
        <Info className="h-3 w-3" />
        Status
      </p>
      <div className="space-y-1 rounded-sm border border-border bg-muted/20 p-2.5">
        <Row label="OS permission" value={perm} tone={
          perm === "granted" ? "ok"
            : perm === "denied" ? "warn"
              : "neutral"
        } />
        <Row label="Launch on boot" value={autostart} tone={
          autostart === "enabled" ? "ok" : "neutral"
        } />
        <Row label="Unread (all channels)" value={String(totalUnread)} tone="neutral" />
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">
        If OS permission shows "denied", open Windows Settings → System →
        Notifications → CWA TakeOver and turn it on. Notifications only
        fire for channels you're not actively viewing (mentions always fire).
      </p>
    </div>
  );
}
