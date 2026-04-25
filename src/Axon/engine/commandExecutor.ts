// ───────────────────────────────────────────────────────────────────
// Shared module-scoped binding for "submit a natural-language command
// back to AXON's brain". The provider binds this once on mount; any
// action that needs to chain or fire-and-forget a command (automations,
// chain_commands, future agent mode) imports `runBoundCommand` from here.
//
// This is a tiny indirection layer to avoid having every consumer do
// its own provider lookup or thread the function through props.
// ───────────────────────────────────────────────────────────────────

type ExecutorFn = (
  command: string,
  modality: "voice" | "text",
) => Promise<void>;

let bound: ExecutorFn | null = null;

/** Wire up the executor. Called once from AxonProvider. */
export function bindCommandExecutor(fn: ExecutorFn) {
  bound = fn;
}

/** Run a natural-language command through the bound executor. Returns
 *  silently if the executor isn't bound yet (fail-soft so module load
 *  order doesn't crash anything). */
export async function runBoundCommand(
  command: string,
  modality: "voice" | "text" = "text",
): Promise<void> {
  if (!bound) return;
  await bound(command, modality);
}

/** Whether the executor has been bound. Useful for conditional UX. */
export function isCommandExecutorReady(): boolean {
  return bound !== null;
}
