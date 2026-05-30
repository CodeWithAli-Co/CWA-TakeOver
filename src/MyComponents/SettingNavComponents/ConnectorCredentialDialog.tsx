/**
 * ConnectorCredentialDialog.tsx — generic credential-entry modal.
 *
 * Renders fields driven by `connectorSchemas.getConnectorSchema(kind)`,
 * submits the collected JSON to `useUpsertConnector`, and closes
 * on success. Used by the Connectors settings page when the
 * operator clicks Connect (or Edit) on any catalog tile.
 *
 * Visual language matches the EditProjectDialog: rounded-2xl
 * centered modal with backdrop, primary-fill Save button +
 * outlined Cancel, password fields with eye toggle.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Plug,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  getConnectorSchema,
  type ConnectorField,
} from "./connectorSchemas";
import {
  useUpsertConnector,
  type Connector,
} from "@/stores/connectors";
import { ActiveUser } from "@/stores/query";
import {
  verifyConnector,
  type VerifyResult,
} from "./connectorVerify";

interface Props {
  /** Catalog id (kind) of the connector being wired. */
  kind: string;
  /** Display name from the catalog — used in the modal title. */
  name: string;
  /** Existing row, if editing. `null` for fresh connect. */
  existing: Connector | null;
  onClose: () => void;
  /** Called after a successful save. The page typically does
   *  nothing here because the TanStack cache invalidates and the
   *  list refetches on its own. */
  onSaved?: () => void;
}

export function ConnectorCredentialDialog({
  kind,
  name,
  existing,
  onClose,
  onSaved,
}: Props) {
  const schema = getConnectorSchema(kind);
  const upsert = useUpsertConnector();
  const { data: me } = ActiveUser();
  const username = (me as any)?.[0]?.username ?? null;

  // Local form state — one slot per field key. Seeded from
  // existing credentials if editing.
  const initial = useMemo<Record<string, string>>(() => {
    if (!schema) return {};
    const out: Record<string, string> = {};
    for (const f of schema.fields) {
      const v = existing?.credentials?.[f.key];
      out[f.key] = typeof v === "string" ? v : "";
    }
    return out;
  }, [schema, existing]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  // Verification state — kept separate from upsert so the UI can
  // show "verifying… → verified → saving…" as three distinct
  // phases. A successful verify is cleared whenever the user
  // edits a field (creds may now be different).
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => setValues(initial), [initial]);

  // Wipe a stale verification when any field changes.
  function updateField(key: string, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (verifyResult) setVerifyResult(null);
  }

  // Validate — all required fields filled AND pattern matches.
  const canSubmit = useMemo(() => {
    if (!schema) return false;
    for (const f of schema.fields) {
      const required = f.required !== false;
      const v = values[f.key]?.trim() ?? "";
      if (required && v.length === 0) return false;
      if (v.length > 0 && f.pattern && !f.pattern.test(v)) return false;
    }
    return !upsert.isPending && !verifying;
  }, [schema, values, upsert.isPending, verifying]);

  async function submit() {
    if (!canSubmit || !schema) return;
    setError(null);

    // Trim every value before sending. Whitespace in API keys is
    // a common copy-paste failure mode.
    const credentials: Record<string, string> = {};
    for (const f of schema.fields) credentials[f.key] = values[f.key]!.trim();

    // ── Phase 1: verify against the live API ────────────────────
    setVerifying(true);
    const verdict = await verifyConnector(kind, credentials);
    setVerifying(false);
    setVerifyResult(verdict);
    if (!verdict.ok) {
      // Block the save. The user has to fix the credentials.
      setError(verdict.error);
      return;
    }

    // ── Phase 2: persist ───────────────────────────────────────
    try {
      await upsert.mutateAsync({
        kind,
        credentials,
        createdBy: username,
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save connector.");
    }
  }

  if (!schema) {
    return (
      <Backdrop onClose={onClose}>
        <Panel onClose={onClose} title={`Connect ${name}`}>
          <p className="text-[12.5px] text-text-tertiary">
            No setup form is defined for this connector yet.
          </p>
        </Panel>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <Panel onClose={onClose} title={`Connect ${name}`} subtitle={schema.blurb}>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {schema.fields.map((f) => (
            <Field
              key={f.key}
              field={f}
              value={values[f.key] ?? ""}
              onChange={(v) => updateField(f.key, v)}
              revealed={!!reveal[f.key]}
              onToggleReveal={() =>
                setReveal((s) => ({ ...s, [f.key]: !s[f.key] }))
              }
            />
          ))}

          {schema.disclaimer && (
            <div className="text-[11.5px] text-warning bg-warning/[0.08] border border-warning/30 rounded-lg px-3 py-2">
              {schema.disclaimer}
            </div>
          )}

          {/* Live verify banner — shows the result of the last
           *  verification attempt (success in green, error in red,
           *  format-only in warning yellow). Cleared whenever the
           *  user edits a field. */}
          <AnimatePresence mode="wait">
            {verifying && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[12px] text-text-secondary bg-foreground/[0.04] border border-border-soft rounded-lg px-3 py-2"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Pinging the service…
              </motion.div>
            )}
            {!verifying && verifyResult?.ok && verifyResult.degraded && (
              <motion.div
                key="degraded"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-[12px] text-warning bg-warning/[0.08] border border-warning/30 rounded-lg px-3 py-2"
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{verifyResult.summary}</span>
              </motion.div>
            )}
            {!verifying && verifyResult?.ok && !verifyResult.degraded && (
              <motion.div
                key="verified"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-[12px] text-success bg-success/[0.08] border border-success/30 rounded-lg px-3 py-2"
              >
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{verifyResult.summary}</span>
              </motion.div>
            )}
            {!verifying && verifyResult && !verifyResult.ok && (
              <motion.div
                key="rejected"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-[12px] text-destructive bg-destructive/[0.08] border border-destructive/30 rounded-lg px-3 py-2"
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{verifyResult.error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {error && !verifyResult && (
            <p className="text-[11.5px] text-destructive">{error}</p>
          )}

          <a
            href={schema.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink size={11} strokeWidth={2.4} />
            Get your credentials
          </a>
        </div>

        <footer className="px-6 py-4 border-t border-border-soft flex items-center justify-between gap-2">
          <p className="text-[10.5px] text-text-tertiary/80 italic">
            Credentials stored encrypted at rest (Supabase RLS).
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-full text-[12px] font-semibold text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 h-8 px-4 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying || upsert.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plug size={11} strokeWidth={2.4} />
              )}
              {verifying
                ? "Verifying…"
                : upsert.isPending
                  ? "Saving…"
                  : existing
                    ? "Save changes"
                    : "Connect"}
            </button>
          </div>
        </footer>
      </Panel>
    </Backdrop>
  );
}

// ─── Layout primitives ───────────────────────────────────────────

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

function Panel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.99 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-lg rounded-2xl bg-background border border-border-soft shadow-2xl overflow-hidden"
    >
      <header className="px-6 pt-5 pb-4 border-b border-border-soft flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      {children}
    </motion.div>
  );
}

function Field({
  field,
  value,
  onChange,
  revealed,
  onToggleReveal,
}: {
  field: ConnectorField;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const isSecret = field.type === "password";
  const inputType = isSecret && !revealed ? "password" : "text";

  return (
    <div>
      <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
        {field.label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full px-3 py-2 bg-foreground/[0.03] border border-border-soft rounded-lg text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors ${isSecret ? "pr-9 font-mono" : ""}`}
        />
        {isSecret && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-text-tertiary hover:text-foreground transition-colors"
            aria-label={revealed ? "Hide" : "Show"}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      {field.hint && (
        <p className="text-[10.5px] text-text-tertiary mt-1 leading-relaxed">
          {field.hint}
        </p>
      )}
    </div>
  );
}
