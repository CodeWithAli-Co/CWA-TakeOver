// Register all AXON actions. Called once from the provider mount.

import { registerNavigationActions } from "./navigation";
import { registerCompanyActions } from "./company";
import { registerTaskActions } from "./tasks";
import { registerDataActions } from "./data";
import { registerBriefingActions } from "./briefing";
import { registerAnnouncementActions } from "./announcements";
import { registerAutomationActions } from "./automations";
import { registerMeetingActions } from "./meetings";
import { registerDomActions } from "./dom";
import { registerRoutineActions } from "./routines";
import { registerMemoryActions } from "./memory";
import { registerTrustActions } from "./trust";
import { registerChatActions } from "./chat";
import { registerUndoActions } from "./undo";
import { registerCeoPowerActions } from "./ceo_powers";

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
  registerMeetingActions();
  registerDomActions();
  registerRoutineActions();
  registerMemoryActions();
  registerTrustActions();
  registerChatActions();
  registerUndoActions();
  registerCeoPowerActions();
}
