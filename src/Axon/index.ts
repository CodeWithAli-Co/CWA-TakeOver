// AXON — lazy-loadable entry.
// The provider, orb, panel, and confirm dialog ship inside this
// module; keep this file free of side-effects so the chunk stays
// cleanly code-split.

export { AxonRoot as default } from "./AxonRoot";
export { useAxon } from "./AxonProvider";
export type { AxonContextValue, AxonSettings, AxonStatus } from "./types";
