// Helpers for working with CoA code conventions.

import type { GLAccount, AccountType } from "../types/coa";

const TYPE_RANGES: Array<[AccountType, RegExp]> = [
  ["asset", /^1/],
  ["liability", /^2/],
  ["equity", /^3/],
  ["income", /^4/],
  ["expense", /^[5-9]/],
];

/** Validate that an account's code matches its type by convention. */
export function codeMatchesType(account: GLAccount): boolean {
  const range = TYPE_RANGES.find(([t]) => t === account.type);
  return range ? range[1].test(account.code) : true;
}

/** Sort accounts by code, then name — for display. */
export function sortAccounts(accounts: GLAccount[]): GLAccount[] {
  return [...accounts].sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return a.name.localeCompare(b.name);
  });
}

/** Build a lookup map from id → GLAccount. */
export function accountsById(accounts: GLAccount[]): Map<string, GLAccount> {
  const m = new Map<string, GLAccount>();
  for (const a of accounts) m.set(a.id, a);
  return m;
}

/** Filter to postable, non-archived accounts only — for editor pickers. */
export function postableAccounts(accounts: GLAccount[]): GLAccount[] {
  return accounts.filter((a) => a.isPostable && !a.isArchived);
}
