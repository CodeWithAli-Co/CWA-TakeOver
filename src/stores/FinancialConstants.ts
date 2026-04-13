/**
 * FinancialConstants.ts — Categories and chart color palettes.
 *
 * Colors follow the Void theme: red-to-white gradient for expenses,
 * red-to-dark gradient for revenues. No neon greens or purples.
 */

// Predefined expense categories
export const EXPENSE_CATEGORIES = [
  'Technology', 'Office', 'Marketing', 'Legal', 'Administrative',
  'Software', 'Hardware', 'Rent', 'Utilities', 'Insurance', 'Other'
];

// Predefined revenue categories
export const REVENUE_CATEGORIES = [
  'Product Sales', 'Services', 'Consulting', 'Subscriptions',
  'Licensing', 'Advertising', 'Partnerships', 'Other'
];

// Chart colors — Void red-to-white palette for expenses
export const EXPENSE_COLORS: Record<string, string> = {
  'Technology': '#ef4444',
  'Office': '#dc2626',
  'Marketing': '#f87171',
  'Legal': '#b91c1c',
  'Administrative': '#991b1b',
  'Software': '#fca5a5',
  'Hardware': '#7f1d1d',
  'Rent': 'rgba(255,255,255,0.6)',
  'Utilities': 'rgba(255,255,255,0.45)',
  'Insurance': 'rgba(255,255,255,0.3)',
  'Other': 'rgba(255,255,255,0.2)',
  'Employee Costs': '#ef4444'
};

// Chart colors — Void white-to-red palette for revenue
export const REVENUE_COLORS: Record<string, string> = {
  'Product Sales': '#ffffff',
  'Services': 'rgba(255,255,255,0.85)',
  'Consulting': 'rgba(255,255,255,0.7)',
  'Subscriptions': '#ef4444',
  'Licensing': '#f87171',
  'Advertising': '#dc2626',
  'Partnerships': '#fca5a5',
  'Other': 'rgba(255,255,255,0.3)'
};
