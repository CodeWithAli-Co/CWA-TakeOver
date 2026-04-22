/**
 * HiringActions.tsx — Panel that appears alongside a saved offer
 * showing the full hiring flow beyond the letter itself:
 *   · Copy the candidate's accept link
 *   · Send the offer via email (proxied through cwa_takeover website →
 *     Resend; Redis bearer + timestamp for auth)
 *   · Generate + export companion agreements (ICA, Employment, NDA, IP)
 *   · Convert an accepted offer into an app_users employee record
 */

import { useEffect, useState } from "react";
import {
  Link2, Mail, FilePlus2, UserPlus, Loader2, Check, Copy,
  AlertTriangle, Download, Sparkles, X, ShieldCheck, FileSignature,
  PenLine, Receipt, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import supabase from "@/MyComponents/supabase";
import { pdf } from "@react-pdf/renderer";
import { OfferLetterPDF } from "./OfferLetterPDF";
import {
  draftCompanion, DOC_META, type CompanionDocType,
} from "./draftCompanion";
import type { OfferInput } from "./draftOffer";
import { sendOfferLetterEmail, blobToBase64 as pdfBlobToBase64 } from "./sendEmailViaTakeover";

interface CurrentOffer {
  id: string;
  status: string;
  acceptance_token: string;
  candidate_email?: string | null;
  candidate_name?: string | null;
  position_title?: string | null;
  employer_legal_name?: string | null;
  converted_to_user_id?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  emailed_at?: string | null;
  candidate_signature_name?: string | null;
  candidate_signature_at?: string | null;
  /** Employer-side counter-signature. Captured in Takeover BEFORE
   *  the offer is emailed. If null, the Send row is gated. */
  employer_signature_name?: string | null;
  employer_signature_at?: string | null;
}

interface Props {
  /** The offer as it lives in the DB (after save). null = no saved offer. */
  current: CurrentOffer | null;
  /** The form state — used for companion doc generation + email payload. */
  form: OfferInput;
  /** The generated offer body — used for PDF export and email attachment. */
  generatedBody: string;
  /** Callback after a mutation that changes offer row state, so parent can refetch. */
  onMutated: () => void;
}

const BRAND_LOGO: Record<string, string> = {
  codeWithAli: "/codewithali_logo.png",
  simplicity: "/simplicity_logo.png",
};

export function HiringActions({ current, form, generatedBody, onMutated }: Props) {
  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-[11.5px] text-muted-foreground">
        Save the draft first to unlock send / convert / companion docs.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <SignatureRecordRow current={current} />
      <AcceptLinkRow current={current} />
      <CompanionDocsRow current={current} form={form} />
      {/* Counter-sign gates send — has to come AFTER companion docs
          because it stamps them too. */}
      <EmployerSignRow current={current} form={form} onMutated={onMutated} />
      <SendEmailRow
        current={current}
        form={form}
        generatedBody={generatedBody}
        onMutated={onMutated}
      />
      <ConvertRow current={current} form={form} onMutated={onMutated} />
    </div>
  );
}

// ── 1. Copy the public accept link ─────────────────────────────────

function AcceptLinkRow({ current }: { current: CurrentOffer }) {
  const [copied, setCopied] = useState(false);
  const url = buildAcceptUrl(current.acceptance_token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };
  return (
    <Row
      icon={Link2}
      title="Candidate accept link"
      subtitle="Token-secured URL — share only with the candidate."
    >
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted/30 px-2 py-1.5 font-mono text-[11px] text-foreground/80">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium hover:border-primary/40"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Row>
  );
}

function buildAcceptUrl(token: string): string {
  // The accept page is a PUBLIC web page on cwa_takeover, not a
  // route inside Takeover desktop itself. Candidates don't have
  // Takeover installed — they click the email link in their own
  // browser, which needs to resolve to a real URL.
  //
  // Reads VITE_TAKEOVER_SITE_URL (e.g., https://takeover.codewithali.com)
  // — same env var used by sendEmailViaTakeover. Falls back to
  // window.location.origin in dev if the env isn't set, so the
  // "copy accept link" button still gives a usable in-app URL.
  const siteUrl = import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined;
  const base = siteUrl?.replace(/\/+$/, "")
    ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/offer/accept/${token}`;
}

function buildReceiptUrl(token: string): string {
  // Same host as the accept page, different route. The receipt page
  // is a read-only polished view of the signed offer + timestamps
  // that serves as shareable proof of acceptance for both the
  // candidate and the employer.
  const siteUrl = import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined;
  const base = siteUrl?.replace(/\/+$/, "")
    ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/offer/receipt/${token}`;
}

// ── 2. Send the offer by email ─────────────────────────────────────

function SendEmailRow({
  current, form, generatedBody, onMutated,
}: {
  current: CurrentOffer;
  form: OfferInput;
  generatedBody: string;
  onMutated: () => void;
}) {
  const [email, setEmail] = useState(current.candidate_email ?? "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const sent = !!current.emailed_at;
  // Counter-signature gate: can't send an offer the CEO hasn't
  // signed. The button stays disabled and we show a clear message
  // pointing at the Sign offer row above.
  const counterSigned = !!current.employer_signature_at
    && !!current.employer_signature_name;

  const send = async () => {
    if (!counterSigned) {
      setIsError(true);
      setResult("Counter-sign the offer above before sending.");
      return;
    }
    if (!email || !email.includes("@")) {
      setIsError(true);
      setResult("Enter a valid email.");
      return;
    }
    if (!generatedBody) {
      setIsError(true);
      setResult("Generate the offer body first.");
      return;
    }
    setSending(true);
    setIsError(false);
    setResult(null);

    try {
      // 1. Render the PDF once; base64-encode for the email attachment.
      //    Pass the counter-signature fields so the PDF shows it as
      //    already signed on the employer side — candidate gets a
      //    dual-signed artifact.
      const pdfBlob = await pdf(
        <OfferLetterPDF
          brand={form.brand}
          employerLegalName={form.employerLegalName}
          employerAddress={form.employerAddress}
          employerSignerName={form.employerSignerName}
          employerSignerTitle={form.employerSignerTitle}
          candidateName={form.candidateName}
          body={generatedBody}
          employerSignatureName={current.employer_signature_name ?? undefined}
          employerSignatureAt={current.employer_signature_at ?? undefined}
        />,
      ).toBlob();
      const pdfBase64 = await pdfBlobToBase64(pdfBlob);

      // 2. Pick the from-address based on brand. Both must be verified
      //    senders in Resend before they'll actually deliver.
      //    OfferInput.brand uses "simplicity"; the email layer's Brand
      //    uses "simplicityFunds" — map between them here.
      const localBrand = form.brand ?? "codeWithAli";
      const emailBrand: "codeWithAli" | "simplicityFunds" =
        localBrand === "simplicity" ? "simplicityFunds" : "codeWithAli";
      const fromAddress =
        emailBrand === "simplicityFunds"
          ? { name: "Simplicity Funds", email: "hire@simplicityfunds.com" }
          : { name: "CodeWithAli",      email: "hire@codewithali.com"     };

      // 3. Build the prose body — the React Email template on the
      //    server splits this into paragraphs automatically. We pass
      //    a short personal note here; the template adds the
      //    greeting, position line, and accept-button around it.
      const proseBody = [
        `The offer letter is attached. Take your time reviewing —`,
        `it covers compensation, start date, and the role expectations.`,
      ].join(" ");

      // 4. Send via the cwa_takeover website proxy. Server renders
      //    the React Email template; we just ship structured data.
      const acceptUrl = buildAcceptUrl(current.acceptance_token);
      const result = await sendOfferLetterEmail({
        from: fromAddress,
        to: email,
        subject: `Your offer from ${form.employerLegalName}`,
        body: proseBody,
        candidateName: form.candidateName,
        positionTitle: form.positionTitle,
        employerLegalName: form.employerLegalName,
        brand: emailBrand,
        acceptUrl,
        attachment: {
          filename: `Offer letter - ${form.candidateName}.pdf`,
          contentBase64: pdfBase64,
          contentType: "application/pdf",
        },
      });

      if (!result.ok) {
        // Surface provider-specific reason when available — usually
        // "domain not verified", "recipient blocked", etc. from Resend.
        const detail = result.providerCode
          ? `${result.error} (${result.providerCode})`
          : result.error ?? "Unknown send failure";
        throw new Error(detail);
      }

      // 5. Update the offer row to record emailed_at + candidate_email.
      await supabase
        .from("offer_letters")
        .update({
          candidate_email: email,
          emailed_at: new Date().toISOString(),
          status: "sent",
        })
        .eq("id", current.id);

      setResult(`Sent to ${email}.`);
      onMutated();
    } catch (err) {
      setIsError(true);
      const msg = err instanceof Error ? err.message : String(err);
      setResult(
        msg.includes("VITE_TAKEOVER_SITE_URL") || msg.includes("VITE_UPSTASH")
          ? `${msg} See docs/EMAIL_SEND_SETUP.md for the env-var setup.`
          : `Send failed: ${msg}`,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Row
      icon={Mail}
      title="Email to candidate"
      subtitle={
        sent
          ? `Sent ${new Date(current.emailed_at!).toLocaleString()}.`
          : !counterSigned
            ? "Counter-sign the offer above, then you can email it."
            : "Sends the PDF + the accept-link in a branded email."
      }
    >
      <div className="flex items-center gap-2">
        <input
          type="email"
          placeholder="candidate@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!counterSigned && !sent}
          className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || (!counterSigned && !sent)}
          className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          title={!counterSigned && !sent ? "Counter-sign first" : undefined}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
          {sent ? "Resend" : "Send"}
        </button>
      </div>
      {result && (
        <p
          className={`mt-2 rounded-md border px-2 py-1.5 text-[10.5px] ${
            isError
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {result}
        </p>
      )}
    </Row>
  );
}

// ── 3. Companion docs (ICA / Employment / NDA / IP) ────────────────

interface DocRow {
  id: string;
  doc_type: CompanionDocType;
  body: string | null;
  created_at: string;
}

function CompanionDocsRow({
  current, form,
}: {
  current: CurrentOffer;
  form: OfferInput;
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<CompanionDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DocRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("hire_documents")
        .select("id, doc_type, body, created_at")
        .eq("offer_letter_id", current.id)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setDocs((data ?? []) as DocRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [current.id, generating]);

  const suggested: CompanionDocType[] =
    form.employmentType === "1099_contractor"
      ? ["ica", "nda", "ip_assignment"]
      : ["employment_agreement", "nda", "ip_assignment"];

  const generate = async (doc: CompanionDocType) => {
    setGenerating(doc);
    setError(null);
    const res = await draftCompanion(form, doc);
    if (!res.ok) {
      setError(res.error);
      setGenerating(null);
      return;
    }
    const { error } = await supabase.from("hire_documents").insert({
      offer_letter_id: current.id,
      created_by: form.employerSignerName || "system",
      doc_type: doc,
      body: res.text,
      brand: form.brand ?? "codeWithAli",
    });
    setGenerating(null);
    if (error) {
      setError(`Save failed: ${error.message}`);
      return;
    }
  };

  return (
    <Row
      icon={FilePlus2}
      title="Companion documents"
      subtitle="Generate the contracts that travel with the offer letter."
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((d) => {
            const existing = docs.find((x) => x.doc_type === d);
            const isGen = generating === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => (existing ? setViewing(existing) : generate(d))}
                disabled={isGen}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  existing
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-border/60 text-foreground hover:border-primary/40"
                }`}
              >
                {isGen ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : existing ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {DOC_META[d].short}
                {existing && <span className="opacity-60 ml-1">— open</span>}
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="text-[10.5px] text-muted-foreground">loading prior docs…</p>
        )}
        {error && (
          <p className="text-[10.5px] text-red-300">{error}</p>
        )}
      </div>

      <AnimatePresence>
        {viewing && (
          <DocPreviewModal
            doc={viewing}
            form={form}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </Row>
  );
}

function DocPreviewModal({
  doc, form, onClose,
}: {
  doc: DocRow;
  form: OfferInput;
  onClose: () => void;
}) {
  const [body, setBody] = useState(doc.body ?? "");
  const [saving, setSaving] = useState(false);

  const saveEdit = async () => {
    setSaving(true);
    await supabase.from("hire_documents").update({ body }).eq("id", doc.id);
    setSaving(false);
  };

  const exportPdf = async () => {
    const blob = await pdf(
      <OfferLetterPDF
        brand={form.brand}
        employerLegalName={form.employerLegalName}
        employerAddress={form.employerAddress}
        employerSignerName={form.employerSignerName}
        employerSignerTitle={form.employerSignerTitle}
        candidateName={form.candidateName}
        body={body}
      />,
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${DOC_META[doc.doc_type].title} - ${form.candidateName || "candidate"}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[4vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -10, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -10, scale: 0.98 }}
        className="flex w-full max-w-[880px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
              {DOC_META[doc.doc_type].short}
            </div>
            <h3 className="text-[14px] font-semibold">{DOC_META[doc.doc_type].title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="flex h-8 items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 text-[11px] font-semibold hover:border-primary/40 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save edits
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => setBody(e.currentTarget.textContent || "")}
          className="flex-1 overflow-y-auto bg-background px-8 py-6 font-serif text-[13px] leading-[1.62] text-foreground/95 whitespace-pre-wrap focus:outline-none"
        >
          {body}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 4. Convert accepted offer → employee ───────────────────────────

/** Spawn an onboarding_instance + copy template items for a newly
 *  converted hire. Best-effort: errors here do NOT fail the convert,
 *  they just surface as a soft note. Returns a human-readable status
 *  string the caller can append to the success message. */
async function spawnOnboarding(
  offerId: string,
  employeeUserId: string | null,
  form: OfferInput,
): Promise<{ ok: boolean; note: string }> {
  try {
    // OfferInput.brand uses "simplicity"; DB schema uses "simplicityFunds".
    const dbBrand = form.brand === "simplicity" ? "simplicityFunds" : "codeWithAli";

    // Pick the template matching this hire's (brand, employment_type).
    const tpl = await supabase
      .from("onboarding_templates")
      .select("id, item_list")
      .eq("brand", dbBrand)
      .eq("employment_type", form.employmentType)
      .maybeSingle();

    if (tpl.error) {
      // Table likely missing — migration hasn't been run yet.
      if ((tpl.error as any).code === "42P01" ||
          (tpl.error.message || "").toLowerCase().includes("does not exist")) {
        return {
          ok: false,
          note: "Onboarding not spawned — run migrations/onboarding_init.sql first.",
        };
      }
      return { ok: false, note: `Onboarding template lookup failed: ${tpl.error.message}` };
    }
    if (!tpl.data) {
      return {
        ok: false,
        note: `No onboarding template for ${dbBrand} / ${form.employmentType}. Create one in the Onboarding page.`,
      };
    }

    // Create the instance.
    const instanceRes = await supabase
      .from("onboarding_instances")
      .insert({
        offer_letter_id: offerId,
        employee_user_id: employeeUserId,
        template_id: (tpl.data as any).id,
        status: "active",
      })
      .select("id")
      .single();
    if (instanceRes.error) {
      return { ok: false, note: `Could not start onboarding: ${instanceRes.error.message}` };
    }

    // Copy template items into concrete onboarding_items rows.
    const itemList = (tpl.data as any).item_list as Array<{
      title: string;
      description?: string;
      owner: "employer" | "employee";
      position?: number;
    }>;
    if (Array.isArray(itemList) && itemList.length > 0) {
      const itemsRes = await supabase.from("onboarding_items").insert(
        itemList.map((it, i) => ({
          instance_id: (instanceRes.data as any).id,
          title: it.title,
          description: it.description ?? null,
          owner: it.owner,
          position: it.position ?? i + 1,
          status: "pending",
        })),
      );
      if (itemsRes.error) {
        return {
          ok: false,
          note: `Onboarding started but couldn't copy tasks: ${itemsRes.error.message}`,
        };
      }
    }

    return { ok: true, note: `Onboarding checklist started (${itemList.length} items).` };
  } catch (e) {
    return {
      ok: false,
      note: `Onboarding spawn failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function ConvertRow({
  current, form, onMutated,
}: {
  current: CurrentOffer;
  form: OfferInput;
  onMutated: () => void;
}) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const canConvert =
    current.status === "accepted" && !current.converted_to_user_id;

  const convert = async () => {
    setConverting(true);
    setError(null);
    setSuccess(false);
    setSuccessMsg("");

    // Role mapping — best-effort; operator can change it in app_users later.
    const role =
      form.employmentType === "1099_contractor"
        ? "Contractor"
        : form.employmentType === "intern"
          ? "Intern"
          : "Member";

    const company =
      form.brand === "simplicity" ? "simplicity" : "CodeWithAli";

    const baseUsername = slugify(form.candidateName);

    // ── 1. Check if an app_users row already exists with this username.
    //    The username column has a UNIQUE constraint, so re-converting
    //    the same candidate (or one who already had an account) would
    //    otherwise crash with `app_users_username_key`. If we find a
    //    match, we just relink the offer to the existing user.
    const existing = await supabase
      .from("app_users")
      .select("id, supa_id, username")
      .eq("username", baseUsername)
      .maybeSingle();

    if (existing.data) {
      // offer_letters.converted_to_user_id is a UUID column. app_users
      // has TWO id-like fields: `id` (integer PK) and `supa_id` (UUID
      // from Supabase auth). Always prefer supa_id — writing the int
      // `id` into the UUID FK throws "invalid input syntax for type uuid".
      const row = existing.data as any;
      const existingId = row.supa_id ?? null;
      if (!existingId) {
        setError(
          `Found existing employee "${baseUsername}" but they have no supa_id (UUID) to link the offer to. Open them in the Employees page and assign a Supabase auth id first.`,
        );
        setConverting(false);
        return;
      }
      const upd = await supabase
        .from("offer_letters")
        .update({ converted_to_user_id: existingId })
        .eq("id", current.id);
      if (upd.error) {
        setError(`Could not link offer to existing user: ${upd.error.message}`);
        setConverting(false);
        return;
      }
      // Spawn onboarding checklist for the existing employee too —
      // even if they already have an app_users row, THIS specific
      // hire event gets its own onboarding instance so the task
      // list is scoped to this offer / role change.
      const onb = await spawnOnboarding(current.id, existingId, form);
      setSuccess(true);
      setSuccessMsg(
        `Linked to existing employee "${baseUsername}". ${onb.note}`,
      );
      setConverting(false);
      onMutated();
      return;
    }

    // ── 2. No existing row — create a fresh app_users record.
    //    We still pick a unique username-on-collision just in case two
    //    candidates share a name (Jane Smith #2 becomes jane-smith-2).
    let username = baseUsername;
    let suffix = 2;
    // Small safety loop — bail after 20 attempts rather than hammer the
    // DB. In practice we break on the first pass; the select above
    // already cleared the most common case.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const probe = await supabase
        .from("app_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!probe.data) break;
      if (suffix > 20) break;
      username = `${baseUsername}-${suffix++}`;
    }

    // Unique avatar URL per user — DiceBear generates deterministic
    // SVGs from a seed, so every username gets its own avatar. This
    // sidesteps the UNIQUE constraint on app_users.avatar that was
    // crashing the insert whenever the DB default fired twice.
    const avatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(username)}`;

    const payload: Record<string, any> = {
      username,
      role,
      company,
      avatar,
      // Most installs of app_users have these columns but not all.
      // Supabase will reject unknowns — we attempt, then fall back.
    };

    let res = await supabase.from("app_users").insert(payload).select().single();
    if (res.error) {
      // Fallback: minimal payload — still include the unique avatar
      // so the constraint doesn't bite on the retry either.
      res = await supabase
        .from("app_users")
        .insert({ username: payload.username, role, avatar })
        .select()
        .single();
    }
    if (res.error) {
      setError(`Could not create employee row: ${res.error.message}`);
      setConverting(false);
      return;
    }
    // Prefer supa_id (UUID) — same reason as the link-existing branch.
    // If the freshly-inserted row doesn't yet have a supa_id (some
    // app_users defaults set it via trigger, some don't), we skip the
    // link update rather than blow up with "invalid input syntax for
    // type uuid". The employee row is still created; operator can
    // link the offer manually later.
    const freshRow = res.data as any;
    const userId = freshRow?.supa_id ?? null;
    if (userId) {
      const upd = await supabase
        .from("offer_letters")
        .update({ converted_to_user_id: userId })
        .eq("id", current.id);
      if (upd.error) {
        setError(
          `Employee row created but couldn't link offer: ${upd.error.message}`,
        );
        setConverting(false);
        return;
      }
    }
    // Spawn onboarding checklist for the newly-created employee.
    // Best-effort — failures here surface as a note but don't
    // undo the employee record or the offer link.
    const onb = await spawnOnboarding(current.id, userId, form);
    setSuccess(true);
    setSuccessMsg(
      `Created employee "${username}". ${onb.note}`,
    );
    setConverting(false);
    onMutated();
  };

  return (
    <Row
      icon={UserPlus}
      title="Convert to employee"
      subtitle={
        current.converted_to_user_id
          ? "Already converted — see app_users."
          : current.status === "accepted"
            ? "Create an app_users record with role + company pre-filled."
            : "Available once the offer status is 'accepted'."
      }
    >
      <button
        type="button"
        onClick={convert}
        disabled={!canConvert || converting}
        className="flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 shadow-sm"
      >
        {converting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        {current.converted_to_user_id ? "Already converted" : "Create employee record"}
      </button>
      {success && (
        <p className="mt-2 text-[10.5px] text-emerald-300">
          {successMsg || "Done."}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[10.5px] text-red-300">{error}</p>
      )}
    </Row>
  );
}

// ── Employer counter-signature ─────────────────────────────────────
// Captures the CEO-side typed signature BEFORE the offer can be
// emailed. Same ESIGN pattern as the candidate accept page: type
// your legal name exactly, tick the consent box, click sign.
//
// Clicking sign:
//   1. Updates offer_letters with employer_signature_name / _at.
//   2. Stamps every existing hire_documents row for this offer
//      with the same signature — so companion agreements go out
//      dual-signed too, not just the main offer letter.
//
// If any companion doc is generated AFTER counter-signing, it won't
// carry the sig automatically. The row shows a "re-sign to include
// new docs" warning so the CEO knows to click sign again.

function EmployerSignRow({
  current, form, onMutated,
}: {
  current: CurrentOffer;
  form: OfferInput;
  onMutated: () => void;
}) {
  const [typedName, setTypedName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Check for unsigned companion docs so we can show the re-sign hint.
  const [unsignedDocCount, setUnsignedDocCount] = useState(0);

  const alreadySigned = !!current.employer_signature_at
    && !!current.employer_signature_name;
  const sent = !!current.emailed_at;

  // The legal name we expect the operator to type. Falls back to
  // the brand legal name if a specific signer name isn't set.
  const expectedName = form.employerSignerName
    || form.employerLegalName
    || "CEO";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!alreadySigned) {
        setUnsignedDocCount(0);
        return;
      }
      // Count companion docs that exist but aren't stamped with the
      // employer sig yet — means we signed, then generated more docs.
      const { count } = await supabase
        .from("hire_documents")
        .select("id", { count: "exact", head: true })
        .eq("offer_letter_id", current.id)
        .is("employer_signature_at", null);
      if (!cancelled) setUnsignedDocCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [current.id, current.employer_signature_at, alreadySigned]);

  const nameMatches =
    typedName.trim().toLowerCase() === expectedName.trim().toLowerCase();
  const canSign = nameMatches && confirmed && !signing;

  const sign = async () => {
    if (!canSign) return;
    setSigning(true);
    setError(null);
    const now = new Date().toISOString();
    const sigName = typedName.trim();

    try {
      // 1. Stamp the offer row.
      const offerUpd = await supabase
        .from("offer_letters")
        .update({
          employer_signature_name: sigName,
          employer_signature_at: now,
        })
        .eq("id", current.id);
      if (offerUpd.error) throw new Error(offerUpd.error.message);

      // 2. Stamp every existing hire_document row for this offer.
      //    We overwrite — if they're re-signing to pick up new docs,
      //    re-stamping the old ones with today's timestamp is the
      //    right move (single consistent signature event).
      const docsUpd = await supabase
        .from("hire_documents")
        .update({
          employer_signature_name: sigName,
          employer_signature_at: now,
        })
        .eq("offer_letter_id", current.id);
      if (docsUpd.error) {
        // Non-fatal — offer is signed, companions might not have
        // the columns yet (pre-migration schema). Show a soft warn.
        setError(
          `Offer counter-signed, but couldn't stamp companion docs: ${docsUpd.error.message}. Run migrations/offer_letters_counter_signature.sql.`,
        );
      }

      setTypedName("");
      setConfirmed(false);
      onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
    }
  };

  const clearSignature = async () => {
    // Escape hatch — wipes the counter-sig if something's wrong.
    // Also wipes it from companion docs so they don't diverge.
    if (!confirm("Clear the counter-signature on the offer and all companion docs? You'll need to sign again before sending.")) return;
    setSigning(true);
    try {
      await supabase
        .from("offer_letters")
        .update({
          employer_signature_name: null,
          employer_signature_at: null,
        })
        .eq("id", current.id);
      await supabase
        .from("hire_documents")
        .update({
          employer_signature_name: null,
          employer_signature_at: null,
        })
        .eq("offer_letter_id", current.id);
      onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
    }
  };

  return (
    <Row
      icon={PenLine}
      title="Counter-sign the offer"
      subtitle={
        alreadySigned
          ? `Signed ${new Date(current.employer_signature_at!).toLocaleString()} by ${current.employer_signature_name}.`
          : "Type your legal name to counter-sign. Applies to the offer + every companion agreement."
      }
    >
      {alreadySigned ? (
        <div className="space-y-2">
          {/* Signed-state display */}
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-[10.5px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
              Counter-signed
            </p>
            <p
              className="text-[14px] text-foreground italic"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              /s/ {current.employer_signature_name}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              {new Date(current.employer_signature_at!).toLocaleString()}
            </p>
          </div>

          {/* Re-sign warning if new docs have been generated since. */}
          {unsignedDocCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-amber-200">
                  {unsignedDocCount} companion doc{unsignedDocCount === 1 ? "" : "s"} generated after you signed.
                  Clear the signature and re-sign to include them in the counter-signature record.
                </p>
              </div>
            </div>
          )}

          {!sent && (
            <button
              type="button"
              onClick={clearSignature}
              disabled={signing}
              className="text-[10.5px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              Clear signature (won't send until re-signed)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Type your legal name exactly ({expectedName})
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={expectedName}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span className="text-[11px] text-muted-foreground leading-snug">
              I agree to the terms of this offer and every companion
              document generated for it. My typed name above is my
              electronic signature under the ESIGN Act.
            </span>
          </label>

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={sign}
            disabled={!canSign}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PenLine className="h-3 w-3" />
            )}
            Sign offer + companion docs
          </button>
        </div>
      )}
    </Row>
  );
}

// ── Signature / proof-of-acceptance record ─────────────────────────
// Pulls the full signing trail for an offer so the CEO can verify what
// the candidate actually agreed to. Fetches hire_documents for the
// offer on mount to include any ICA / NDA / IP signings.

interface HireDocRecord {
  id: string;
  doc_type: string;
  status: string;
  signed_name: string | null;
  signed_at: string | null;
  sign_order: number | null;
}

function SignatureRecordRow({ current }: { current: CurrentOffer }) {
  const [docs, setDocs] = useState<HireDocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Best-effort: if the signature columns don't exist yet, fall back.
      const primary = await supabase
        .from("hire_documents")
        .select("id, doc_type, status, signed_name, signed_at, sign_order")
        .eq("offer_letter_id", current.id)
        .order("sign_order", { ascending: true });
      if (cancelled) return;
      if (primary.error) {
        const basic = await supabase
          .from("hire_documents")
          .select("id, doc_type")
          .eq("offer_letter_id", current.id);
        setDocs(
          (basic.data ?? []).map((d: any) => ({
            id: d.id,
            doc_type: d.doc_type,
            status: "pending_signature",
            signed_name: null,
            signed_at: null,
            sign_order: null,
          })),
        );
      } else {
        setDocs((primary.data ?? []) as HireDocRecord[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [current.id]);

  const offerSigned = current.status === "accepted";
  const offerDeclined = current.status === "declined";
  const offerSentOnly = current.status === "sent";
  const signedDocs = docs.filter((d) => d.status === "signed");
  const pendingDocs = docs.filter((d) => d.status !== "signed" && d.status !== "waived");

  // Nothing to show for a fresh draft.
  if (!offerSigned && !offerDeclined && !offerSentOnly && docs.length === 0 && !loading) {
    return null;
  }

  const stateColor = offerSigned
    ? "text-emerald-400"
    : offerDeclined
      ? "text-red-400"
      : "text-amber-400";

  const stateLabel = offerSigned
    ? "Signed & accepted"
    : offerDeclined
      ? "Declined"
      : offerSentOnly
        ? "Sent — awaiting response"
        : "In progress";

  // Build a plain-text audit record the CEO can paste into an email
  // or save alongside the offer PDF.
  const buildReceipt = (): string => {
    const lines: string[] = [];
    lines.push("SIGNING RECORD");
    lines.push("──────────────");
    lines.push(`Candidate:  ${current.candidate_name ?? "(unknown)"}`);
    lines.push(`Position:   ${current.position_title ?? "(unknown)"}`);
    lines.push(`Employer:   ${current.employer_legal_name ?? "(unknown)"}`);
    lines.push(`Offer ID:   ${current.id}`);
    lines.push(`Token:      ${current.acceptance_token}`);
    lines.push("");
    lines.push(`Status:     ${stateLabel}`);
    if (current.emailed_at) {
      lines.push(`Emailed:    ${new Date(current.emailed_at).toLocaleString()}`);
    }
    if (current.accepted_at) {
      lines.push(`Accepted:   ${new Date(current.accepted_at).toLocaleString()}`);
    }
    if (current.declined_at) {
      lines.push(`Declined:   ${new Date(current.declined_at).toLocaleString()}`);
    }
    if (current.candidate_signature_name) {
      lines.push(
        `Signature:  /s/ ${current.candidate_signature_name}${
          current.candidate_signature_at
            ? " on " + new Date(current.candidate_signature_at).toLocaleString()
            : ""
        }`,
      );
    }
    if (docs.length > 0) {
      lines.push("");
      lines.push("Companion documents:");
      for (const d of docs) {
        const prettyType = d.doc_type.toUpperCase();
        const signedStr =
          d.status === "signed" && d.signed_name
            ? ` — /s/ ${d.signed_name}${
                d.signed_at
                  ? " on " + new Date(d.signed_at).toLocaleString()
                  : ""
              }`
            : ` — ${d.status}`;
        lines.push(`  • ${prettyType}${signedStr}`);
      }
    }
    return lines.join("\n");
  };

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(buildReceipt());
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1400);
    } catch { /* noop */ }
  };

  const downloadReceipt = () => {
    const blob = new Blob([buildReceipt()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (current.candidate_name ?? "candidate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.download = `signing-record-${slug}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Row
      icon={ShieldCheck}
      title="Signing record"
      subtitle="Proof of what the candidate has signed so far. Download or copy as a receipt."
    >
      {/* Status line */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[11px] font-semibold ${stateColor} shrink-0`}>
            ● {stateLabel}
          </span>
          {signedDocs.length > 0 && (
            <span className="text-[10.5px] text-muted-foreground truncate">
              · {signedDocs.length} doc{signedDocs.length === 1 ? "" : "s"} signed
              {pendingDocs.length > 0 && ` · ${pendingDocs.length} pending`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10.5px] text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2">
          {/* Offer signature card */}
          <div className="rounded-md border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileSignature className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
                Offer letter
              </span>
            </div>
            {offerSigned ? (
              <>
                <p className="text-[13px] italic text-foreground" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                  /s/ {current.candidate_signature_name ?? current.candidate_name ?? "(name not captured)"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {current.candidate_signature_at
                    ? new Date(current.candidate_signature_at).toLocaleString()
                    : current.accepted_at
                      ? new Date(current.accepted_at).toLocaleString()
                      : "(timestamp not captured)"}
                </p>
              </>
            ) : offerDeclined ? (
              <p className="text-[11.5px] text-red-300">
                Declined{current.declined_at && ` on ${new Date(current.declined_at).toLocaleString()}`}
              </p>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">
                Not yet signed.
                {current.emailed_at && ` Emailed ${new Date(current.emailed_at).toLocaleString()}.`}
              </p>
            )}
          </div>

          {/* Companion docs */}
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading companion documents…
            </div>
          ) : docs.length > 0 && (
            <div className="space-y-1.5">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="rounded-md border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <FileSignature className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
                        {d.doc_type}
                      </span>
                    </div>
                    <span
                      className={[
                        "text-[10px] px-1.5 py-0.5 rounded-full border",
                        d.status === "signed"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : d.status === "waived"
                            ? "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                      ].join(" ")}
                    >
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {d.status === "signed" && d.signed_name ? (
                    <>
                      <p className="text-[13px] italic text-foreground" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                        /s/ {d.signed_name}
                      </p>
                      {d.signed_at && (
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                          {new Date(d.signed_at).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Awaiting signature.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {/* Primary: open the polished receipt page in the user's
                default browser. That page is shareable, printable,
                and has the full document bodies inline. */}
            <OpenReceiptButton current={current} />
            <CopyReceiptLinkButton current={current} />
            <button
              type="button"
              onClick={copyReceipt}
              className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium hover:border-primary/40"
              title="Copy a plain-text summary to the clipboard"
            >
              {copyState === "copied" ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copyState === "copied" ? "Copied" : "Copy text summary"}
            </button>
            <button
              type="button"
              onClick={downloadReceipt}
              className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium hover:border-primary/40"
              title="Download the plain-text summary as a .txt file"
            >
              <Download className="h-3 w-3" />
              Save .txt
            </button>
          </div>
        </div>
      )}
    </Row>
  );
}

// ── Open receipt / Copy link helpers ───────────────────────────────
// Pulled into their own components so the copy-state bookkeeping stays
// scoped and doesn't get tangled with the text-summary copy state
// inside SignatureRecordRow.

function OpenReceiptButton({ current }: { current: CurrentOffer }) {
  const open = async () => {
    const url = buildReceiptUrl(current.acceptance_token);
    // Prefer the Tauri shell plugin if installed — opens in the
    // user's actual default browser rather than spawning a webview.
    // Gracefully falls back to window.open if the plugin isn't
    // available (dev environment or older Tauri build).
    try {
      const shell = await import("@tauri-apps/plugin-shell").catch(() => null);
      if (shell?.open) {
        await shell.open(url);
        return;
      }
    } catch { /* noop */ }
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch { /* noop */ }
  };
  return (
    <button
      type="button"
      onClick={open}
      className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
      title="Open the shareable receipt page in your default browser"
    >
      <Receipt className="h-3 w-3" />
      Open receipt
      <ExternalLink className="h-3 w-3 opacity-70" />
    </button>
  );
}

function CopyReceiptLinkButton({ current }: { current: CurrentOffer }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = buildReceiptUrl(current.acceptance_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium hover:border-primary/40"
      title="Copy a shareable URL to the receipt page"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Link2 className="h-3 w-3" />}
      {copied ? "Copied link" : "Copy link"}
    </button>
  );
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  return base.slice(0, 32) || `hire-${Date.now().toString(36)}`;
}

// ── Shared row shell ───────────────────────────────────────────────

function Row({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/50 p-3.5">
      <div className="mb-2 flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          <p className="text-[11.5px] text-muted-foreground leading-snug">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
} 