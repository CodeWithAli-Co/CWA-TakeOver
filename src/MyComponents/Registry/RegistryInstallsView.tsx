/**
 * RegistryInstallsView — shows every recorded install of this item,
 * grouped by project. Per-project: who installed, which version,
 * when. Helps answer "where is this component used?".
 *
 * Data source: registry_installs table, populated by the CLI's
 * `cwa add` + the init wizard. If nothing's been installed via the
 * CLI yet, we show an empty-state with the install command to run.
 */

import { useMemo } from "react";
import { Download, Folder, User, Clock, Terminal } from "lucide-react";
import { useRegistryInstalls, type InstallRow } from "./queries";

interface Props {
  itemId: string;
  itemName: string;
  kind: "component" | "template";
  installCount: number;
}

export function RegistryInstallsView({ itemId, itemName, kind, installCount }: Props) {
  const { data: installs = [], isLoading } = useRegistryInstalls(itemId);

  // Group by project_name. Entries with no project_name bucket as "(unknown project)".
  const grouped = useMemo(() => {
    const m = new Map<string, InstallRow[]>();
    for (const row of installs) {
      const key = row.projectName ?? "(unknown project)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(row);
    }
    // Sort groups by most-recent install across the group.
    return Array.from(m.entries())
      .map(([project, rows]) => ({
        project,
        rows: rows.sort((a, b) => b.installedAt.localeCompare(a.installedAt)),
        mostRecent: rows[0]?.installedAt ?? "",
      }))
      .sort((a, b) => b.mostRecent.localeCompare(a.mostRecent));
  }, [installs]);

  const uniqueProjects = grouped.length;
  const uniqueUsers = useMemo(
    () => new Set(installs.map((r) => r.installedBy)).size,
    [installs],
  );

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[12px] text-muted-foreground">
        Loading install history…
      </div>
    );
  }

  if (installs.length === 0) {
    // `installCount` and actual rows can disagree only if someone
    // deleted rows manually — handle both cases.
    const emptyCopy = installCount === 0
      ? "No installs recorded yet."
      : `Install count shows ${installCount} but no log entries exist yet.`;
    const cmd = kind === "template" ? `cwa create ${itemName}` : `cwa add ${itemName}`;
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-5 text-center">
        <Terminal className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-[12px] text-muted-foreground">{emptyCopy}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Install via the CLI and it'll show up here:
        </p>
        <code className="mt-2 inline-block rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground">
          {cmd}
        </code>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary header */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px]">
        <Stat icon={Download} label="total installs" value={String(installs.length)} />
        <Stat icon={Folder}   label="projects"       value={String(uniqueProjects)} />
        <Stat icon={User}     label="devs"           value={String(uniqueUsers)} />
      </div>

      {/* Per-project groups */}
      {grouped.map((g) => (
        <div key={g.project} className="rounded-lg border border-border/60 bg-muted/10">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Folder className="h-3 w-3 shrink-0 text-amber-400/70" />
              <span className="truncate text-[12px] font-semibold text-foreground">
                {g.project}
              </span>
            </div>
            <span className="shrink-0 text-[10.5px] text-muted-foreground">
              {g.rows.length} install{g.rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {g.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground/85">{row.installedBy}</span>
                  {row.machineId && (
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      · {row.machineId.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className="font-mono text-cyan-300/80">v{row.version}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelative(row.installedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: {
  icon: typeof Download;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
      <span className="text-[14px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60)     return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)     return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)     return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)     return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)    return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
