// ───────────────────────────────────────────────────────────────────
// Action Registry
// Adding a new AXON capability = register an action here. No other
// layer changes. Brain, executor, quick commands, and the settings
// log all discover actions from this registry.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";

type AnyAction = AxonAction<any, any>;

const _registry = new Map<string, AnyAction>();

export function registerAction(action: AnyAction): void {
  if (_registry.has(action.name)) {
    // Re-registration is allowed (hot reload) — newest wins.
    console.warn(`[AXON] Overriding registered action: ${action.name}`);
  }
  _registry.set(action.name, action);
}

export function getAction(name: string): AnyAction | undefined {
  return _registry.get(name);
}

export function listActions(): AnyAction[] {
  return Array.from(_registry.values());
}

/** Build the tool definitions array sent to Claude. */
export function buildToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: AnyAction["input_schema"];
}> {
  return listActions().map((a) => ({
    name: a.name,
    description: a.description,
    input_schema: a.input_schema,
  }));
}

/** Clear — useful for tests. */
export function _clearRegistry() {
  _registry.clear();
}
