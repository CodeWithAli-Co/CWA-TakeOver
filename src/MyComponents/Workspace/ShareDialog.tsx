/**
 * ShareDialog.tsx — Modal for managing collaborators on a doc or sheet.
 *
 * Owner-driven workflow:
 *   · Owner sees the full list (themselves marked "owner" + everyone in
 *     workspace_collaborators).
 *   · Owner can add by username from a dropdown of employees they
 *     haven't already invited.
 *   · Each collaborator's role is editable inline; remove is a single
 *     click.
 *   · Non-owners see a read-only view of who else has access.
 *
 * Tied to the Phase 1 schema's three-tier role model (viewer / commenter
 * / editor). The owner role is implicit — the resource's `owner` column
 * always has full access and isn't represented in the collaborators
 * table.
 */

import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/shadcnComponents/dialog";
import {
  UserPlus, Trash2, Loader2, Crown, ChevronDown, Lock, Globe,
} from "lucide-react";
import {
  useCollaborators,
  useAddCollaborator,
  useUpdateCollaboratorRole,
  useRemoveCollaborator,
  useUpdateDocument,
  useUpdateSpreadsheet,
} from "@/stores/workspace";
import type {
  WorkspaceResourceKind,
  WorkspaceRole,
  WorkspaceVisibility,
} from "@/stores/workspaceTypes";
import { Employees } from "@/stores/query";
import { colorForUser } from "@/lib/yjs/awareness";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: WorkspaceResourceKind;
  resourceId: string;
  resourceTitle: string;
  owner: string;
  /** Current operator username — used to decide whether to render
   *  editable controls (only the owner can manage collaborators). */
  currentUsername: string;
  /** Current visibility flag from the resource row. */
  visibility: WorkspaceVisibility;
}

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  viewer: "Can view",
  commenter: "Can comment",
  editor: "Can edit",
};

const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  viewer: "Read-only access. Cannot edit or comment.",
  commenter: "Can read and leave comments. Cannot edit the content.",
  editor: "Full edit access. Cannot manage collaborators.",
};

export function ShareDialog({
  open, onOpenChange, kind, resourceId, resourceTitle, owner, currentUsername, visibility,
}: Props) {
  const isOwner = owner === currentUsername;
  const { data: collaborators = [], isLoading } = useCollaborators(kind, resourceId);
  const { data: employees = [] } = Employees();
  const addMut = useAddCollaborator();
  const removeMut = useRemoveCollaborator();
  const roleMut = useUpdateCollaboratorRole();
  const docUpdateMut = useUpdateDocument();
  const sheetUpdateMut = useUpdateSpreadsheet();

  const [pickerUsername, setPickerUsername] = useState<string>("");
  const [pickerRole, setPickerRole] = useState<WorkspaceRole>("editor");

  const availableEmployees = useMemo(() => {
    const taken = new Set<string>([owner, ...collaborators.map((c) => c.username)]);
    return (employees ?? [])
      .map((e: any) => e?.username)
      .filter((u: string | undefined): u is string => !!u && !taken.has(u));
  }, [employees, collaborators, owner]);

  const handleAdd = async () => {
    if (!pickerUsername) return;
    await addMut.mutateAsync({
      kind,
      resourceId,
      username: pickerUsername,
      role: pickerRole,
      addedBy: currentUsername,
    });
    setPickerUsername("");
  };

  const handleVisibilityChange = async (next: WorkspaceVisibility) => {
    if (kind === "document") {
      await docUpdateMut.mutateAsync({
        id: resourceId,
        patch: { visibility: next },
        updatedBy: currentUsername,
      });
    } else {
      await sheetUpdateMut.mutateAsync({
        id: resourceId,
        patch: { visibility: next },
        updatedBy: currentUsername,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <div className="text-[10px] tracking-[0.14em] uppercase text-foreground/40 mb-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            Share
          </div>
          <DialogTitle className="text-[15px] font-bold text-foreground truncate">
            {resourceTitle || "Untitled"}
          </DialogTitle>
        </div>

        {/* ── Visibility toggle ────────────────────────────────── */}
        <section className="px-5 py-3 border-b border-border/60">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 mb-2">
            General access
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleVisibilityChange("private")}
              disabled={!isOwner}
              className={
                "flex-1 inline-flex items-center gap-2 px-3 h-8 rounded-sm text-[11.5px] font-semibold transition-colors " +
                (visibility === "private"
                  ? "bg-muted text-foreground border border-border"
                  : "border border-transparent text-foreground/55 hover:bg-muted/30")
              }
            >
              <Lock size={12} /> Private
            </button>
            <button
              type="button"
              onClick={() => handleVisibilityChange("shared")}
              disabled={!isOwner}
              className={
                "flex-1 inline-flex items-center gap-2 px-3 h-8 rounded-sm text-[11.5px] font-semibold transition-colors " +
                (visibility === "shared"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                  : "border border-transparent text-foreground/55 hover:bg-muted/30")
              }
            >
              <Globe size={12} /> Anyone in workspace
            </button>
          </div>
          <p className="text-[10.5px] text-foreground/45 mt-2 leading-relaxed">
            {visibility === "shared"
              ? "Anyone signed in to Takeover can find and edit this."
              : "Only the owner and people explicitly invited can access."}
          </p>
        </section>

        {/* ── Add collaborator ─────────────────────────────────── */}
        {isOwner && (
          <section className="px-5 py-3 border-b border-border/60">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 mb-2">
              Invite by username
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pickerUsername}
                onChange={(e) => setPickerUsername(e.target.value)}
                className="flex-1 h-8 px-2 rounded-sm bg-muted/30 border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
              >
                <option value="">Select a teammate…</option>
                {availableEmployees.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <select
                value={pickerRole}
                onChange={(e) => setPickerRole(e.target.value as WorkspaceRole)}
                className="h-8 px-2 rounded-sm bg-muted/30 border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
              >
                {(Object.keys(ROLE_LABELS) as WorkspaceRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!pickerUsername || addMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {addMut.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UserPlus size={12} />
                )}
                Add
              </button>
            </div>
            <p className="text-[10.5px] text-foreground/45 mt-2 leading-relaxed">
              {ROLE_DESCRIPTIONS[pickerRole]}
            </p>
          </section>
        )}

        {/* ── Current collaborators ───────────────────────────── */}
        <section className="px-5 py-3">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 mb-2">
            With access
          </div>
          <ul className="space-y-1">
            <li className="flex items-center gap-3 px-2 py-1.5">
              <Avatar name={owner} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-foreground truncate">
                  {owner}
                  {owner === currentUsername && (
                    <span className="text-foreground/45 font-normal ml-1.5">
                      (you)
                    </span>
                  )}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <Crown size={10} /> Owner
              </div>
            </li>

            {isLoading ? (
              <li className="py-3 flex items-center justify-center text-foreground/45 text-[12px]">
                <Loader2 size={12} className="animate-spin mr-2" />
                Loading…
              </li>
            ) : collaborators.length === 0 ? (
              <li className="py-2 text-[11.5px] text-foreground/45 leading-relaxed pl-2">
                No collaborators yet.{" "}
                {isOwner
                  ? "Invite teammates above."
                  : "Only the owner can invite people."}
              </li>
            ) : (
              collaborators.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-muted/20"
                >
                  <Avatar name={c.username} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-foreground truncate">
                      {c.username}
                    </div>
                    <div className="text-[10.5px] text-foreground/45 truncate">
                      Added by {c.added_by ?? "—"}
                    </div>
                  </div>
                  {isOwner ? (
                    <>
                      <RoleSelect
                        value={c.role}
                        onChange={(role) =>
                          roleMut.mutate({
                            id: c.id,
                            kind,
                            resourceId,
                            role,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeMut.mutate({ id: c.id, kind, resourceId })
                        }
                        disabled={removeMut.isPending}
                        aria-label="Remove collaborator"
                        className="rounded-sm p-1.5 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/45 font-semibold">
                      {ROLE_LABELS[c.role]}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white shadow-sm flex-shrink-0"
      style={{ backgroundColor: colorForUser(name) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: WorkspaceRole;
  onChange: (next: WorkspaceRole) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as WorkspaceRole)}
        className="appearance-none h-7 pl-2 pr-6 rounded-sm bg-muted/30 border border-border text-[11px] font-semibold text-foreground outline-none focus:border-primary/40 cursor-pointer"
      >
        {(Object.keys(ROLE_LABELS) as WorkspaceRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground/45 pointer-events-none"
      />
    </div>
  );
}
