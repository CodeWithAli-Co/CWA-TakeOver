/**
 * ProjectDetailDrawer.tsx — Right-slide drawer that shows everything
 * about one project: overview (description, progress, tags, status
 * change pills, danger zone), activity feed, members list.
 *
 * Reads:
 *   useProject(id)          — base row
 *   useProjectMembers(id)   — join rows
 *   useProjectActivity(id)  — append-only timeline
 *
 * Writes (gated by RLS + UI):
 *   · Owner or C-level: change status (logs an activity row)
 *   · Members: append a comment
 *   · C-level: archive / hard-delete / add member
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Calendar, Flag, Activity, Sparkles, MessageSquare, Users,
  Plus, Trash2, AlertCircle, Send, Loader2,
} from "lucide-react";
import {
  useProject,
  useProjectMembers,
  useProjectActivity,
  useUpdateProject,
  useArchiveProject,
  useHardDeleteProject,
  useAppendProjectActivity,
  useAddProjectMember,
  useRemoveProjectMember,
  type ProjectStatus,
} from "@/stores/projects";
import { useAllEmployees } from "@/stores/query";
import { STATUS_META, PRIORITY_META, fmtDate, relativeTime, Avatar } from "./projectStyles";

const COLUMN_ORDER: ProjectStatus[] = [
  "to_do", "in_progress", "review", "completed", "on_hold",
];

interface Props {
  projectId: string | null;
  onClose: () => void;
  isCLevel: boolean;
  me: any | null;
}

export function ProjectDetailDrawer({ projectId, onClose, isCLevel, me }: Props) {
  return (
    <AnimatePresence>
      {projectId && (
        <DrawerBody
          projectId={projectId}
          onClose={onClose}
          isCLevel={isCLevel}
          me={me}
        />
      )}
    </AnimatePresence>
  );
}

function DrawerBody({
  projectId,
  onClose,
  isCLevel,
  me,
}: {
  projectId: string;
  onClose: () => void;
  isCLevel: boolean;
  me: any | null;
}) {
  const { data: project, isLoading } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: activity = [] } = useProjectActivity(projectId);
  const { data: employees = [] } = useAllEmployees();

  const updateMut       = useUpdateProject();
  const archiveMut      = useArchiveProject();
  const hardDeleteMut   = useHardDeleteProject();
  const appendActMut    = useAppendProjectActivity();
  const addMemberMut    = useAddProjectMember();
  const removeMemberMut = useRemoveProjectMember();

  const [tab, setTab] = useState<"overview" | "activity" | "members">("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comment, setComment] = useState("");

  const myId: string | undefined = me?.supa_id;
  const myUsername: string = me?.username ?? "";

  const isOwner = !!project && !!myId && project.owner_supa_id === myId;
  const canEditStatus = isOwner || isCLevel;
  const canManageMembers = isCLevel;
  const canArchive = isCLevel;
  const canHardDelete = isCLevel;
  const isMember = !!members.find((m) => m.user_supa_id === myId);
  const canComment = isOwner || isCLevel || isMember;

  async function handleStatus(s: ProjectStatus) {
    if (!project || !canEditStatus) return;
    if (project.status === s) return;
    await updateMut.mutateAsync({
      id: project.id,
      patch: { status: s, progress: s === "completed" ? 100 : project.progress },
      updatedBy: myUsername,
    });
    await appendActMut.mutateAsync({
      project_id: project.id,
      kind: "status",
      body: `Status → ${STATUS_META[s].label}`,
      actor_supa_id: myId ?? null,
      actor_username: myUsername || null,
    });
  }

  async function handleArchive() {
    if (!project) return;
    await archiveMut.mutateAsync(project.id);
    onClose();
  }

  async function handleHardDelete() {
    if (!project) return;
    await hardDeleteMut.mutateAsync(project.id);
    onClose();
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !comment.trim() || !canComment) return;
    await appendActMut.mutateAsync({
      project_id: project.id,
      kind: "comment",
      body: comment.trim(),
      actor_supa_id: myId ?? null,
      actor_username: myUsername || null,
    });
    setComment("");
  }

  async function handleAddMember(emp: { supa_id: string; username: string }) {
    if (!project) return;
    await addMemberMut.mutateAsync({
      project_id: project.id,
      user_supa_id: emp.supa_id,
      username: emp.username,
      added_by: myUsername || null,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[200] bg-black/35 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-[560px] h-full border-l border-xs border-border-soft flex flex-col overflow-hidden"
      >
        {isLoading || !project ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-tertiary">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-xs border-border-soft flex items-start gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-bold ${STATUS_META[project.status].chip} flex-shrink-0 mt-0.5`}>
                {(() => {
                  const Icon = STATUS_META[project.status].Icon;
                  return <Icon size={10} strokeWidth={2.5} />;
                })()}
                {STATUS_META[project.status].label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-foreground leading-snug">{project.title}</div>
                <div className="text-[11.5px] text-text-tertiary mt-0.5 flex items-center gap-2 flex-wrap">
                  {project.due ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={10} /> Due {fmtDate(project.due)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={10} /> No due date
                    </span>
                  )}
                  <span>·</span>
                  <span className={`inline-flex items-center gap-1 ${PRIORITY_META[project.priority].tone}`}>
                    <Flag size={10} strokeWidth={2.5} /> {PRIORITY_META[project.priority].label} priority
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 border-b border-xs border-border-soft flex items-center gap-1 list-none">
              {(["overview", "activity", "members"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "list-none relative px-2 py-2.5 text-[11.5px] font-bold uppercase tracking-wider transition-colors " +
                    (tab === t ? "text-foreground" : "text-text-tertiary hover:text-text-secondary")
                  }
                >
                  {t}
                  {t === "activity" && activity.length > 0 && (
                    <span className="ml-1 text-[10px] text-text-tertiary">({activity.length})</span>
                  )}
                  {t === "members" && members.length > 0 && (
                    <span className="ml-1 text-[10px] text-text-tertiary">({members.length})</span>
                  )}
                  {tab === t && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full" />}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {tab === "overview" && (
                <>
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">Description</div>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {project.description || <span className="text-text-tertiary italic">No description.</span>}
                    </p>
                  </div>

                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Progress</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-foreground/[0.07] overflow-hidden">
                        <div
                          className={`h-full ${project.status === "completed" ? "bg-emerald-500" : "bg-primary"}`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-bold tabular-nums text-foreground">{project.progress}%</span>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-1.5">
                      {project.tasks_done} of {project.tasks_total} tasks done
                    </div>
                  </div>

                  {project.tags.length > 0 && (
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10.5px] font-semibold text-text-secondary bg-foreground/[0.05] border-xs border-border-soft rounded px-1.5 py-0.5"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {canEditStatus && (
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                        Change status
                      </div>
                      <div className="flex flex-wrap gap-1.5 list-none p-0 m-0">
                        {COLUMN_ORDER.map((s) => {
                          const meta = STATUS_META[s];
                          const active = project.status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={updateMut.isPending}
                              onClick={() => handleStatus(s)}
                              className={
                                "list-none inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-bold transition-colors disabled:opacity-50 " +
                                (active
                                  ? meta.chip + " ring-1 " + meta.ring
                                  : "border-border-soft text-text-secondary hover:text-foreground hover:bg-foreground/[0.05]")
                              }
                            >
                              <meta.Icon size={10} strokeWidth={2.5} />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(canArchive || canHardDelete) && (
                    <div className="pt-2 border-t border-xs border-border-soft">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                        Danger zone
                      </div>
                      {confirmDelete ? (
                        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                          <p className="text-[12px] text-text-secondary mb-2.5">
                            Archive &ldquo;{project.title}&rdquo;? The project drops out of the board.
                            {canHardDelete && (
                              <>
                                {" "}C-level can hard-delete from the archive.
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={handleArchive}
                              disabled={archiveMut.isPending}
                              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                            >
                              {archiveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
                              Archive
                            </button>
                            {canHardDelete && (
                              <button
                                type="button"
                                onClick={handleHardDelete}
                                disabled={hardDeleteMut.isPending}
                                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={11} strokeWidth={2.5} />
                                Delete permanently
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(false)}
                              className="text-[11.5px] font-semibold text-text-secondary hover:text-foreground px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary hover:text-red-500 border-xs border-border-soft rounded-md px-2.5 py-1 transition-colors"
                        >
                          <Trash2 size={11} />
                          Archive project
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === "activity" && (
                <div className="space-y-4">
                  {canComment && (
                    <form onSubmit={handleComment} className="flex items-end gap-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment to the project…"
                        rows={2}
                        className="flex-1 bg-background/60 border-xs border-border-soft rounded-md px-2.5 py-2 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 resize-none"
                      />
                      <button
                        type="submit"
                        disabled={!comment.trim() || appendActMut.isPending}
                        className={
                          "inline-flex items-center gap-1 text-[11.5px] font-bold rounded-md px-2.5 py-2 transition-colors " +
                          (comment.trim() && !appendActMut.isPending
                            ? "bg-primary text-primary-foreground hover:opacity-90"
                            : "bg-foreground/[0.06] text-text-tertiary cursor-not-allowed")
                        }
                      >
                        <Send size={11} strokeWidth={2.5} />
                        Post
                      </button>
                    </form>
                  )}
                  <ul className="list-none p-0 m-0 space-y-3.5">
                    {activity.length === 0 ? (
                      <li className="list-none text-center py-6 text-[12px] text-text-tertiary">
                        No activity yet.
                      </li>
                    ) : (
                      activity.map((a) => (
                        <li key={a.id} className="list-none flex gap-3">
                          <div className={
                            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 " +
                            (a.kind === "axon"
                              ? "bg-primary/15 text-primary"
                              : a.kind === "status"
                              ? "bg-sky-500/15 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300"
                              : a.kind === "member"
                              ? "bg-violet-500/15 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300"
                              : a.kind === "system"
                              ? "bg-foreground/[0.06] text-text-secondary"
                              : "bg-foreground/[0.06] text-text-secondary")
                          }>
                            {a.kind === "axon" ? <Sparkles size={12} /> :
                             a.kind === "status" ? <Activity size={12} /> :
                             a.kind === "member" ? <Users size={12} /> : <MessageSquare size={12} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold text-foreground truncate">
                                {a.actor_username ?? "System"}
                              </span>
                              <span className="text-[10.5px] text-text-tertiary">{relativeTime(a.created_at)}</span>
                            </div>
                            <div className="text-[12.5px] text-text-secondary leading-snug mt-0.5 whitespace-pre-wrap">
                              {a.body}
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}

              {tab === "members" && (
                <MembersTab
                  members={members}
                  employees={employees}
                  ownerSupaId={project.owner_supa_id}
                  canManage={canManageMembers}
                  onAdd={handleAddMember}
                  onRemove={async (m) => {
                    await removeMemberMut.mutateAsync({
                      project_id: project.id,
                      member_id: m.id,
                      removed_username: m.username ?? null,
                      removed_by: myUsername || null,
                    });
                  }}
                />
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-xs border-border-soft flex items-center justify-between text-[10.5px] text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle size={10} />
                {isCLevel
                  ? "You can create, assign, archive — gated to C-level"
                  : isOwner
                  ? "Owner: change status + post comments"
                  : isMember
                  ? "Member: read + comment"
                  : "Read only"}
              </span>
              <span className="font-mono">Esc</span>
            </div>
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}

function MembersTab({
  members,
  employees,
  ownerSupaId,
  canManage,
  onAdd,
  onRemove,
}: {
  members: import("@/stores/projects").ProjectMember[];
  employees: { supa_id: string; username: string; role: string | null }[];
  ownerSupaId: string;
  canManage: boolean;
  onAdd: (e: { supa_id: string; username: string }) => void;
  onRemove: (m: import("@/stores/projects").ProjectMember) => void;
}) {
  const [adding, setAdding] = useState(false);
  const memberIds = new Set(members.map((m) => m.user_supa_id));
  const candidates = employees.filter((e) => !memberIds.has(e.supa_id));

  return (
    <div className="space-y-2.5 list-none p-0 m-0">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-md border-xs border-border-soft bg-background/40">
          <Avatar username={m.username} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              {m.username ?? m.user_supa_id.slice(0, 8)}
            </div>
            <div className="text-[11px] text-text-tertiary">{m.role}</div>
          </div>
          {m.user_supa_id === ownerSupaId ? (
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded px-1.5 py-0.5">
              Owner
            </span>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => onRemove(m)}
              className="text-[10.5px] font-semibold text-text-tertiary hover:text-red-500 px-1.5 py-0.5 rounded"
              title="Remove member"
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      {canManage && (
        <>
          {adding ? (
            <div className="rounded-md border-xs border-border-soft bg-background/40 p-2 max-h-60 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="text-[12px] text-text-tertiary px-2 py-2">No one left to add.</div>
              ) : (
                <ul className="list-none p-0 m-0 space-y-1">
                  {candidates.map((e) => (
                    <li key={e.supa_id} className="list-none">
                      <button
                        type="button"
                        onClick={() => { onAdd(e); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/[0.05] text-left"
                      >
                        <Avatar username={e.username} size={22} />
                        <span className="text-[12.5px] text-foreground flex-1 truncate">{e.username}</span>
                        <span className="text-[10.5px] text-text-tertiary">{e.role ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-1.5 border-t border-xs border-border-soft mt-1.5">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="text-[11px] text-text-tertiary hover:text-foreground px-2 py-1"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border-soft text-[12px] font-semibold text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} />
              Assign member
            </button>
          )}
        </>
      )}
    </div>
  );
}
