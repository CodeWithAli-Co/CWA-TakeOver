# Financial System Architecture

Complete documentation of the financial dashboard, modeler, and projections subsystem.

---

## File Map

### Before consolidation (15+ files)

```
src/routes/financialDashboard.lazy.tsx                    (416 lines, cyberpunk theme)
src/MyComponents/FinancialCalculator.tsx/                  (confusing dir name with .tsx)
  ├── financialField.tsx                                   (405 lines, state orchestrator)
  ├── dynamicItem.tsx                                      (202 lines)
  ├── numericField.tsx                                     (40 lines)
  ├── growthRateField.tsx                                  (30 lines)
  ├── sectionHeader.tsx                                    (16 lines)
  ├── yearSelection.tsx                                    (46 lines)
  ├── customToolTip.tsx                                    (23 lines)
  └── tabs/
      ├── calculatorTab.tsx                                (775 lines)
      ├── VisualizerTab.tsx                                (1004 lines)
      ├── monthlyMultiplier.tsx                            (573 lines, duplicate features)
      └── ScenarioManager.tsx                              (520 lines, DISABLED)
src/stores/FinancialField.ts                               (types)
src/stores/FinancialUtils.ts                               (calculation engine)
src/stores/FinancialConstants.ts                           (categories, colors)
src/assets/statsCard.css                                   (legacy CSS)
```

### After consolidation (7 files)

```
src/routes/financialDashboard.lazy.tsx                    (page entry — bento + tabs)
src/MyComponents/Financial/                                (clean directory name)
  ├── FinancialContext.tsx                                 (NEW — replaces 21-prop drilling)
  ├── FinancialModeler.tsx                                 (merged: calculatorTab + dynamicItem)
  ├── FinancialProjections.tsx                             (renamed + restyled VisualizerTab)
  ├── FinancialComponents.tsx                              (merged: 6 small helpers)
  └── README.md                                            (this file)
src/stores/FinancialField.ts                               (types — kept, cleaned)
src/stores/FinancialUtils.ts                               (calculation engine — kept as-is)
src/stores/FinancialConstants.ts                           (categories — kept, color palette updated)
```

### Files deleted
| File | Reason |
|------|--------|
| `FinancialCalculator.tsx/` (entire dir) | Renamed to `Financial/`, files merged |
| `monthlyMultiplier.tsx` | Overlapping features absorbed into FinancialModeler |
| `ScenarioManager.tsx` | Currently disabled, commented out everywhere |
| `statsCard.css` | Legacy cyberpunk CSS no longer used |

---

## Where Information Lives

### "I want to change the financial dashboard layout"
**File:** [`src/routes/financialDashboard.lazy.tsx`](../../routes/financialDashboard.lazy.tsx)

Top-level page with 4 tabs (Overview, Companies, Cash Flow, Reports) plus a collapsible Modeler section. Each tab is a sub-component within the file.

### "I want to change how state flows / add a new financial parameter"
**File:** [`FinancialContext.tsx`](./FinancialContext.tsx)

Holds all financial state (capital, tax, inflation, expenses, revenues), loads it from Supabase on mount, and computes projections via `useMemo`. Any child component reads via `useFinancialState()`.

### "I want to change how projections are calculated"
**File:** [`src/stores/FinancialUtils.ts`](../../stores/FinancialUtils.ts)

Pure function `calculateProjections()` — applies growth rates year-by-year, computes taxes/inflation/CAGR/break-even/ROI/runway. No UI dependencies.

### "I want to change the modeler form (inputs)"
**File:** [`FinancialModeler.tsx`](./FinancialModeler.tsx)

The 4 sub-tab form: Base / Expenses / Revenue / Personnel. Reads & writes via `useFinancialState()`.

### "I want to change projection charts"
**File:** [`FinancialProjections.tsx`](./FinancialProjections.tsx)

3 sub-tabs: Overview / Cash Flow / Detail Table. Reads via `useFinancialState()`.

### "I want to change input fields, sliders, tooltips, dynamic item rows"
**File:** [`FinancialComponents.tsx`](./FinancialComponents.tsx)

All shared UI primitives: `NumericField`, `GrowthRateField`, `YearSelector`, `SectionHeader`, `CustomTooltip`, `DynamicItem`.

### "I want to add or rename a category"
**File:** [`src/stores/FinancialConstants.ts`](../../stores/FinancialConstants.ts)

Edit `EXPENSE_CATEGORIES`, `REVENUE_CATEGORIES`, `EXPENSE_COLORS`, `REVENUE_COLORS`.

### "I want to add a new field to ExpenseItem / RevenueItem"
**File:** [`src/stores/FinancialField.ts`](../../stores/FinancialField.ts)

All TypeScript types live here. After editing, also update Supabase row mapping in `FinancialContext.tsx` (`loadData` function).

---

## How It Works

### Page lifecycle

```
1. User navigates to /financialDashboard
   ↓
2. FinancialDashboard route renders, wraps content in <FinancialProvider>
   ↓
3. FinancialProvider mounts, fires useEffect → loads from Supabase:
     - cwa_calculatorProps (initialCapital, taxRate, inflationRate, etc.)
     - cwa_expenses (dynamic expense items)
     - cwa_revenues (dynamic revenue items)
   ↓
4. useMemo recomputes projections via calculateProjections()
   ↓
5. FinancialDashboardContent reads aggregates separately for the
   Overview/Companies/CashFlow/Reports tabs (uses its own Supabase fetch)
   ↓
6. When user expands Modeler section:
     - FinancialModeler reads state via useFinancialState()
     - User changes inputs → context updates → useMemo recomputes
     - FinancialProjections reads new projections, charts re-render
```

### State flow (eliminating the old 21-prop drilling)

**Old pattern (deleted):**
```
financialField.tsx (14 useState hooks)
  └── CalculatorTab (receives 21 props)
        ├── BasicParameters tab
        ├── Expenses tab
        ├── Revenue tab
        └── Personnel tab
```

**New pattern:**
```
<FinancialProvider>     ← all state lives here, single source of truth
  └── FinancialDashboardContent
       ├── OverviewTab
       ├── CompaniesTab
       ├── CashFlowTab
       ├── ReportsTab
       └── (collapsible)
            ├── FinancialModeler        ← calls useFinancialState()
            └── FinancialProjections    ← calls useFinancialState()
```

### The 4 dashboard tabs

| Tab | Purpose | Key components |
|-----|---------|---------------|
| **Overview** | Bento layout: top metrics, charts, recent transactions | `MetricCell`, AreaChart, BarChart, PieChart |
| **Companies** | Side-by-side CodeWithAli (red) vs Simplicity (blue) | `CompanyCard` (local), comparison BarChart |
| **Cash Flow** | Burn rate, runway gauge, monthly trend | RadialBarChart gauge, AreaChart with burn overlay |
| **Reports** | Filterable invoices + CSV export | Filter pills, CSV blob download |

### The 2 modeler sub-components

**FinancialModeler** (4 sub-tabs):
- **Base** — Initial capital, tax rate, inflation, projection years + snapshot metrics
- **Expenses** — DynamicItem list + category pie + Add Expense button
- **Revenue** — DynamicItem list + category pie + Add Revenue button
- **Personnel** — Salary, employee count, growth slider + projection chart

**FinancialProjections** (3 sub-tabs):
- **Overview** — Revenue vs Expenses ComposedChart + cumulative profit AreaChart
- **Cash Flow** — Cash position over time + ROI line chart
- **Detail** — Year-by-year data table with all metrics

### Calculation pipeline

```
User changes input (e.g., taxRate)
  ↓
FinancialContext setter runs
  ↓
useMemo dependency changes → recomputes
  ↓
calculateProjections() called with current state
  ↓
For each year (0 → years):
  - Apply growth rate to each expense
  - Apply growth rate to each revenue (compound or simple)
  - Compute employee cost with salary growth
  - Sum totals
  - Subtract for profit-before-tax
  - Apply tax (only if positive profit)
  - Adjust for inflation
  - Update cumulative profit and cash flow
  - Calculate ROI
  ↓
Compute aggregate metrics: CAGR, breakEvenYear, finalCashFlow, profitMargin, runwayMonths
  ↓
Returns { projections: [...years], financialMetrics: {...} }
  ↓
useMemo caches result, updates context value
  ↓
All consumers re-render with new data
```

---

## Supabase Tables

| Table | Used by | Read/Write |
|-------|---------|------------|
| `cwa_calculatorProps` | FinancialContext, financialDashboard | READ |
| `cwa_expenses` | FinancialContext, financialDashboard | READ (write logic not yet wired) |
| `cwa_revenues` | FinancialContext, financialDashboard | READ (write logic not yet wired) |
| `invoices` | financialDashboard (via `AllInvoices()`) | READ |

### Schema gap
None of `cwa_expenses`, `cwa_revenues`, or `invoices` currently has a `company_id` column. The Companies tab uses a 70/30 estimated split until the schema is updated. To add real per-company tracking:

1. Add `company_id text` column to `cwa_expenses`, `cwa_revenues`, `invoices`
2. Update `FinancialContext.tsx` `loadData` to map the new field
3. Update `CompaniesTab` in `financialDashboard.lazy.tsx` to filter by `company_id` instead of using the heuristic split

---

## Adding a New Feature

### Example: "Add a new metric to the Overview metrics strip"

1. Open [`financialDashboard.lazy.tsx`](../../routes/financialDashboard.lazy.tsx)
2. Find the `MetricCell` instances inside `OverviewTab`
3. Add a new `<MetricCell ... />` with the data you want
4. If the data needs Supabase, add a new fetch in the `loadAggregates` useEffect of `FinancialDashboardContent`

### Example: "Add a new sub-tab to the Modeler"

1. Open [`FinancialModeler.tsx`](./FinancialModeler.tsx)
2. Add a new `<TabsTrigger value="myTab">` to the `TabsList`
3. Add a matching `<TabsContent value="myTab">` block below
4. If you need new state, add it to `FinancialContext.tsx` (state + setter + add to provider value)

### Example: "Add a new chart to the Projections"

1. Open [`FinancialProjections.tsx`](./FinancialProjections.tsx)
2. Either add to an existing `<TabsContent>` or create a new sub-tab
3. Pull data from the `chartData` array (already mapped from `projections`)
4. Use the `CustomTooltip` from `FinancialComponents.tsx` for styling consistency

### Example: "Save changes back to Supabase"

Currently the modeler reads from but does not write to takeOversupabase.To add write-back:

1. Open `FinancialContext.tsx`
2. In each setter (e.g. `setInitialCapital`), add an `await takeOversupabase.from('cwa_calculatorProps').upsert({ ... })` call
3. For `addExpense`/`updateExpense`/`deleteExpense`, do the same for `cwa_expenses`
4. Consider debouncing rapid input changes (e.g. for sliders)

---

## Design Tokens (Void theme)

| Element | Token |
|---------|-------|
| Page background | `bg-black` |
| Card background | `bg-[#0a0a0a]` |
| Card border | `border border-white/[0.04]` |
| Card corners | `rounded-sm` (always) |
| Section dividers | `divide-white/[0.04]` or `border-white/[0.025]` |
| Heading | `text-[24px] font-bold text-white tracking-tight` |
| Subheading | `text-[12px] text-white/20` |
| Section label | `text-[10px] text-white/20 uppercase tracking-[0.12em]` |
| Body text | `text-[13px] text-white/60` |
| Muted text | `text-white/30` or `text-white/20` |
| Primary accent | `text-red-500` or `text-red-400` |
| Accent background | `bg-red-500/[0.08]` |
| Input fields | `bg-white/[0.02] border border-white/[0.04]` |
| Input focus | `focus:border-red-500/20` |
| Hover rows | `hover:bg-white/[0.015]` |

### Brand colors
| Company | Color | Tailwind class |
|---------|-------|---------------|
| CodeWithAli | Red | `text-red-400`, `bg-red-500/[0.08]`, `border-red-500/15` |
| Simplicity | Blue | `text-blue-400`, `bg-blue-500/[0.08]`, `border-blue-500/15` |

### Chart palette
| Use | Color | Hex |
|-----|-------|-----|
| Primary data | Red 500 | `#ef4444` |
| Secondary data | White 40% | `rgba(255,255,255,0.4)` |
| Profit / positive | Red 300 | `#fca5a5` |
| Gridlines | White 4% | `rgba(255,255,255,0.04)` |
| Axis labels | White 30% | `rgba(255,255,255,0.3)` |

---

## Quick Reference

| Task | File |
|------|------|
| Change tab layout / dashboard structure | `financialDashboard.lazy.tsx` |
| Modify state shape / Supabase loading | `FinancialContext.tsx` |
| Add/edit form inputs | `FinancialModeler.tsx` |
| Add/edit projection charts | `FinancialProjections.tsx` |
| Edit shared UI (inputs, tooltips, item rows) | `FinancialComponents.tsx` |
| Change calculation logic | `stores/FinancialUtils.ts` |
| Add categories or chart colors | `stores/FinancialConstants.ts` |
| Change TypeScript types | `stores/FinancialField.ts` |
| Add a new invoice query | `stores/invoiceQuery.ts` |
