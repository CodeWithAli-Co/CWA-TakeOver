/**
 * RegistryDetailDrawer — right-side panel shown when a gallery card
 * is clicked. Tabs: Overview, Versions, Install.
 *
 * Overview: description, tags, cover, metadata, publish a new version.
 * Versions: full history with yank/unyank, download, changelog.
 * Install: copy-pastable CLI command + direct download URL.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X, Download, Upload, Terminal, Trash2, Copy, CheckCircle2,
  Clock, User, Tag, Code2, Package, AlertTriangle, FileText, BookOpen, Play, Users,
} from "lucide-react";
import {
  useRegistryVersions,
  usePublishVersion,
  useYankVersion,
  useDeleteRegistryItem,
  registryTarballUrl,
} from "./queries";
import { RegistryCodePreview } from "./RegistryCodePreview";
import { RegistryInstallsView } from "./RegistryInstallsView";
import { RegistryLivePreview } from "./RegistryLivePreview";
import { useTarball } from "./lib/useTarball";
import { findReadme } from "./lib/extractTarball";
import { MiniMarkdown } from "./lib/miniMarkdown";
import type { RegistryItemWithLatest, Bump } from "./types";

interface Props {
  item: RegistryItemWithLatest;
  onClose: () => void;
  username: string;
}

type Tab = "overview" | "code" | "preview" | "versions" | "installs" | "install";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "code",     label: "Code" },
  { key: "preview",  label: "Preview" },
  { key: "versions", label: "Versions" },
  { key: "installs", label: "Installs" },
  { key: "install",  label: "Install" },
];

export function RegistryDetailDrawer({ item, onClose, username }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: versions = [] } = useRegistryVersions(item.id);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[min(560px,calc(100vw-24px))] flex-col border-l border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            {item.coverUrl ? (
              <img
                src={item.coverUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300 ring-1 ring-inset ring-white/10">
                <Package className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-foreground">
                {item.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium">
                  {item.kind}
                </span>
                <span>{item.company}</span>
                {item.latestVersionStr && (
                  <span className="font-mono text-foreground/80">· v{item.latestVersionStr}</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-border/60 px-3 pt-2 overflow-x-auto">
          {TABS.map(({ key: t, label }) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "relative rounded-t-md px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap",
                tab === t
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
              {tab === t && (
                <motion.span
                  layoutId="registry-tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <OverviewTab
              item={item}
              username={username}
              onAskDelete={() => setConfirmDelete(true)}
            />
          )}
          {tab === "code" && (
            <RegistryCodePreview
              storagePath={item.latestStoragePath}
              itemName={item.name}
              version={item.latestVersionStr}
            />
          )}
          {tab === "preview" && (
            <RegistryLivePreview
              storagePath={item.latestStoragePath}
              itemName={item.name}
            />
          )}
          {tab === "versions" && (
            <VersionsTab itemId={item.id} versions={versions} />
          )}
          {tab === "installs" && (
            <RegistryInstallsView
              itemId={item.id}
              itemName={item.name}
              kind={item.kind}
              installCount={item.installCount}
            />
          )}
          {tab === "install" && <InstallTab item={item} />}
        </div>

        {/* Delete confirmation footer */}
        {confirmDelete && (
          <DeleteConfirm
            item={item}
            onCancel={() => setConfirmDelete(false)}
            onDeleted={onClose}
          />
        )}
      </motion.aside>
    </>
  );
}

// ── README sub-block (shown inside Overview) ────────────────
function ReadmePanel({ storagePath }: { storagePath: string | null }) {
  const url = storagePath ? registryTarballUrl(storagePath) : null;
  const { data: entries, isLoading } = useTarball(url);
  const readme = entries ? findReadme(entries) : null;

  if (!storagePath) return null;
  if (isLoading) {
    return (
      <section className="rounded-lg border border-border/60 bg-muted/10 p-4">
        <SectionLabel icon={BookOpen}>README</SectionLabel>
        <p className="mt-1 text-[11.5px] text-muted-foreground">Fetching…</p>
      </section>
    );
  }
  if (!readme || !readme.text) return null;

  return (
    <section className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <SectionLabel icon={BookOpen}>README</SectionLabel>
      <div className="mt-1">
        <MiniMarkdown source={readme.text} />
      </div>
    </section>
  );
}

// ── Overview tab ─────────────────────────────────────────────
function OverviewTab({
  item,
  username,
  onAskDelete,
}: {
  item: RegistryItemWithLatest;
  username: string;
  onAskDelete: () => void;
}) {
  const publish = usePublishVersion();
  const [bump, setBump] = useState<Bump>("patch");
  const [file, setFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState("");

  const doPublish = () => {
    if (!file) return;
    publish.mutate(
      {
        itemId: item.id,
        currentLatest: item.latestVersionStr ?? item.latestVersion ?? null,
        bump,
        tarball: file,
        changelog: changelog.trim() || undefined,
        publishedBy: username,
      },
      {
        onSuccess: () => {
          setFile(null);
          setChangelog("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionLabel icon={Code2}>Description</SectionLabel>
        <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/85">
          {item.description || <em className="italic text-muted-foreground">No description yet.</em>}
        </p>
      </section>

      <ReadmePanel storagePath={item.latestStoragePath} />

      {item.tags.length > 0 && (
        <section>
          <SectionLabel icon={Tag}>Tags</SectionLabel>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-[11.5px]">
        <MetaCell icon={User} label="Created by" value={item.createdBy} />
        <MetaCell icon={Clock} label="Last published" value={item.latestPublishedAt ? relative(item.latestPublishedAt) : "never"} />
        <MetaCell icon={Download} label="Install count" value={String(item.installCount)} />
        <MetaCell icon={Package} label="Tarball size" value={item.latestSizeBytes ? formatBytes(item.latestSizeBytes) : "—"} />
      </section>

      {/* Publish new version */}
      <section className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <SectionLabel icon={Upload}>Publish new version</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {(["patch", "minor", "major"] as Bump[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBump(b)}
                className={[
                  "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  bump === b
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {b}
              </button>
            ))}
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {item.latestVersionStr
                ? `v${item.latestVersionStr} → v${nextBumped(item.latestVersionStr, bump)}`
                : "v1.0.0"}
            </span>
          </div>
          <input
            type="file"
            accept=".tgz,.tar.gz,application/gzip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-primary-foreground hover:file:bg-primary/90 text-[11px] text-muted-foreground"
          />
          <textarea
            placeholder="Changelog (optional)"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-primary/50 resize-y"
          />
          <button
            type="button"
            onClick={doPublish}
            disabled={!file || publish.isPending}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm ring-1 ring-inset ring-white/15 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            {publish.isPending ? "Publishing…" : "Publish"}
          </button>
          {publish.error && (
            <p className="text-[11px] text-red-400">{(publish.error as Error).message}</p>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <SectionLabel icon={AlertTriangle} danger>
          Danger zone
        </SectionLabel>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Delete this item and all versions + stored tarballs. Cannot be undone.
        </p>
        <button
          type="button"
          onClick={onAskDelete}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Delete item
        </button>
      </section>
    </div>
  );
}

// ── Versions tab ─────────────────────────────────────────────
function VersionsTab({
  itemId,
  versions,
}: {
  itemId: string;
  versions: ReturnType<typeof useRegistryVersions>["data"] extends infer T ? T : never;
}) {
  const yank = useYankVersion();
  if (!versions || versions.length === 0) {
    return (
      <div className="py-8 text-center text-[12px] text-muted-foreground">
        No versions yet. Publish your first version from the Overview tab.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {versions.map((v) => (
        <div
          key={v.id}
          className={`rounded-lg border px-3 py-2 ${v.yanked ? "border-amber-500/30 bg-amber-500/5" : "border-border/60 bg-muted/10"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-foreground">
                v{v.version}
              </span>
              {v.yanked && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-amber-300">
                  Yanked
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {relative(v.publishedAt)} by {v.publishedBy}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={registryTarballUrl(v.storagePath)}
                download
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Download tarball"
              >
                <Download className="h-2.5 w-2.5" />
                {v.sizeBytes ? formatBytes(v.sizeBytes) : "tgz"}
              </a>
              <button
                type="button"
                onClick={() => yank.mutate({ versionId: v.id, yanked: !v.yanked })}
                className="rounded-md px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={v.yanked ? "Un-yank this version" : "Yank — hide from installs"}
              >
                {v.yanked ? "Un-yank" : "Yank"}
              </button>
            </div>
          </div>
          {v.changelog && (
            <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-snug text-foreground/80">
              {v.changelog}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Install tab ──────────────────────────────────────────────
function InstallTab({ item }: { item: RegistryItemWithLatest }) {
  const cmd = item.kind === "template"
    ? `cwa create ${item.name}`
    : `cwa add ${item.name}`;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-col gap-4">
      <section>
        <SectionLabel icon={Terminal}>Install via CLI</SectionLabel>
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-2">
          <span className="select-none text-muted-foreground">$</span>
          <code className="flex-1 truncate font-mono text-[12px] text-foreground">{cmd}</code>
          <button
            type="button"
            onClick={copy}
            className={[
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              copied
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
            ].join(" ")}
          >
            {copied ? <><CheckCircle2 className="h-2.5 w-2.5" /> Copied</> : <><Copy className="h-2.5 w-2.5" /> Copy</>}
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          Installs the latest version.
          {" "}
          <span className="font-mono">cwa {item.kind === "template" ? "create" : "add"} {item.name}@&lt;version&gt;</span>{" "}
          pins a specific one.
        </p>
      </section>

      {item.latestStoragePath && (
        <section>
          <SectionLabel icon={Download}>Direct download</SectionLabel>
          <a
            href={registryTarballUrl(item.latestStoragePath)}
            download
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[11.5px] font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-3 w-3" />
            {item.name}-{item.latestVersionStr}.tgz
            {item.latestSizeBytes && (
              <span className="text-muted-foreground">({formatBytes(item.latestSizeBytes)})</span>
            )}
          </a>
        </section>
      )}
    </div>
  );
}

// ── Delete confirmation overlay ──────────────────────────────
function DeleteConfirm({
  item,
  onCancel,
  onDeleted,
}: {
  item: RegistryItemWithLatest;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const del = useDeleteRegistryItem();
  return (
    <div className="border-t border-red-500/40 bg-red-500/10 px-5 py-3">
      <p className="text-[12px] text-red-200">
        Delete <strong>{item.name}</strong> and all {item.installCount > 0 ? `${item.installCount} installs will remain tracked but` : ""} versions?
      </p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-[11.5px] text-foreground/70 hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            del.mutate(item.id, {
              onSuccess: () => onDeleted(),
            })
          }
          disabled={del.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1 text-[11.5px] font-semibold text-primary-foreground hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          {del.isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Small reusable bits ──────────────────────────────────────
function SectionLabel({
  icon: Icon,
  children,
  danger,
}: {
  icon: typeof Package;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <h4
      className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
        danger ? "text-red-300" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </h4>
  );
}

function MetaCell({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
      <span className="truncate font-medium text-foreground/90">{value}</span>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────
function nextBumped(v: string, bump: Bump): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return "1.0.0";
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (bump === "major") return `${a + 1}.0.0`;
  if (bump === "minor") return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}
