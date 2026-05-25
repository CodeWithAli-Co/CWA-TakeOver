import { composePersonalityPrompt } from "./src/Axon/personality/composer.ts";
import { classifyMood } from "./src/Axon/personality/mood.ts";
import { PRESETS } from "./src/Axon/personality/personality-prompts.config.ts";
import type { MoodTag } from "./src/Axon/personality/types.ts";

const promptA = composePersonalityPrompt(
  PRESETS.jarvis.dimensions,
  { userName: "Marcus", relationshipDays: 47, recentMoodSignal: "neutral", timeOfDay: "afternoon" },
  "jarvis",
);

const promptB = composePersonalityPrompt(
  PRESETS.best_friend.dimensions,
  {
    userName: "Marcus", relationshipDays: 47,
    recentMoodSignal: "frustrated", timeOfDay: "late_night",
    recentMemories: [
      "Shipped the apply-form pipeline last Tuesday after a brutal 3-day debug session.",
      "Demoed Takeover to a16z partners Friday — said the orb felt 'genuinely alive'.",
    ],
  },
  "best_friend",
);

console.log("================================================================");
console.log("SCENARIO A — Jarvis / Marcus / 47d / neutral / afternoon");
console.log(`Chars: ${promptA.length} | approx tokens: ${Math.round(promptA.length / 4)}`);
console.log("================================================================");
console.log(promptA);
console.log("\n\n================================================================");
console.log("SCENARIO B — Best Friend / Marcus / 47d / frustrated / late_night / +2 memories");
console.log(`Chars: ${promptB.length} | approx tokens: ${Math.round(promptB.length / 4)}`);
console.log("================================================================");
console.log(promptB);

type Sample = { msg: string; expected: MoodTag };
const samples: Sample[] = [
  { msg: "Ugh, why won't this build pass?",                          expected: "frustrated" },
  { msg: "This is the third time the API has timed out today.",      expected: "frustrated" },
  { msg: "I'm so tired of this bug — same issue keeps coming back.", expected: "frustrated" },
  { msg: "Not working again. Why won't it just load.",               expected: "frustrated" },
  { msg: "Feeling pretty down today. Rough week.",                   expected: "sad" },
  { msg: "I'm really struggling with this — feeling kind of lost.",  expected: "sad" },
  { msg: "Honestly burnt out and I don't know how to keep going.",   expected: "sad" },
  { msg: "I'm exhausted. Long day. Just need the quick answer.",     expected: "tired" },
  { msg: "Wiped. Can barely think straight.",                        expected: "tired" },
  { msg: "Haven't slept properly all week, running on fumes.",       expected: "tired" },
  { msg: "Just tell me the endpoint URL.",                           expected: "focused" },
  { msg: "TLDR me — what does this function do?",                    expected: "focused" },
  { msg: "Head down on a deadline, skip the preamble.",              expected: "focused" },
  { msg: "WE SHIPPED IT!!! It's live!",                              expected: "excited" },
  { msg: "Holy cool, the demo actually worked, lfg",                 expected: "excited" },
  { msg: "Finally — this is huge. We did it.",                       expected: "excited" },
  { msg: "What's the difference between let and const?",             expected: "neutral" },
  { msg: "Schedule a meeting with Sarah on Tuesday at 2pm.",         expected: "neutral" },
  { msg: "Show me the bug reports inbox.",                           expected: "neutral" },
  { msg: "Can you help me draft an email to the team?",              expected: "neutral" },
];

const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
const rows = samples.map((s) => ({ ...s, got: classifyMood(s.msg) }));

console.log("\n\n================================================================");
console.log("MOOD CONFUSION MATRIX (20 samples)");
console.log("================================================================");
console.log(pad("OK", 4) + pad("Expected", 12) + pad("Got", 12) + "Message");
console.log("-".repeat(120));
for (const r of rows) {
  const ok = r.got === r.expected;
  console.log(pad(ok ? "OK" : "X", 4) + pad(r.expected, 12) + pad(r.got, 12) + (ok ? "" : "FAIL > ") + r.msg);
}
const correct = rows.filter((r) => r.got === r.expected).length;
console.log("-".repeat(120));
console.log(`Score: ${correct}/${rows.length} (${Math.round(100 * correct / rows.length)}%)`);

const byClass: Record<string, { hit: number; total: number }> = {};
for (const r of rows) {
  byClass[r.expected] ??= { hit: 0, total: 0 };
  byClass[r.expected].total += 1;
  if (r.got === r.expected) byClass[r.expected].hit += 1;
}
console.log("\nPer-class recall:");
for (const [tag, b] of Object.entries(byClass)) {
  console.log(`  ${pad(tag, 12)} ${b.hit}/${b.total}`);
}
