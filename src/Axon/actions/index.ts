// Register all AXON actions. Called once from the provider mount.

import { registerNavigationActions } from "./navigation";
import { registerCompanyActions } from "./company";
import { registerTaskActions } from "./tasks";
import { registerDataActions } from "./data";
import { registerBriefingActions } from "./briefing";
import { registerAnnouncementActions } from "./announcements";
import { registerAutomationActions } from "./automations";

let registered = false;

export function registerAllActions() {
  if (registered) return;
  registered = true;
  registerNavigationActions();
  registerCompanyActions();
  registerTaskActions();
  registerDataActions();
  registerBriefingActions();
  registerAnnouncementActions();
  registerAutomationActions();
}
