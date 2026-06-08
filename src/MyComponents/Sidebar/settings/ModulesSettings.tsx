/**
 * ModulesSettings.tsx — Settings → Modules tab.
 *
 * Lets the founder turn TakeOver modules on/off after install.
 * Reads + writes `takeover_companies.components` (TEXT[]) on
 * the row bound to this install (matched by `company_name`
 * pulled from Stronghold).
 *
 * Reuses `ModulesPicker` so the catalog, grouping, and tile
 * styling stay identical to the install-time Step 4 picker.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";
import { getStronghold } from "@/stores/stronghold";
import { ModulesPicker } from "@/MyComponents/Onboarding/ModulesPicker";
import { MODULES } from "@/MyComponents/Onboarding/modulesCatalog";

const COMPANY_TABLE = "takeover_companies";
const QUERY_KEY = ["takeover-company", "components"] as const;

interface CompanyRow {
  id: number;
  components: string[] | null;
}

async function fetchBoundCompany(): Promise<CompanyRow | null> {
  const stronghold = await getStronghold();
  const companyName = await stronghold.getRecord("company_name");
  if (!companyName) return null;

  const { data, error } = await companySupabase
    .from(COMPANY_TABLE)
    .select("id,components")
    .eq("company_name", companyName)
    .single();

  if (error || !data) {
    console.error("[modules-settings] lookup failed:", error);
    return null;
  }
  return data as CompanyRow;
}

export function ModulesSettings() {
  const qc = useQueryClient();
  const { data: company, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchBoundCompany,
    staleTime: 30_000,
  });

  // Local working copy so toggles feel instant; we only persist
  // on Save (the operator can bail out via Discard if they
  // change their mind mid-edit).
  const initial = useMemo(() => company?.components ?? [], [company]);
  const [working, setWorking] = useState<string[]>(initial);
  useEffect(() => setWorking(initial), [initial]);

  const dirty =
    working.length !== initial.length ||
    working.some((id) => !initial.includes(id));

  const mutation = useMutation({
    mutationFn: async (next: string[]) => {
      if (!company) throw new Error("No bound company");
      const { error } = await companySupabase
        .from(COMPANY_TABLE)
        .update({ components: next })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-tertiary py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[12.5px]">Loading your modules…</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 text-warning shrink-0 mt-0.5"
          strokeWidth={2.2}
        />
        <div>
          <h3 className="text-[13px] font-bold text-warning">
            No company binding found
          </h3>
          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
            This install isn't bound to a company in our records. Restart the
            app to run through the install-binder flow again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky action strip — counter + Save/Discard. Visible
       *  even when the picker scrolls so the operator always
       *  knows where they stand. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border-soft flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-text-tertiary">
            <span className="font-bold text-foreground">{working.length}</span>
            {" of "}
            <span className="font-bold text-foreground">{MODULES.length}</span>
            {" modules enabled"}
          </span>
          {dirty && (
            <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-warning/15 border border-warning/30 text-warning text-[10px] font-bold uppercase tracking-[0.14em]">
              Unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {dirty && (
            <button
              type="button"
              onClick={() => setWorking(initial)}
              disabled={mutation.isPending}
              className="h-8 px-3 rounded-full text-[11.5px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <motion.button
            type="button"
            onClick={() => mutation.mutate(working)}
            disabled={!dirty || mutation.isPending}
            whileTap={dirty ? { scale: 0.97 } : undefined}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[11.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : mutation.isSuccess && !dirty ? (
              <CheckCircle2 size={12} strokeWidth={2.6} />
            ) : (
              <Save size={12} strokeWidth={2.4} />
            )}
            {mutation.isPending
              ? "Saving…"
              : mutation.isSuccess && !dirty
                ? "Saved"
                : "Save changes"}
          </motion.button>
        </div>
      </div>

      {mutation.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2.5">
          <AlertTriangle
            className="h-4 w-4 text-destructive shrink-0 mt-0.5"
            strokeWidth={2.4}
          />
          <p className="text-[12px] text-destructive leading-relaxed">
            Failed to save: {(mutation.error as Error)?.message ?? "Unknown error"}
          </p>
        </div>
      )}

      {/* Quick-select strip — Select all / Clear all so the
       *  operator doesn't have to click 25 cards individually. */}
      <div className="flex items-center gap-2 text-[11.5px]">
        <span className="text-text-tertiary font-semibold uppercase tracking-[0.14em] text-[10px]">
          Quick:
        </span>
        <button
          type="button"
          onClick={() => setWorking(MODULES.map((m) => m.id))}
          className="text-primary hover:text-primary/80 font-semibold transition-colors"
        >
          Select all
        </button>
        <span className="text-text-tertiary/40">·</span>
        <button
          type="button"
          onClick={() => setWorking([])}
          className="text-text-tertiary hover:text-foreground font-semibold transition-colors"
        >
          Clear all
        </button>
      </div>

      <ModulesPicker
        value={working}
        onChange={setWorking}
        showCategoryDescriptions={false}
      />
    </div>
  );
}
