// ───────────────────────────────────────────────────────────────────
// Company switching — moves the entire dashboard between CWA and
// Simplicity via the existing useCompanyFilter zustand store.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import type { CompanyFilter } from "@/stores/store";
import { registerAction } from "./registry";

const COMPANY_MAP: Record<string, CompanyFilter> = {
  cwa: "codeWithAli",
  codewithali: "codeWithAli",
  "code with ali": "codeWithAli",
  simplicity: "simplicityFunds",
  "simplicity funds": "simplicityFunds",
  "simplicity fund": "simplicityFunds",
  all: "all",
  both: "all",
  everything: "all",
};

const FRIENDLY: Record<CompanyFilter, string> = {
  codeWithAli: "CodeWithAli",
  simplicityFunds: "Simplicity",
  all: "both companies",
};

export const switchCompanyAction: AxonAction<
  { company: string },
  { active: CompanyFilter }
> = {
  name: "switch_company",
  description:
    "Switch the active company context for the entire dashboard. Accepts 'CodeWithAli' / 'CWA', 'Simplicity', or 'all'. Every subsequent data query and task will scope to the new company unless the operator explicitly overrides.",
  input_schema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company label — 'cwa', 'codewithali', 'simplicity', or 'all'.",
      },
    },
    required: ["company"],
  },
  mutating: false,
  handler: async ({ company }, ctx) => {
    const key = company.toLowerCase().trim();
    const target = COMPANY_MAP[key];
    if (!target) {
      return {
        summary: `I did not recognize "${company}" as a company. Try CodeWithAli, Simplicity, or all.`,
      };
    }
    if (target === ctx.activeCompany) {
      return { summary: `Already on ${FRIENDLY[target]}.`, data: { active: target } };
    }
    ctx.setActiveCompany(target);
    ctx.logActivity({
      actionName: "switch_company",
      params: { company },
      summary: `Switched to ${FRIENDLY[target]}`,
    });
    return {
      summary: `Now on ${FRIENDLY[target]}.`,
      data: { active: target },
    };
  },
};

export const whichCompanyAction: AxonAction<
  Record<string, never>,
  { active: CompanyFilter }
> = {
  name: "which_company",
  description:
    "Report which company context is currently active. Use when the operator asks 'what company are we on' or 'am I in Simplicity'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => ({
    summary: `Currently on ${FRIENDLY[ctx.activeCompany]}.`,
    data: { active: ctx.activeCompany },
  }),
};

export function registerCompanyActions() {
  registerAction(switchCompanyAction);
  registerAction(whichCompanyAction);
}
