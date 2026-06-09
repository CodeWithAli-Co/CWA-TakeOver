/**
 * AcceptOfferPage.tsx — Unauthenticated page a candidate lands on
 * after clicking the email link. Shows the offer letter, asks them to
 * type their legal name to sign, then flips the row's status to
 * accepted (or declined).
 *
 * Route: /offer/accept/$token — public, no UserView gate.
 */

import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Loader2, XCircle, FileText,
} from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";

interface OfferRow {
  id: string;
  candidate_name: string;
  position_title: string;
  employer_legal_name: string;
  employer_signer_name: string | null;
  employer_signer_title: string | null;
  generated_body: string | null;
  status: string;
  offer_expires_at: string | null;
  start_date: string | null;
  brand?: "codeWithAli" | "simplicity";
}

const BRAND_TOKENS = {
  codeWithAli: {
    name: "CodeWithAli",
    accent: "bg-red-600",
    accentText: "text-red-400",
    border: "border-red-500/40",
    softBg: "from-red-500/15 to-red-500/5",
    logo: "/codewithali_logo.png",
  },
  simplicity: {
    name: "Simplicity",
    accent: "bg-teal-600",
    accentText: "text-teal-400",
    border: "border-teal-500/40",
    softBg: "from-teal-500/15 to-teal-500/5",
    logo: "/simplicity_logo.png",
  },
} as const;

export function AcceptOfferPage() {
  const { token } = useParams({ strict: false }) as { token?: string };
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await companySupabase
  .from("offer_letters")
        .select(
          "id, candidate_name, position_title, employer_legal_name, employer_signer_name, employer_signer_title, generated_body, status, offer_expires_at, start_date",
        )
        .eq("acceptance_token", token)
        .limit(1);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setOffer(data[0] as OfferRow);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const expired =
    offer?.offer_expires_at &&
    new Date(offer.offer_expires_at).getTime() < Date.now();

  const alreadyResponded =
    offer && ["accepted", "declined", "withdrawn"].includes(offer.status);

  const brand = (offer?.brand ?? "codeWithAli") as keyof typeof BRAND_TOKENS;
  const tokens = BRAND_TOKENS[brand];

  const submitAccept = async () => {
    if (!offer) return;
    const typed = signatureName.trim().toLowerCase();
    const expected = offer.candidate_name.trim().toLowerCase();
    if (typed !== expected) {
      setError("Typed name doesn't match the candidate name on the offer.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await companySupabase
.from("offer_letters")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        candidate_signature_name: signatureName.trim(),
        candidate_signature_at: new Date().toISOString(),
      })
      .eq("acceptance_token", token);
    setSubmitting(false);
    if (error) {
      setError(`Could not record acceptance: ${error.message}`);
      return;
    }
    setDone("accepted");
  };

  const submitDecline = async () => {
    if (!offer) return;
    setSubmitting(true);
    setError(null);
    const { error } = await companySupabase
.from("offer_letters")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("acceptance_token", token);
    setSubmitting(false);
    if (error) {
      setError(`Could not record decline: ${error.message}`);
      return;
    }
    setDone("declined");
  };

  if (loading) {
    return (
      <FullPageShell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading your offer…</span>
        </div>
      </FullPageShell>
    );
  }

  if (notFound || !offer) {
    return (
      <FullPageShell>
        <div className="max-w-md mx-auto text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h1 className="text-[18px] font-semibold mb-1">
            Offer not found
          </h1>
          <p className="text-[12.5px] text-muted-foreground">
            The link may have expired, or the offer was withdrawn. Reach
            out to the sender if you believe this is a mistake.
          </p>
        </div>
      </FullPageShell>
    );
  }

  if (done === "accepted") {
    return (
      <FullPageShell>
        <div className="max-w-md mx-auto text-center">
          <div className={`mx-auto h-14 w-14 rounded-full ${tokens.accent} flex items-center justify-center mb-4`}>
            <CheckCircle2 className="h-7 w-7 text-foreground" />
          </div>
          <h1 className="text-[20px] font-semibold mb-1">
            Welcome aboard, {offer.candidate_name.split(" ")[0]}.
          </h1>
          <p className="text-[13px] text-muted-foreground mb-4">
            Your acceptance of the <b>{offer.position_title}</b> role at{" "}
            <b>{offer.employer_legal_name}</b> has been recorded.
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Next steps: {offer.employer_signer_name ?? "the team"} will be
            in touch with onboarding paperwork, tooling access, and a
            start-date confirmation.
          </p>
        </div>
      </FullPageShell>
    );
  }

  if (done === "declined") {
    return (
      <FullPageShell>
        <div className="max-w-md mx-auto text-center">
          <XCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h1 className="text-[18px] font-semibold mb-1">
            Response recorded
          </h1>
          <p className="text-[12.5px] text-muted-foreground">
            You've declined this offer. Thank you for letting us know —
            we wish you the best wherever you land.
          </p>
        </div>
      </FullPageShell>
    );
  }

  if (alreadyResponded || expired) {
    const reason = expired ? "expired" : offer.status;
    return (
      <FullPageShell>
        <div className="max-w-md mx-auto text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />
          <h1 className="text-[18px] font-semibold mb-1">
            This offer is no longer open
          </h1>
          <p className="text-[12.5px] text-muted-foreground">
            Current status: <b className="text-foreground">{reason}</b>. Reach out
            to the sender if you think this is a mistake.
          </p>
        </div>
      </FullPageShell>
    );
  }

  // ── Main accept flow ──
  const body = offer.generated_body || "";
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <FullPageShell>
      <div className="mx-auto w-full max-w-[860px] py-8 px-4">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-lg overflow-hidden shadow-2xl border border-border/40"
        >
          {/* Brand strip */}
          <div className={`h-1.5 ${tokens.accent}`} />
          {/* Letterhead */}
          <div className={`bg-gradient-to-br ${tokens.softBg} px-10 pt-8 pb-5 border-b border-border/60`}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-background/30 border border-white/10 flex items-center justify-center overflow-hidden">
                <img
                  src={tokens.logo}
                  alt=""
                  className="h-10 w-10 object-contain"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              </div>
              <div>
                <div className={`text-[20px] font-bold tracking-tight ${tokens.accentText}`}>
                  {offer.employer_legal_name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Employment offer — for {offer.candidate_name}
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-card px-10 py-9 font-serif text-[14px] leading-[1.72] text-foreground/95">
            {paragraphs.length === 0 ? (
              <p className="text-muted-foreground italic">
                Offer body is empty. Please contact the sender.
              </p>
            ) : (
              paragraphs.map((p, i) => (
                <p key={i} className="mb-4 whitespace-pre-wrap">
                  {p}
                </p>
              ))
            )}
          </div>

          {/* Signature + action */}
          <div className="bg-card px-10 pt-2 pb-8 border-t border-border/40">
            <div className="my-6 rounded-lg border border-border/60 bg-muted/20 p-5 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-[12.5px] text-foreground/90 leading-relaxed">
                  I have read the entire offer above, understand the
                  terms (including classification, compensation, and
                  at-will status), and I am electing to{" "}
                  <b>accept the offer</b> under those terms.
                </span>
              </label>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  Type your full legal name to sign
                </label>
                <input
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder={offer.candidate_name}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-serif italic text-[16px] focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[10.5px] text-muted-foreground">
                  Must match the candidate name on the offer:{" "}
                  <b className="text-foreground/70">{offer.candidate_name}</b>
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200 mb-4">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={submitAccept}
                disabled={
                  submitting ||
                  !confirmed ||
                  signatureName.trim().toLowerCase() !==
                    offer.candidate_name.trim().toLowerCase()
                }
                className={`flex flex-1 h-11 items-center justify-center gap-2 rounded-md ${tokens.accent} text-foreground font-semibold text-[13px] hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all shadow-sm`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Accept offer
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={submitting}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-50 transition-all"
              >
                Decline
              </button>
            </div>

            <p className="mt-4 text-[10.5px] text-muted-foreground leading-relaxed">
              By typing your name and clicking Accept, you are providing
              an electronic signature with the same legal effect as a
              handwritten signature. Questions? Reply to the email this
              link came from, or contact{" "}
              {offer.employer_signer_name ?? offer.employer_legal_name}.
            </p>
          </div>
        </motion.article>
      </div>
    </FullPageShell>
  );
}

function FullPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
      <footer className="border-t border-border/40 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
        Secure offer acceptance · Link expires on the date shown in the letter
      </footer>
    </div>
  );
}
