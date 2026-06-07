/**
 * WorkspacePage.tsx — Landing page for /workspace.
 *
 * Layout (left → right):
 *   · Folder sidebar — recursive shared folder tree. Drag any
 *     resource onto a folder to file it. Right-click a folder for
 *     rename / new subfolder / delete.
 *   · Main column — header, tab strip, breadcrumb, resource grid
 *     filtered to the currently-selected folder (or root).
 *   · Activity feed — unchanged, lives in the right rail.
 *
 * Folder filtering rule: the grid shows resources whose folder_id
 * matches the active folder, OR (when no folder is selected) any
 * resource at the root (folder_id IS NULL). The "All" tab still
 * filters by kind; the folder filter stacks on top.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  Sheet,
  Plus,
  Search,
  Lock,
  Globe,
  Loader2,
  Archive,
  FolderPlus,
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
  Home,
  Check,
  X,
} from "lucide-react";
import {
  useWorkspaceResources,
  useCreateDocument,
  useCreateSpreadsheet,
  useWorkspaceRealtime,
  useFolders,
  useFolderCounts,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  useMoveFolder,
  useMoveResourceToFolder,
  useRestoreDocument,
  useRestoreSpreadsheet,
  useHardDeleteDocument,
  useHardDeleteSpreadsheet,
  useDeleteDocument,
  useDeleteSpreadsheet,
} from "@/stores/workspace";
import { takeOversupabase } from "@/MyComponents/supabase";
import type {
  WorkspaceResource,
  WorkspaceFolder,
  WorkspaceFolderCounts,
} from "@/stores/workspaceTypes";
import { ActiveUser } from "@/stores/query";
import { extractDocText, matchesQuery } from "./searchHelpers";
import { useQuery } from "@tanstack/react-query";
import { PillTabs } from "@/components/ui/PillTabs";
import { DeleteResourceDialog } from "./DeleteResourceDialog";

type TabId = "all" | "documents" | "spreadsheets" | "archived";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO", "Admin"]);

export function WorkspacePage() {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";

  useWorkspaceRealtime();

  const role: string | undefined = (meRows?.[0] as any)?.role ?? undefined;
  const isCLevel = !!role && C_LEVEL_ROLES.has(role);
  // Fetch with includeArchived so the Archive tab has something to
  // render. Active tabs filter archived rows back out below.
  const { data: resources = [], isLoading } = useWorkspaceResources({
    includeArchived: true,
  });

  // Restore / hard-delete mutations for the Archive tab actions.
  const restoreDocMut = useRestoreDocument();
  const restoreSheetMut = useRestoreSpreadsheet();
  const hardDeleteDocMut = useHardDeleteDocument();
  const hardDeleteSheetMut = useHardDeleteSpreadsheet();
  const { data: folders = [] } = useFolders();
  const { data: folderCounts } = useFolderCounts();
  const createDoc = useCreateDocument();
  const createSheet = useCreateSpreadsheet();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const moveFolder = useMoveFolder();
  const moveResource = useMoveResourceToFolder();
  // Soft-delete mutations — used by the per-card Trash hover action.
  // These archive the resource (sets archived=true); the Archive tab
  // owns the hard-delete + restore flows.
  const deleteDoc = useDeleteDocument();
  const deleteSheet = useDeleteSpreadsheet();

  const [tab, setTab] = useState<TabId>("all");
  const [filter, setFilter] = useState("");
  /** null = workspace root. Otherwise: the active folder id. */
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  // Pending delete from a card's hover Trash icon. Opens the
  // DeleteResourceDialog, which handles the actual archive +
  // (C-level only) permanent-delete confirm flow. Cleared on dialog
  // close.
  const [pendingDelete, setPendingDelete] = useState<{
    kind: WorkspaceResourceKind;
    id: string;
    title: string;
  } | null>(null);

  // Inline UI state — replaces browser prompt()/confirm() which are
  // suppressed in Tauri's macOS WKWebView and silently return null.
  //   creatingUnder: "root" | <parentFolderId> | null
  //     When set, an inline text input renders in that scope.
  //   renamingId: id of the folder currently being renamed (input replaces label)
  //   pendingDeleteId: id of the folder showing the inline confirm row
  const [creatingUnder, setCreatingUnder] = useState<"root" | string | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Body-content search (unchanged from previous version)
  const trimmedQuery = filter.trim();
  const { data: bodyHits } = useQuery({
    queryKey: ["workspace", "search", "bodies", trimmedQuery],
    enabled: trimmedQuery.length >= 2,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await takeOversupabase
        .from("workspace_documents")
        .select("id, content")
        .eq("archived", false);
      if (error) throw error;
      const matches = new Set<string>();
      for (const r of data ?? []) {
        const text = extractDocText((r as any).content);
        if (matchesQuery(text, trimmedQuery)) matches.add((r as any).id);
      }
      return matches;
    },
    staleTime: 5_000,
  });

  // Effective tab — if a non-C-level user somehow has tab="archived"
  // in state (e.g. they were demoted), silently fall back to "all".
  const effectiveTab: TabId = tab === "archived" && !isCLevel ? "all" : tab;

  // Resource filter pipeline: archive bucket → folder → tab → search.
  // The Archive tab ignores folder and shows the archive flat.
  const filtered = useMemo<WorkspaceResource[]>(() => {
    if (effectiveTab === "archived") {
      // Archive view: every archived row, no folder filter (archives
      // are flat — a folder might itself be deleted while a doc inside
      // it lingers).
      const archived = resources.filter((r) => (r as any).archived);
      if (!trimmedQuery) return archived;
      return archived.filter((r) => matchesQuery(r.title, trimmedQuery));
    }

    // Active tabs: drop archived rows.
    const active = resources.filter((r) => !(r as any).archived);
    const byFolder = active.filter((r) =>
      activeFolderId === null
        ? r.folder_id === null
        : r.folder_id === activeFolderId,
    );
    const byTab = byFolder.filter((r) => {
      if (effectiveTab === "documents") return r.kind === "document";
      if (effectiveTab === "spreadsheets") return r.kind === "spreadsheet";
      return true;
    });
    if (!trimmedQuery) return byTab;
    return byTab.filter((r) => {
      if (matchesQuery(r.title, trimmedQuery)) return true;
      if (r.kind === "document" && bodyHits?.has(r.id)) return true;
      return false;
    });
  }, [resources, activeFolderId, effectiveTab, trimmedQuery, bodyHits]);

  // Archived count for the tab chip.
  const archivedCount = useMemo(
    () => resources.filter((r) => (r as any).archived).length,
    [resources],
  );

  const counts = useMemo(() => {
    const scope = resources.filter((r) =>
      activeFolderId === null
        ? r.folder_id === null
        : r.folder_id === activeFolderId,
    );
    return {
      all: scope.length,
      documents: scope.filter((r) => r.kind === "document").length,
      spreadsheets: scope.filter((r) => r.kind === "spreadsheet").length,
    };
  }, [resources, activeFolderId]);

  // ── Editorial header helpers ──────────────────────────────────
  // Top 3 most-recently-touched, non-archived resources for the
  // "Pick up where you left off" strip above the card grid. Skipped
  // if the workspace has fewer than 4 total items -- showing the same
  // three cards twice in a row would look silly.
  const recentThree = useMemo<WorkspaceResource[]>(() => {
    const active = resources.filter((r) => !(r as any).archived);
    if (active.length < 4) return [];
    return [...active]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3);
  }, [resources]);

  // Plain-English "since last edit" stamp for the stats strip. Uses
  // the freshest updated_at across the whole workspace -- a single
  // signal that the workspace is alive.
  const sinceLastEdit = useMemo<string>(() => {
    if (resources.length === 0) return "—";
    const latest = resources.reduce((max, r) =>
      r.updated_at.localeCompare(max) > 0 ? r.updated_at : max,
      resources[0].updated_at,
    );
    const t = new Date(latest).getTime();
    if (Number.isNaN(t)) return "—";
    const diff = Date.now() - t;
    if (diff < 60_000) return "just now";
    if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h`;
    return `${Math.floor(diff / (24 * 60 * 60_000))}d`;
  }, [resources]);

  // Breadcrumb walk — climb parent_folder_id from active up to root.
  const breadcrumb = useMemo<WorkspaceFolder[]>(() => {
    const chain: WorkspaceFolder[] = [];
    let cursor = folders.find((f) => f.id === activeFolderId) ?? null;
    while (cursor) {
      chain.unshift(cursor);
      cursor = folders.find((f) => f.id === cursor!.parent_folder_id) ?? null;
    }
    return chain;
  }, [folders, activeFolderId]);

  const handleNewDoc = async () => {
    if (!username) return;
    const created = await createDoc.mutateAsync({ owner: username });
    if (activeFolderId) {
      await moveResource.mutateAsync({
        kind: "document",
        id: created.id,
        folder_id: activeFolderId,
      });
    }
    navigate({ to: "/workspace/docs/$id", params: { id: created.id } });
  };

  const handleNewSheet = async () => {
    if (!username) return;
    const created = await createSheet.mutateAsync({ owner: username });
    if (activeFolderId) {
      await moveResource.mutateAsync({
        kind: "spreadsheet",
        id: created.id,
        folder_id: activeFolderId,
      });
    }
    navigate({ to: "/workspace/sheets/$id", params: { id: created.id } });
  };

  // ── Folder ops ──────────────────────────────────────────────────
  // Inline-state-driven instead of prompt()/confirm() because Tauri's
  // macOS WKWebView silently suppresses both native dialogs.

  const beginNewFolder = (parentId: string | null) => {
    setCreatingUnder(parentId ?? "root");
    setRenamingId(null);
    setPendingDeleteId(null);
  };

  const commitNewFolder = async (name: string) => {
    if (!username || !name.trim()) {
      setCreatingUnder(null);
      return;
    }
    const parentId =
      creatingUnder === "root" || creatingUnder === null ? null : creatingUnder;
    await createFolder.mutateAsync({
      name: name.trim(),
      owner: username,
      parent_folder_id: parentId,
    });
    setCreatingUnder(null);
  };

  const beginRename = (id: string) => {
    setRenamingId(id);
    setCreatingUnder(null);
    setPendingDeleteId(null);
  };

  const commitRename = async (id: string, name: string) => {
    const current = folders.find((f) => f.id === id);
    if (!current || !name.trim() || name.trim() === current.name) {
      setRenamingId(null);
      return;
    }
    await renameFolder.mutateAsync({ id, name: name.trim() });
    setRenamingId(null);
  };

  const beginDelete = (id: string) => {
    setPendingDeleteId(id);
    setRenamingId(null);
    setCreatingUnder(null);
  };

  const commitDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    await deleteFolder.mutateAsync(id);
    if (activeFolderId === id) setActiveFolderId(null);
    setPendingDeleteId(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      {/* Full-width page shell — no max-width clamp. Folder sidebar
        * stays at 240px, main column fills everything else edge-to-edge.
        * Horizontal padding scales up at wider viewports so the content
        * still breathes on ultrawide displays without forcing centered
        * dead zones. */}
      <div className="w-full px-6 lg:px-8 xl:px-10 py-10 grid grid-cols-[240px_1fr] gap-8">
        {/* ── Folder sidebar ─────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] tracking-[0.16em] uppercase text-foreground/40 font-semibold">
              Folders
            </span>
            <button
              type="button"
              onClick={() => beginNewFolder(null)}
              title="New top-level folder"
              className="text-foreground/40 hover:text-foreground transition-colors"
            >
              <FolderPlus size={13} />
            </button>
          </div>

          {/* Root pill */}
          <RootPill
            active={activeFolderId === null}
            onClick={() => setActiveFolderId(null)}
            onDrop={(payload) => {
              if (payload.kind === "folder") {
                moveFolder.mutate({ id: payload.id, newParentId: null });
              } else {
                moveResource.mutate({
                  kind: payload.kind,
                  id: payload.id,
                  folder_id: null,
                });
              }
            }}
          />

          {/* Inline new-folder input at root level */}
          {creatingUnder === "root" && (
            <InlineFolderInput
              placeholder="Folder name…"
              depth={0}
              onCommit={commitNewFolder}
              onCancel={() => setCreatingUnder(null)}
            />
          )}

          {/* Folder tree (recursive) */}
          <FolderTree
            folders={folders}
            counts={folderCounts}
            activeFolderId={activeFolderId}
            renamingId={renamingId}
            creatingUnder={creatingUnder}
            pendingDeleteId={pendingDeleteId}
            onSelect={setActiveFolderId}
            onNewSub={(parentId) => beginNewFolder(parentId)}
            onRename={(f) => beginRename(f.id)}
            onDelete={(f) => beginDelete(f.id)}
            onCommitNew={commitNewFolder}
            onCancelNew={() => setCreatingUnder(null)}
            onCommitRename={commitRename}
            onCancelRename={() => setRenamingId(null)}
            onCommitDelete={commitDelete}
            onCancelDelete={() => setPendingDeleteId(null)}
            onDropResource={(folderId, payload) => {
              if (payload.kind === "folder") {
                if (payload.id === folderId) return;
                moveFolder.mutate({ id: payload.id, newParentId: folderId });
              } else {
                moveResource.mutate({
                  kind: payload.kind,
                  id: payload.id,
                  folder_id: folderId,
                });
              }
            }}
          />
        </aside>

        {/* ── Main column ────────────────────────────────────────── */}
        <main>
          {/* Newsreader serif loaded inline once — matches the
            * editorial header used on SalesPage + financialDashboard
            * so all three "operator-facing" routes read as a family. */}
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap');.ed-serif{font-family:'Newsreader',Georgia,serif}`}</style>

          {/* ── Editorial masthead ───────────────────────────────
            * Mono pulse-dot eyebrow → serif italic title → muted
            * sub-copy on the left; live "Workspace" status pill on
            * the right. Stats strip below sits flush against the
            * masthead -- one tall surface, not two stacked cards. */}
          <header className="mb-8">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2 min-w-0 max-w-[62%]">
                <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/45">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary/70 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary,#dc2626)]" />
                  </span>
                  CodeWithAli · Workspace
                </p>
                <h1 className="ed-serif text-[44px] leading-[1.02] text-foreground tracking-tight m-0">
                  Docs{" "}
                  <span className="italic font-normal text-foreground/75">
                    &amp; sheets
                  </span>
                </h1>
                <Breadcrumb
                  chain={breadcrumb}
                  onJump={(id) => setActiveFolderId(id)}
                />
                <p className="text-[12.5px] text-foreground/55 leading-snug pt-1">
                  Documents, spreadsheets, and folders for the team. Edits
                  sync live. Drop anything into the workspace and it lands
                  here.
                </p>
              </div>

              {/* Right rail — Live pill mirrors the Sales/Finance
                * "Live · CRM" / "Live · Stripe" badge so the visual
                * grammar is consistent across routes. */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300 text-[10px] font-mono uppercase tracking-[0.16em]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  </span>
                  Live · Workspace
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
                  Since last edit · <span className="text-primary">{sinceLastEdit}</span>
                </div>
              </div>
            </div>

            {/* At-a-glance stats — sits below the masthead, flush
              * against the row above + below for a single editorial
              * column rather than separated cards. */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 py-4 border-y border-border/60">
              <StatPair
                label="Documents"
                value={resources.filter(
                  (r) => r.kind === "document" && !(r as any).archived,
                ).length}
              />
              <StatPair
                label="Spreadsheets"
                value={resources.filter(
                  (r) => r.kind === "spreadsheet" && !(r as any).archived,
                ).length}
              />
              <StatPair label="Folders" value={folders.length} />
            </div>

            {/* Primary CTAs + filter on one row */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleNewDoc}
                disabled={createDoc.isPending || !username}
                className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {createDoc.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileText size={13} />
                )}
                New document
              </button>
              <button
                type="button"
                onClick={handleNewSheet}
                disabled={createSheet.isPending || !username}
                className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm border border-border bg-secondary text-foreground text-[12px] font-bold uppercase tracking-wider hover:bg-muted transition-colors disabled:opacity-40"
              >
                {createSheet.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sheet size={13} />
                )}
                New spreadsheet
              </button>

              <div className="relative ml-auto w-full sm:w-[260px]">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/35"
                />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by title or content…"
                  className="w-full h-9 pl-8 pr-2 rounded-sm bg-muted/30 border border-border/60 text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/30 transition-colors"
                />
              </div>
            </div>
          </header>

          {/* ── Recents strip — "Pick up where you left off" ─────
            * Hidden when the workspace has fewer than 4 items (the
            * recents list would mirror the main grid). Only shown on
            * the "All" tab + root folder -- a recents strip inside a
            * folder filter would be confusing. */}
          {recentThree.length > 0 &&
            tab === "all" &&
            activeFolderId === null &&
            !filter.trim() && (
              <section className="mb-7">
                <div className="flex items-baseline justify-between mb-2.5">
                  <h2 className="text-[10.5px] tracking-[0.14em] uppercase text-foreground/40 m-0">
                    Pick up where you left off
                  </h2>
                  <span className="text-[10.5px] text-foreground/35">
                    Last 7 days
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {recentThree.map((r) => (
                    <RecentCard
                      key={`recent-${r.kind}-${r.id}`}
                      resource={r}
                      onOpen={() => {
                        if (r.kind === "document") {
                          navigate({
                            to: "/workspace/docs/$id",
                            params: { id: r.id },
                          });
                        } else {
                          navigate({
                            to: "/workspace/sheets/$id",
                            params: { id: r.id },
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* ── Tab strip ────────────────────────────────────────
            * Pill-style segmented control matching the Connectors
            * settings page. The sliding background between active
            * options is shared across all PillTabs instances via the
            * groupId. */}
          <div className="flex items-center gap-3 mb-6">
            <PillTabs
              groupId="workspaceMainTabs"
              value={tab}
              onChange={(v) => setTab(v as TabId)}
              options={[
                { value: "all", label: "All", count: counts.all },
                {
                  value: "documents",
                  label: "Documents",
                  count: counts.documents,
                },
                {
                  value: "spreadsheets",
                  label: "Spreadsheets",
                  count: counts.spreadsheets,
                },
                // Archive only renders for C-level + when there's
                // something archived. Hidden chips never reach PillTabs.
                ...(isCLevel && archivedCount > 0
                  ? [
                      {
                        value: "archived" as TabId,
                        label: "Archive",
                        count: archivedCount,
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {/* Single full-width column. Recent Activity rail removed
           *  — it duplicated the resource updated-at and didn't drive
           *  any action. */}
          <div className="w-full">
            <div>
              {isLoading ? (
                <div className="py-16 flex items-center justify-center text-foreground/40 text-[13px]">
                  <Loader2 size={14} className="animate-spin mr-2" /> Loading
                  workspace…
                </div>
              ) : filtered.length === 0 ? (
                effectiveTab === "archived" ? (
                  <div className="py-16 text-center text-foreground/50 text-[13px]">
                    Nothing archived. Items deleted from a document or
                    spreadsheet detail page land here.
                  </div>
                ) : (
                  <EmptyState
                    filtered={!!filter}
                    inFolder={activeFolderId !== null}
                    onNewDoc={handleNewDoc}
                    onNewSheet={handleNewSheet}
                  />
                )
              ) : effectiveTab === "archived" ? (
                <ul className="space-y-2 list-none p-0 m-0">
                  {filtered.map((r) => (
                    <ArchivedRow
                      key={`${r.kind}-${r.id}`}
                      resource={r}
                      isCLevel={isCLevel}
                      onRestore={async () => {
                        if (r.kind === "document") {
                          await restoreDocMut.mutateAsync(r.id);
                        } else {
                          await restoreSheetMut.mutateAsync(r.id);
                        }
                      }}
                      onHardDelete={async () => {
                        if (r.kind === "document") {
                          await hardDeleteDocMut.mutateAsync(r.id);
                        } else {
                          await hardDeleteSheetMut.mutateAsync(r.id);
                        }
                      }}
                    />
                  ))}
                </ul>
              ) : (
                // Auto-fill grid: every card claims ~280-320px and the
                // grid packs in as many columns as fit. On a 1400px+
                // main column this yields 4 cards/row; collapses to
                // 3 → 2 → 1 cleanly as the viewport narrows. Beats
                // fixed breakpoints which always leave dead space at
                // one zoom level or another.
                <ul
                  className="grid gap-3 list-none p-0 m-0"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                  }}
                >
                  {filtered.map((r) => (
                    <ResourceCard
                      key={`${r.kind}-${r.id}`}
                      resource={r}
                      folders={folders}
                      currentFolderId={r.folder_id}
                      onOpen={() => {
                        if (r.kind === "document") {
                          navigate({
                            to: "/workspace/docs/$id",
                            params: { id: r.id },
                          });
                        } else {
                          navigate({
                            to: "/workspace/sheets/$id",
                            params: { id: r.id },
                          });
                        }
                      }}
                      onRequestDelete={() =>
                        setPendingDelete({
                          kind: r.kind,
                          id: r.id,
                          title: r.title || "Untitled",
                        })
                      }
                      onMove={(folderId) =>
                        moveResource.mutate({
                          kind: r.kind,
                          id: r.id,
                          folder_id: folderId,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Delete confirm dialog ────────────────────────────────
        * Opened by any card's hover Trash icon via setPendingDelete.
        * The dialog handles both the soft-delete (archive) and the
        * C-level-only hard-delete (type the title to confirm) flows
        * -- we just pass the mutations. */}
      {pendingDelete && (
        <DeleteResourceDialog
          open
          onClose={() => setPendingDelete(null)}
          kind={pendingDelete.kind}
          title={pendingDelete.title}
          onArchive={async () => {
            if (pendingDelete.kind === "document") {
              await deleteDoc.mutateAsync(pendingDelete.id);
            } else {
              await deleteSheet.mutateAsync(pendingDelete.id);
            }
            setPendingDelete(null);
          }}
          onHardDelete={async () => {
            if (pendingDelete.kind === "document") {
              await hardDeleteDocMut.mutateAsync(pendingDelete.id);
            } else {
              await hardDeleteSheetMut.mutateAsync(pendingDelete.id);
            }
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Drag-and-drop payload — encoded as JSON in dataTransfer.
// ──────────────────────────────────────────────────────────────────
type DragPayload =
  | { kind: "document"; id: string }
  | { kind: "spreadsheet"; id: string }
  | { kind: "folder"; id: string };

const DT_TYPE = "application/x-workspace-drag";

function encodeDrag(p: DragPayload): string {
  return JSON.stringify(p);
}
function decodeDrag(s: string | null): DragPayload | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as DragPayload;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Root pill — "Workspace" entry at the top of the folder rail.
// Drop target for moving things back to the root.
// ──────────────────────────────────────────────────────────────────
function RootPill({
  active,
  onClick,
  onDrop,
}: {
  active: boolean;
  onClick: () => void;
  onDrop: (payload: DragPayload) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const payload = decodeDrag(e.dataTransfer.getData(DT_TYPE));
        if (payload) onDrop(payload);
      }}
      className={
        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-left transition-colors " +
        (active
          ? "bg-primary/[0.10] text-foreground border border-primary/30"
          : over
            ? "bg-primary/[0.06] text-foreground border border-primary/20"
            : "text-foreground/70 hover:text-foreground hover:bg-muted/40 border border-transparent")
      }
    >
      <span className="inline-flex items-center gap-2">
        <Home size={12} className="text-foreground/50" />
        <span className="text-[12.5px] font-semibold">Workspace</span>
      </span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Recursive folder tree.
// ──────────────────────────────────────────────────────────────────
function FolderTree({
  folders,
  counts,
  activeFolderId,
  renamingId,
  creatingUnder,
  pendingDeleteId,
  onSelect,
  onNewSub,
  onRename,
  onDelete,
  onCommitNew,
  onCancelNew,
  onCommitRename,
  onCancelRename,
  onCommitDelete,
  onCancelDelete,
  onDropResource,
}: {
  folders: WorkspaceFolder[];
  counts: Map<string, WorkspaceFolderCounts> | undefined;
  activeFolderId: string | null;
  renamingId: string | null;
  creatingUnder: "root" | string | null;
  pendingDeleteId: string | null;
  onSelect: (id: string) => void;
  onNewSub: (parentId: string) => void;
  onRename: (f: WorkspaceFolder) => void;
  onDelete: (f: WorkspaceFolder) => void;
  onCommitNew: (name: string) => void;
  onCancelNew: () => void;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onCommitDelete: () => void;
  onCancelDelete: () => void;
  onDropResource: (folderId: string, payload: DragPayload) => void;
}) {
  // Index folders by parent so we can render each subtree.
  const byParent = useMemo(() => {
    const m = new Map<string | "root", WorkspaceFolder[]>();
    for (const f of folders) {
      const key = f.parent_folder_id ?? "root";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(f);
    }
    return m;
  }, [folders]);

  const roots = byParent.get("root") ?? [];

  if (roots.length === 0) {
    return (
      <p className="text-[11.5px] text-foreground/40 italic px-2 py-2">
        No folders yet. Click + above to create one.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 list-none p-0 m-0">
      {roots.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          byParent={byParent}
          counts={counts}
          depth={0}
          activeFolderId={activeFolderId}
          renamingId={renamingId}
          creatingUnder={creatingUnder}
          pendingDeleteId={pendingDeleteId}
          onSelect={onSelect}
          onNewSub={onNewSub}
          onRename={onRename}
          onDelete={onDelete}
          onCommitNew={onCommitNew}
          onCancelNew={onCancelNew}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onCommitDelete={onCommitDelete}
          onCancelDelete={onCancelDelete}
          onDropResource={onDropResource}
        />
      ))}
    </ul>
  );
}

type FolderNodeProps = {
  folder: WorkspaceFolder;
  byParent: Map<string | "root", WorkspaceFolder[]>;
  counts: Map<string, WorkspaceFolderCounts> | undefined;
  depth: number;
  activeFolderId: string | null;
  renamingId: string | null;
  creatingUnder: "root" | string | null;
  pendingDeleteId: string | null;
  onSelect: (id: string) => void;
  onNewSub: (parentId: string) => void;
  onRename: (f: WorkspaceFolder) => void;
  onDelete: (f: WorkspaceFolder) => void;
  onCommitNew: (name: string) => void;
  onCancelNew: () => void;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onCommitDelete: () => void;
  onCancelDelete: () => void;
  onDropResource: (folderId: string, payload: DragPayload) => void;
};

function FolderNode(props: FolderNodeProps) {
  const {
    folder,
    byParent,
    counts,
    depth,
    activeFolderId,
    renamingId,
    creatingUnder,
    pendingDeleteId,
    onSelect,
    onNewSub,
    onRename,
    onDelete,
    onCommitNew,
    onCancelNew,
    onCommitRename,
    onCancelRename,
    onCommitDelete,
    onCancelDelete,
    onDropResource,
  } = props;

  const children = byParent.get(folder.id) ?? [];
  const [expanded, setExpanded] = useState(depth < 1);
  const [over, setOver] = useState(false);
  const isActive = folder.id === activeFolderId;
  const isRenaming = renamingId === folder.id;
  const isCreatingSubfolder = creatingUnder === folder.id;
  const isPendingDelete = pendingDeleteId === folder.id;
  const count = counts?.get(folder.id)?.total_count ?? 0;

  // Auto-expand if we're creating a subfolder here so the inline
  // input is visible alongside the existing children.
  useEffect(() => {
    if (isCreatingSubfolder) setExpanded(true);
  }, [isCreatingSubfolder]);

  return (
    <li className="list-none">
      <div
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData(
            DT_TYPE,
            encodeDrag({ kind: "folder", id: folder.id }),
          );
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const payload = decodeDrag(e.dataTransfer.getData(DT_TYPE));
          if (payload) onDropResource(folder.id, payload);
        }}
        className={
          "group flex items-center gap-1.5 px-1.5 py-1.5 rounded-sm text-left transition-colors cursor-pointer border " +
          (isActive
            ? "bg-primary/[0.10] text-foreground border-primary/30"
            : over
              ? "bg-primary/[0.06] text-foreground border-primary/20"
              : "text-foreground/75 hover:text-foreground hover:bg-muted/40 border-transparent")
        }
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        onClick={(e) => {
          if (isRenaming) return;
          if ((e.target as HTMLElement).closest("[data-no-select]")) return;
          onSelect(folder.id);
        }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            data-no-select
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="text-foreground/45 hover:text-foreground/70 transition-colors"
          >
            <ChevronRight
              size={12}
              className={
                "transition-transform " + (expanded ? "rotate-90" : "")
              }
            />
          </button>
        ) : (
          <span className="w-3" />
        )}

        {expanded ? (
          <FolderOpen size={12} className="text-foreground/50 shrink-0" />
        ) : (
          <Folder size={12} className="text-foreground/50 shrink-0" />
        )}

        {isRenaming ? (
          <InlineNameInput
            initial={folder.name}
            onCommit={(name) => onCommitRename(folder.id, name)}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="flex-1 text-[12.5px] font-medium truncate">
            {folder.name}
          </span>
        )}

        {!isRenaming && count > 0 && (
          <span className="text-[10px] text-foreground/40 font-mono tabular-nums">
            {count}
          </span>
        )}

        {!isRenaming && (
          <div
            className="hidden group-hover:flex items-center gap-0.5 shrink-0"
            data-no-select
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNewSub(folder.id);
              }}
              title="New subfolder"
              className="p-0.5 text-foreground/40 hover:text-foreground transition-colors"
            >
              <Plus size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
              title="Rename"
              className="p-0.5 text-foreground/40 hover:text-foreground transition-colors"
            >
              <Pencil size={10} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder);
              }}
              title="Delete"
              className="p-0.5 text-foreground/40 hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Inline delete-confirm row */}
      {isPendingDelete && (
        <DeleteConfirmRow
          name={folder.name}
          depth={depth + 1}
          onConfirm={onCommitDelete}
          onCancel={onCancelDelete}
        />
      )}

      {expanded && (children.length > 0 || isCreatingSubfolder) && (
        <ul className="space-y-0.5 list-none p-0 m-0">
          {children.map((c) => (
            <FolderNode key={c.id} {...props} folder={c} depth={depth + 1} />
          ))}
          {isCreatingSubfolder && (
            <li className="list-none">
              <InlineFolderInput
                placeholder="Subfolder name…"
                depth={depth + 1}
                onCommit={onCommitNew}
                onCancel={onCancelNew}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Inline editors — replace browser prompt()/confirm() which are
// silently suppressed in Tauri's macOS WKWebView.
// ──────────────────────────────────────────────────────────────────

function InlineFolderInput({
  placeholder,
  depth,
  onCommit,
  onCancel,
}: {
  placeholder: string;
  depth: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-sm bg-primary/[0.04] border border-primary/20"
      style={{ paddingLeft: `${6 + depth * 14}px` }}
    >
      <Folder size={12} className="text-primary/70 shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit(value);
          else onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onCommit(value);
        }}
        className="p-0.5 text-emerald-300 hover:bg-emerald-500/[0.08] rounded-sm"
        title="Create"
      >
        <Check size={11} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        className="p-0.5 text-foreground/40 hover:text-foreground hover:bg-muted rounded-sm"
        title="Cancel"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function InlineNameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (value.trim()) onCommit(value);
        else onCancel();
      }}
      className="flex-1 bg-background border border-primary/40 rounded-sm px-1.5 py-0.5 text-[12.5px] text-foreground outline-none focus:border-primary/60"
    />
  );
}

function DeleteConfirmRow({
  name,
  depth,
  onConfirm,
  onCancel,
}: {
  name: string;
  depth: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-2 mt-0.5 rounded-sm bg-red-500/[0.08] border border-red-500/30"
      style={{ paddingLeft: `${6 + depth * 14}px` }}
    >
      <Trash2 size={11} className="text-red-300 shrink-0" />
      <span className="flex-1 text-[11.5px] text-foreground/85 truncate">
        Delete "{name}"?
      </span>
      <button
        type="button"
        onClick={onConfirm}
        className="px-2 h-6 rounded-sm bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[11px] font-bold uppercase tracking-wider transition-colors"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 h-6 rounded-sm text-foreground/55 hover:text-foreground hover:bg-muted text-[11px] font-medium transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Breadcrumb — clickable path from root → active folder.
// ──────────────────────────────────────────────────────────────────
function Breadcrumb({
  chain,
  onJump,
}: {
  chain: WorkspaceFolder[];
  onJump: (id: string | null) => void;
}) {
  if (chain.length === 0) {
    return (
      <h1 className="text-[28px] font-bold leading-tight text-foreground">
        Docs &amp; Sheets
      </h1>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onJump(null)}
        className="text-[22px] font-bold leading-tight text-foreground/55 hover:text-foreground transition-colors"
      >
        Workspace
      </button>
      {chain.map((f, idx) => (
        <span key={f.id} className="inline-flex items-center gap-1.5">
          <ChevronRight size={16} className="text-foreground/35" />
          <button
            type="button"
            onClick={() => onJump(f.id)}
            className={
              "text-[22px] font-bold leading-tight transition-colors " +
              (idx === chain.length - 1
                ? "text-foreground"
                : "text-foreground/55 hover:text-foreground")
            }
          >
            {f.name}
          </button>
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// StatPair — one cell of the at-a-glance stats strip in the page
// header. Number on top, dim uppercase label underneath. `accent`
// tints the number primary (used for "since last edit" so it reads
// as a live signal).
// ──────────────────────────────────────────────────────────────────
function StatPair({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={"flex flex-col gap-0 " + (className ?? "")}>
      <span
        className={
          "text-[16px] font-semibold tabular-nums leading-tight " +
          (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </span>
      <span className="text-[9.5px] tracking-[0.12em] uppercase text-foreground/40 mt-0.5">
        {label}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// RecentCard — larger "Pick up where you left off" tile shown above
// the main grid. Quieter than ResourceCard (no footer, no preview)
// because the grid below carries the full detail. Click navigates
// directly to the resource.
// ──────────────────────────────────────────────────────────────────
function RecentCard({
  resource,
  onOpen,
}: {
  resource: WorkspaceResource;
  onOpen: () => void;
}) {
  const isDoc = resource.kind === "document";
  const Icon = isDoc ? FileText : Sheet;
  const accent = isDoc ? "text-sky-400" : "text-emerald-400";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-sm border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-colors p-3.5 flex flex-col gap-2 min-h-[92px]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase text-foreground/40">
          <Icon size={12} className={accent} />
          {isDoc ? "Document" : "Spreadsheet"}
        </div>
        <span className="text-[10px] font-mono tabular-nums text-foreground/35">
          {formatRelative(resource.updated_at)}
        </span>
      </div>
      <div className="text-[14px] font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
        {resource.title || "Untitled"}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// ResourceCard — now draggable into folders.
// ──────────────────────────────────────────────────────────────────
function ResourceCard({
  resource,
  folders,
  currentFolderId,
  onOpen,
  onRequestDelete,
  onMove,
}: {
  resource: WorkspaceResource;
  /** Folder list for the move-to picker. Pass an empty array to hide
   *  the Move action entirely. */
  folders: WorkspaceFolder[];
  /** The folder the resource currently lives in (or null for root).
   *  Used to dim the matching entry in the move picker. */
  currentFolderId: string | null;
  onOpen: () => void;
  /** Called when the user clicks the Trash icon. Parent is expected
   *  to open a confirm dialog (DeleteResourceDialog) and run the
   *  actual archive / hard-delete from there. We don't fire the
   *  mutation directly here -- deletes always go through confirm. */
  onRequestDelete?: () => void;
  /** Move handler — pass null to move to the workspace root, or a
   *  folder id to move into that folder. */
  onMove?: (folderId: string | null) => void;
}) {
  const isDoc = resource.kind === "document";
  const Icon = isDoc ? FileText : Sheet;
  const accent = isDoc ? "text-sky-400" : "text-emerald-400";
  // "Untitled" is a placeholder both in the DB default and when a
  // user creates without naming. Render it italic + dim so it reads
  // as a draft rather than an actual title.
  const hasTitle = !!resource.title && resource.title !== "Untitled";

  // body_preview is the cached plain-text snippet maintained by
  // DocDetailPage on save. Trim & line-clamp on render so we never
  // overflow the card. Empty docs get a neutral placeholder rather
  // than a blank gap -- prevents the card from looking broken.
  const preview = (resource.body_preview ?? "").trim();
  const showPreview = preview.length > 0;
  const emptyHint = isDoc
    ? "Empty document — click to start."
    : "Empty spreadsheet — click to open.";

  // Hover-only action state. The folder picker stays open while the
  // user is in the dropdown -- clicking outside or picking an option
  // closes it. Delete just opens a confirm dialog at the page level;
  // the card never fires the mutation directly.
  const [showMove, setShowMove] = useState(false);

  function handleDeleteClick(e: ReactMouseEvent) {
    e.stopPropagation();
    onRequestDelete?.();
  }

  function handleMoveClick(e: ReactMouseEvent) {
    e.stopPropagation();
    setShowMove((s) => !s);
  }

  function pickMove(e: ReactMouseEvent, folderId: string | null) {
    e.stopPropagation();
    onMove?.(folderId);
    setShowMove(false);
  }

  return (
    <li className="list-none">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            DT_TYPE,
            encodeDrag({ kind: resource.kind, id: resource.id }),
          );
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={onOpen}
        className="group relative w-full text-left rounded-sm border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-colors p-3.5 min-h-[148px] flex flex-col gap-2 cursor-pointer"
      >
        {/* ── Hover actions overlay ────────────────────────────
          * Floating top-right cluster. Stays hidden until the card
          * is hovered (or the move picker is open). Buttons stop
          * propagation so they never trigger card-open. */}
        {(onRequestDelete || onMove) && (
          <div
            className={
              "absolute top-2.5 right-2.5 z-10 flex items-center gap-1 transition-opacity " +
              (showMove
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100")
            }
            onClick={(e) => e.stopPropagation()}
          >
            {onMove && folders.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Move to folder"
                  onClick={handleMoveClick}
                  className="w-6 h-6 inline-flex items-center justify-center rounded-sm bg-background/85 backdrop-blur-sm border border-border hover:border-primary/40 hover:text-primary text-foreground/65 transition-colors"
                >
                  <FolderOpen size={12} />
                </button>
                {showMove && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 min-w-[180px] max-h-[260px] overflow-y-auto rounded-sm bg-popover border border-border shadow-lg py-1 z-20"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => pickMove(e, null)}
                      disabled={currentFolderId === null}
                      className="w-full text-left px-2.5 py-1.5 text-[11.5px] flex items-center gap-2 hover:bg-muted/60 disabled:opacity-40 disabled:cursor-default"
                    >
                      <Home size={11} className="text-foreground/45" />
                      Workspace root
                    </button>
                    <div className="h-px bg-border/60 my-1" />
                    {folders.map((f) => (
                      <button
                        type="button"
                        role="menuitem"
                        key={f.id}
                        onClick={(e) => pickMove(e, f.id)}
                        disabled={currentFolderId === f.id}
                        className="w-full text-left px-2.5 py-1.5 text-[11.5px] flex items-center gap-2 hover:bg-muted/60 disabled:opacity-40 disabled:cursor-default"
                      >
                        <Folder size={11} className="text-foreground/45" />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {onRequestDelete && (
              <button
                type="button"
                aria-label="Delete document"
                title="Delete"
                onClick={handleDeleteClick}
                className="w-6 h-6 inline-flex items-center justify-center rounded-sm bg-background/85 backdrop-blur-sm border border-border hover:border-destructive/40 hover:text-destructive text-foreground/65 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        {/* Title row -- icon inline with the title, visibility lock on
          * the right. Replaces the old "DOCUMENT" eyebrow + separate
          * title row; the icon color already encodes kind (sky = doc,
          * emerald = sheet) so the explicit label is redundant. Italic
          * + muted styling for placeholder "Untitled" docs. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon
              size={14}
              className={accent + " flex-shrink-0 mt-0.5"}
            />
            <div
              className={
                "text-[13.5px] line-clamp-2 transition-colors leading-tight min-w-0 " +
                (hasTitle
                  ? "font-semibold text-foreground group-hover:text-primary"
                  : "font-normal italic text-foreground/45 group-hover:text-foreground/65")
              }
            >
              {resource.title || "Untitled"}
            </div>
          </div>
          {resource.visibility === "shared" ? (
            <Globe size={11} className="text-emerald-400/80 flex-shrink-0 mt-1" />
          ) : (
            <Lock size={11} className="text-foreground/30 flex-shrink-0 mt-1" />
          )}
        </div>

        {/* 3-line preview snippet */}
        <div
          className={
            "text-[11px] leading-[1.5] line-clamp-3 " +
            (showPreview
              ? "text-foreground/55"
              : "text-foreground/35 italic")
          }
        >
          {showPreview ? preview : emptyHint}
        </div>

        {/* Footer separated by a dashed border for the editorial feel */}
        <div className="mt-auto pt-2 border-t border-dashed border-border/60 text-[10.5px] text-foreground/45 flex items-center justify-between">
          <span>{resource.updated_by ?? resource.owner}</span>
          <span className="font-mono tabular-nums text-foreground/35">
            {formatRelative(resource.updated_at)}
          </span>
        </div>
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// ArchivedRow — single archive entry with Restore + (C-level only)
// Delete-forever actions. Rendered only inside the Archive tab,
// which itself is gated to C-level users.
// ──────────────────────────────────────────────────────────────────
function ArchivedRow({
  resource,
  isCLevel,
  onRestore,
  onHardDelete,
}: {
  resource: WorkspaceResource;
  isCLevel: boolean;
  onRestore: () => Promise<void>;
  onHardDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);

  async function doRestore() {
    setBusy("restore");
    try {
      await onRestore();
    } finally {
      setBusy(null);
    }
  }
  async function doHardDelete() {
    if (
      !window.confirm(
        `Permanently delete "${resource.title || "Untitled"}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await onHardDelete();
    } finally {
      setBusy(null);
    }
  }

  const Icon = resource.kind === "document" ? FileText : Sheet;
  return (
    <li className="list-none">
      <div className="flex items-center gap-3 rounded-sm border border-border/60 bg-muted/20 hover:bg-muted/30 px-3.5 py-2.5 transition-colors">
        <Icon size={14} className="text-foreground/45 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-foreground/85 truncate">
            {resource.title || "Untitled"}
          </div>
          <div className="text-[10.5px] text-foreground/40 flex items-center gap-2">
            <span className="uppercase tracking-wider">{resource.kind}</span>
            <span>·</span>
            <span>{resource.owner}</span>
            <span>·</span>
            <span>archived {formatRelative(resource.updated_at)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={doRestore}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 rounded-sm px-2 py-1 disabled:opacity-50"
        >
          {busy === "restore" ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Check size={11} />
          )}
          Restore
        </button>
        {isCLevel && (
          <button
            type="button"
            onClick={doHardDelete}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 rounded-sm px-2 py-1 disabled:opacity-50"
            title="Delete permanently"
          >
            {busy === "delete" ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Trash2 size={11} />
            )}
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// EmptyState — context-aware (root vs inside folder).
// ──────────────────────────────────────────────────────────────────
function EmptyState({
  filtered,
  inFolder,
  onNewDoc,
  onNewSheet,
}: {
  filtered: boolean;
  inFolder: boolean;
  onNewDoc: () => void;
  onNewSheet: () => void;
}) {
  if (filtered) {
    return (
      <div className="py-16 text-center text-[13px] text-foreground/55">
        <Archive size={20} className="mx-auto mb-3 text-foreground/35" />
        Nothing matches that filter.
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/40 px-8 py-12 text-center max-w-md mx-auto">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-sm bg-sky-500/10 border border-sky-500/25 flex items-center justify-center">
          <FileText className="h-5 w-5 text-sky-300" />
        </div>
        <div className="h-12 w-12 rounded-sm bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
          <Sheet className="h-5 w-5 text-emerald-300" />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-foreground mb-1">
        {inFolder ? "This folder is empty" : "Start your first workspace"}
      </p>
      <p className="text-[12.5px] text-foreground/55 mb-5">
        {inFolder
          ? "Create a doc or sheet here, or drag an existing one from the root into this folder."
          : "Documents are for prose and structured notes. Spreadsheets are for tables, formulas, and tabular data."}
      </p>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onNewDoc}
          className="px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90"
        >
          New document
        </button>
        <button
          type="button"
          onClick={onNewSheet}
          className="px-3 h-8 rounded-sm border border-border bg-secondary text-foreground text-[11.5px] font-bold uppercase tracking-wider hover:bg-muted"
        >
          New spreadsheet
        </button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
