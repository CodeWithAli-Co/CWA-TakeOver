// ============================================================================
// Encouragement messages.
// The "wrong answer" message is set per Ali's request: gentle, not punitive.
// ============================================================================

const correctMessages = [
  "Excellent! That's exactly right.",
  "You've got it — keep that momentum.",
  "Perfect. The shape of Arabic is starting to click for you.",
  "Beautiful work. That one's locked in.",
  "Right on — this is real progress.",
  "Nice. You're reading Arabic.",
  "Spot on. Ali would be proud of this one.",
  "Crisp answer. Next.",
];

const wrongMessages = [
  "Ali wishes for you to improve — so keep going, you've got this.",
];

const lessonCompleteHigh = [
  "Outstanding lesson. You're building a real foundation.",
  "That was masterful — the Arabic is becoming yours.",
  "Exceptional. You earned every point of that score.",
];

const lessonCompleteMid = [
  "Solid lesson. Review the misses once and you'll own it next round.",
  "Good run. A second pass will turn this gold.",
  "You finished strong. Come back tomorrow and run the review.",
];

const lessonCompleteLow = [
  "Ali wishes for you to improve — so keep going, you've got this. A quick replay will make this click.",
  "Learning Arabic is a climb. Replay this one once and the next pass will feel easier.",
];

const streakMessages: Record<number, string> = {
  2: "Two days in a row — habits are forming.",
  3: "Three-day streak. Nice rhythm.",
  5: "Five days. You are officially committed.",
  7: "A full week! Arabic is now part of your life.",
  14: "Two weeks straight. Elite discipline.",
  30: "Thirty days. You are doing what almost no one does.",
};

export function pickCorrect(): string {
  return correctMessages[Math.floor(Math.random() * correctMessages.length)];
}

export function pickWrong(): string {
  return wrongMessages[0];
}

export function pickLessonComplete(scorePct: number): string {
  if (scorePct >= 85) return lessonCompleteHigh[Math.floor(Math.random() * lessonCompleteHigh.length)];
  if (scorePct >= 60) return lessonCompleteMid[Math.floor(Math.random() * lessonCompleteMid.length)];
  return lessonCompleteLow[Math.floor(Math.random() * lessonCompleteLow.length)];
}

export function streakMessage(streak: number): string | null {
  return streakMessages[streak] ?? null;
}
