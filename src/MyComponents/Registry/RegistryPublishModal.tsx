/**
 * RegistryPublishModal — create-new-item flow. Captures name, kind,
 * company scope, description, tags, tarball, optional cover image.
 * If the (name, kind) already exists the mutation handles it as a
 * new-version publish automatically.
 */

import { useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X, Upload, Loader2, Package, Component as CompIcon, Tag as TagIcon, Image as ImageIcon, Check, GripHorizontal } from "lucide-react";
import { useCreateRegistryItem } from "./queries";
import type { RegistryCompany, RegistryKind } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultCompany: RegistryCompany;
  username: string;
}

export function RegistryPublishModal({ open, onClose, defaultCompany, username }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RegistryKind>("component");
  const [company, setCompany] = useState<RegistryCompany>(defaultCompany);
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [changelog, setChangelog] = useState("");
  const [tarball, setTarball] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  const create = useCreateRegistryItem();

  const reset = () => {
    setName("");
    setKind("component");
    setCompany(defaultCompany);
    setDescription("");
    setTagsRaw("");
    setVersion("1.0.0");
    setChangelog("");
    setTarball(null);
    setCover(null);
    create.reset();
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim() || !tarball) return;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    create.mutate(
      {
        name: name.trim(),
        kind,
        company,
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        tarball,
        cover: cover ?? undefined,
        createdBy: username || "unknown",
        version,
        changelog: changelog.trim() || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  const canSubmit = !!name.trim() && !!tarball && !!username && !create.isPending;

  const dragConstraintsRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
        >
          {/* Backdrop — closes on click unless uploading. */}
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Drag constraints container — keeps the card inside the viewport. */}
          <div ref={dragConstraintsRef} className="pointer-events-none absolute inset-4" />

          {/* Card — draggable ONLY by the header via dragControls. */}
          <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0.08}
            dragConstraints={dragConstraintsRef}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            whileDrag={{ scale: 1.005, cursor: "grabbing" }}
            className="relative z-10 w-[min(620px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(210 90% 55%), hsl(260 80% 60%), hsl(320 80% 60%))",
              }}
            />

            {/* Header — acts as the drag handle. onPointerDown on
                this area starts the card's drag via dragControls. */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300 ring-1 ring-inset ring-white/10">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-[15px] font-semibold text-foreground">
                        Publish to registry
                      </h2>
                      <GripHorizontal className="h-3.5 w-3.5 text-foreground/30" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">
                      Pack a project or component as <code className="font-mono">.tgz</code> and upload.
                      Re-publishing the same name creates a new version.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={create.isPending}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground/50 hover:bg-white/5 hover:text-foreground/80 disabled:opacity-40 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 pb-4">
              <div className="flex flex-col gap-4">
                {/* Name + version */}
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <FieldLabel>Name</FieldLabel>
                  <FieldLabel>Version</FieldLabel>
                  <input
                    type="text"
                    placeholder="sidebar-nav"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                    className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-[12.5px] text-foreground outline-none focus:border-blue-400/60 transition-colors"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="1.0.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-center font-mono text-[12.5px] text-foreground outline-none focus:border-blue-400/60 transition-colors"
                  />
                </div>

                {/* Kind */}
                <div>
                  <FieldLabel>Kind</FieldLabel>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <KindPill
                      active={kind === "component"}
                      onClick={() => setKind("component")}
                      Icon={CompIcon}
                      label="Component"
                      blurb="Installed into src/CWAComponents via cwa add"
                    />
                    <KindPill
                      active={kind === "template"}
                      onClick={() => setKind("template")}
                      Icon={Package}
                      label="Template"
                      blurb="Scaffolds a new project via cwa create"
                    />
                  </div>
                </div>

                {/* Company scope */}
                <div>
                  <FieldLabel>Company scope</FieldLabel>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {(["cwa", "simplicity", "shared"] as RegistryCompany[]).map((c) => (
                      <CompanyPill
                        key={c}
                        active={company === c}
                        onClick={() => setCompany(c)}
                        label={c === "cwa" ? "CWA" : c === "simplicity" ? "Simplicity" : "Shared"}
                      />
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    placeholder="Short summary of what this component does."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-blue-400/60 resize-y transition-colors"
                  />
                </div>

                {/* Tags */}
                <div>
                  <FieldLabel>Tags <span className="text-foreground/35">(comma-separated)</span></FieldLabel>
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-0.5">
                    <TagIcon className="h-3 w-3 text-foreground/40" />
                    <input
                      type="text"
                      placeholder="navigation, sidebar, shadcn"
                      value={tagsRaw}
                      onChange={(e) => setTagsRaw(e.target.value)}
                      className="flex-1 h-8 bg-transparent text-[12px] text-foreground outline-none"
                    />
                  </div>
                </div>

                {/* Tarball */}
                <div>
                  <FieldLabel>Tarball <span className="text-foreground/35">(.tgz)</span></FieldLabel>
                  <input
                    type="file"
                    accept=".tgz,.tar.gz,application/gzip"
                    onChange={(e) => setTarball(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-[11px] text-primary-foreground/60 file:mr-3 file:rounded-md file:border-0 file:bg-blue-500 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-foreground hover:file:bg-blue-400"
                  />
                  {tarball && (
                    <p className="mt-1 text-[10.5px] text-foreground/50">
                      {tarball.name} · {formatBytes(tarball.size)}
                    </p>
                  )}
                  <p className="mt-1 text-[10.5px] text-foreground/40 leading-snug">
                    Run <code className="font-mono">cwa publish &lt;name&gt;</code> or{" "}
                    <code className="font-mono">cwa store &lt;name&gt;</code> from the project
                    folder to produce the <code className="font-mono">.tgz</code>, then upload
                    it here. In Phase 3 the CLI will upload directly.
                  </p>
                </div>

                {/* Cover */}
                <div>
                  <FieldLabel>Cover image <span className="text-foreground/35">(optional)</span></FieldLabel>
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <ImageIcon className="h-3 w-3 text-foreground/40" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                      className="flex-1 text-[11px] text-foreground/60 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-2.5 file:py-1 file:text-[10.5px] file:font-semibold file:text-foreground hover:file:bg-white/15"
                    />
                  </div>
                </div>

                {/* Changelog */}
                <div>
                  <FieldLabel>Changelog <span className="text-foreground/35">(optional)</span></FieldLabel>
                  <textarea
                    placeholder="What changed in this version?"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-foreground outline-none focus:border-blue-400/60 resize-y transition-colors"
                  />
                </div>

                {create.error && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
                    {(create.error as Error).message}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-background/30 px-6 py-3">
              <p className="text-[10.5px] text-foreground/40">
                Published by <span className="text-foreground/75">{username || "?"}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={create.isPending}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 hover:bg-white/5 hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-1.5 text-[12px] font-semibold text-foreground shadow-[0_4px_14px_-2px_hsl(210_90%_55%/0.5)] ring-1 ring-inset ring-white/15 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {create.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Publish</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
      {children}
    </label>
  );
}

function KindPill({
  active, onClick, Icon, label, blurb,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Package;
  label: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all",
        active
          ? "border-blue-400/50 bg-blue-500/10 shadow-[0_0_0_1px_hsl(210_90%_55%/0.35)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        {active && <Check className="h-3 w-3 text-blue-300" />}
      </div>
      <span className="text-[10.5px] leading-snug text-foreground/50">{blurb}</span>
    </button>
  );
}

function CompanyPill({
  active, onClick, label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "border-blue-400/50 bg-blue-500/10 text-primary-foreground shadow-[0_0_0_1px_hsl(210_90%_55%/0.3)]"
          : "border-white/10 bg-white/[0.02] text-foreground/65 hover:border-white/20 hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}
