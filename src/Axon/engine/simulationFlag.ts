// ───────────────────────────────────────────────────────────────────
// Simulation flag — module-level signal so engine code (executor,
// agent loop) can read whether simulation mode is on without
// threading it through every action context.
//
// AxonProvider calls setSimulationMode whenever its React state
// changes. Engine code calls getSimulationMode() at the moment a
// mutating action would run.
// ───────────────────────────────────────────────────────────────────

let _simulationMode = false;

export function getSimulationMode(): boolean {
  return _simulationMode;
}

export function setSimulationModeFlag(on: boolean): void {
  _simulationMode = on;
}
