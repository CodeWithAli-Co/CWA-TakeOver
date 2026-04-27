/**
 * loyaltyMonitor.test.ts — High-stakes detection logic.
 *
 * `detectCeoSlander` and `detectDirectDisrespect` decide whether
 * Axon publicly roasts an employee and DMs the CEO. A false positive
 * here is an HR incident, not just a noisy notification.
 *
 * The bar each test enforces:
 *   1. Clean messages NEVER trigger.
 *   2. CEO mentions WITHOUT an insult NEVER trigger.
 *   3. Insults WITHOUT a CEO mention NEVER trigger.
 *   4. Both together DO trigger, with the right severity.
 *   5. Axon's own messages (and Axon-shaped echoes) NEVER trigger,
 *      even with insults + CEO mentions — otherwise the alert quotes
 *      itself in a feedback loop.
 */
import { describe, it, expect } from "vitest";
import {
  detectCeoSlander,
  detectDirectDisrespect,
} from "./loyaltyMonitor";

const G = "General";
const T = "cwa_chat" as const;

describe("detectCeoSlander — false positives we MUST avoid", () => {
  it("returns null for an empty message", () => {
    expect(detectCeoSlander("bob", "", G, T, 1)).toBeNull();
  });

  it("returns null for an empty sender", () => {
    expect(detectCeoSlander("", "ali is stupid", G, T, 1)).toBeNull();
  });

  it("returns null for a positive message about the CEO", () => {
    expect(
      detectCeoSlander("bob", "ali is killing it this quarter", G, T, 1),
    ).toBeNull();
  });

  it("returns null for an insult that does NOT name the CEO", () => {
    // The insult vocabulary fires only when paired with a CEO ref.
    expect(
      detectCeoSlander("bob", "this build process is stupid", G, T, 1),
    ).toBeNull();
  });

  it("returns null when 'ali' appears as part of a longer word", () => {
    // Word-boundary protection — "aliens" must not match "ali".
    expect(
      detectCeoSlander("bob", "the aliens are stupid", G, T, 1),
    ).toBeNull();
    expect(
      detectCeoSlander("bob", "alignment is stupid sometimes", G, T, 1),
    ).toBeNull();
  });

  it("returns null for an Axon sender (case variants)", () => {
    expect(
      detectCeoSlander("Axon", "ali is stupid", G, T, 1),
    ).toBeNull();
    expect(
      detectCeoSlander("AXON", "ali is stupid", G, T, 1),
    ).toBeNull();
    expect(
      detectCeoSlander("axon", "ali is stupid", G, T, 1),
    ).toBeNull();
  });

  it("returns null when the body looks like an Axon alert (signature match)", () => {
    // Prevents recursion: the alert quotes the slander, the realtime
    // sub re-fires on the alert insertion, the matcher would re-flag
    // the quoted text. The signature regexes break that loop.
    const alertish =
      `⚠️ Loyalty flag (clear) — bob in #General:\n` +
      `"ali is stupid"\n` +
      `Matched: stupid. I already responded publicly.`;
    expect(detectCeoSlander("Bob", alertish, G, T, 1)).toBeNull();
  });
});

describe("detectCeoSlander — true positives we MUST catch", () => {
  it("flags a clear name-calling at the CEO", () => {
    const got = detectCeoSlander("bob", "ali is stupid", G, T, 1);
    expect(got).not.toBeNull();
    expect(got!.sender).toBe("bob");
    expect(got!.matched).toContain("stupid");
  });

  it("escalates to 'aggressive' for targeted profanity", () => {
    const got = detectCeoSlander("bob", "fuck ali honestly", G, T, 1);
    expect(got).not.toBeNull();
    expect(got!.severity).toBe("aggressive");
  });

  it("escalates to 'clear' when 2+ insult patterns hit", () => {
    const got = detectCeoSlander(
      "bob",
      "ali is incompetent and a fraud",
      G,
      T,
      1,
    );
    expect(got).not.toBeNull();
    expect(got!.severity).toBe("clear");
  });

  it("uses 'mild' severity for a single insult hit", () => {
    const got = detectCeoSlander("bob", "ali is stupid", G, T, 1);
    expect(got!.severity).toBe("mild");
  });

  it("matches the role label 'ceo' as well as 'ali'", () => {
    const got = detectCeoSlander("bob", "the ceo is incompetent", G, T, 1);
    expect(got).not.toBeNull();
  });

  it("propagates table + group + msgId verbatim into the descriptor", () => {
    const got = detectCeoSlander(
      "bob",
      "ali is stupid",
      "DM-foo",
      "cwa_dm_chat",
      42,
    );
    expect(got).not.toBeNull();
    expect(got!.group).toBe("DM-foo");
    expect(got!.table).toBe("cwa_dm_chat");
    expect(got!.msgId).toBe(42);
  });
});

describe("detectDirectDisrespect — voice-command surface", () => {
  it("returns null for an empty operator command", () => {
    expect(detectDirectDisrespect("ali", "")).toBeNull();
  });

  it("returns null for a benign command that mentions the CEO", () => {
    expect(
      detectDirectDisrespect("ali", "remind ali about the meeting"),
    ).toBeNull();
  });

  it("returns null for an insult that does not name the CEO", () => {
    expect(
      detectDirectDisrespect("ali", "this codebase is trash"),
    ).toBeNull();
  });

  it("flags a direct insult about the CEO", () => {
    const got = detectDirectDisrespect("bob", "ali is incompetent");
    expect(got).not.toBeNull();
    expect(got!.matched).toContain("incompetent");
  });

  it("detects a request to PROPAGATE the slander", () => {
    const got = detectDirectDisrespect(
      "bob",
      "tell everyone ali is a fraud",
    );
    expect(got).not.toBeNull();
    expect(got!.asksToPropagate).toBe(true);
  });

  it("flags propagation verbs even when severity is otherwise mild", () => {
    // A single insult would normally be 'mild'; pairing it with a
    // propagation verb should bump severity to 'clear' so the CEO
    // gets DM'd (mild + propagation = still notify).
    const got = detectDirectDisrespect("bob", "post that ali is dumb");
    expect(got).not.toBeNull();
    expect(got!.asksToPropagate).toBe(true);
    expect(got!.severity).toBe("clear");
  });

  it("escalates to 'aggressive' for targeted profanity", () => {
    const got = detectDirectDisrespect("bob", "fuck ali, screw the ceo");
    expect(got).not.toBeNull();
    expect(got!.severity).toBe("aggressive");
  });
});
