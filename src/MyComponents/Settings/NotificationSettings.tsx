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
import { Bell, Power, Volume2, VolumeX, Info } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

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
        checked ? "bg-red-500" : "bg-white/[0.06]"
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
    <div className={`bg-card border border-border rounded-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-sm bg-primary/[0.08]">
            <Bell className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-[13px] font-semibold text-white/85">Notifications</h3>
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
