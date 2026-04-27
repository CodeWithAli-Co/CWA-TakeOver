/**
 * chatNotify.test.ts — Behavior contract for the notification routing
 * helpers. Any change that flips one of these assertions will surface
 * as a missed message or a spam ping in production. Treat them as
 * load-bearing.
 */
import { describe, it, expect } from "vitest";
import {
  escapeRegExp,
  matchesKeyword,
  isMentioned,
  isHereCall,
} from "./chatNotify";

describe("escapeRegExp", () => {
  it("escapes every regex meta-character", () => {
    expect(escapeRegExp(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
  });

  it("leaves plain text alone", () => {
    expect(escapeRegExp("hello world")).toBe("hello world");
  });

  it("returns empty string unchanged", () => {
    expect(escapeRegExp("")).toBe("");
  });
});

describe("matchesKeyword", () => {
  it("returns null when keywords list is empty", () => {
    expect(matchesKeyword("anything goes here", [])).toBeNull();
  });

  it("returns null when text is empty", () => {
    expect(matchesKeyword("", ["urgent"])).toBeNull();
  });

  it("matches a keyword surrounded by spaces", () => {
    expect(matchesKeyword("there's an urgent issue", ["urgent"])).toBe(
      "urgent",
    );
  });

  it("respects word boundaries — does not match a substring", () => {
    // "urgent" must not match inside "urgentmatter"
    expect(matchesKeyword("urgentmatter", ["urgent"])).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(matchesKeyword("PROD IS DOWN", ["prod"])).toBe("prod");
    expect(matchesKeyword("prod is fine", ["PROD"])).toBe("prod");
  });

  it("returns the FIRST matching keyword in list order", () => {
    // "alpha" appears first in the keywords list; "beta" earlier in
    // the text should not flip the order — list order wins.
    expect(matchesKeyword("beta then alpha", ["alpha", "beta"])).toBe("alpha");
  });

  it("normalizes whitespace and case in the stored keyword", () => {
    expect(matchesKeyword("the deploy is broken", ["  Deploy  "])).toBe(
      "deploy",
    );
  });

  it("safely handles regex meta-characters in keywords", () => {
    // "(prod)" without escaping would crash the RegExp constructor
    // with an unbalanced paren. With escaping it should match the
    // literal characters in the message body.
    expect(matchesKeyword("rolling out (prod) tonight", ["(prod)"])).toBe(
      "(prod)",
    );
  });

  it("treats emoji + punctuation as word boundaries", () => {
    // The boundary class is [^a-z0-9], so non-alphanumeric chars
    // (including emojis and punctuation) act as separators.
    expect(matchesKeyword("alert! 🚨 incoming", ["alert"])).toBe("alert");
    expect(matchesKeyword("🚨alert🚨", ["alert"])).toBe("alert");
  });

  it("skips empty / whitespace-only keywords", () => {
    expect(matchesKeyword("hello world", ["", "   ", "world"])).toBe("world");
    expect(matchesKeyword("hello world", ["", "   "])).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchesKeyword("hello world", ["urgent", "alert"])).toBeNull();
  });
});

describe("isMentioned", () => {
  it("returns false for empty text", () => {
    expect(isMentioned("", "alice")).toBe(false);
  });

  it("returns false for empty username", () => {
    expect(isMentioned("hey @alice", "")).toBe(false);
  });

  it("matches a mention preceded by whitespace", () => {
    expect(isMentioned("hey @alice can you check this", "alice")).toBe(true);
  });

  it("matches a mention at the very start of the message", () => {
    expect(isMentioned("@alice please look", "alice")).toBe(true);
  });

  it("matches when followed by punctuation", () => {
    expect(isMentioned("@alice!", "alice")).toBe(true);
    expect(isMentioned("@alice, thoughts?", "alice")).toBe(true);
    expect(isMentioned("@alice?", "alice")).toBe(true);
  });

  it("does not match when followed by another identifier character", () => {
    // @aliceberg should not ping alice
    expect(isMentioned("hi @aliceberg", "alice")).toBe(false);
    // hyphen and dot are also identifier chars in usernames
    expect(isMentioned("hi @alice-ext", "alice")).toBe(false);
    expect(isMentioned("hi @alice.dev", "alice")).toBe(false);
  });

  it("does not match an email-style @ (not preceded by whitespace)", () => {
    expect(isMentioned("contact alice@example.com", "alice")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isMentioned("hey @ALICE", "alice")).toBe(true);
    expect(isMentioned("hey @alice", "Alice")).toBe(true);
  });

  it("handles usernames with regex meta-characters via escapeRegExp", () => {
    // Hypothetical username with a dot — the regex should match it
    // literally rather than treating the dot as "any character".
    expect(isMentioned("hi @alice.bob", "alice.bob")).toBe(true);
    expect(isMentioned("hi @aliceXbob", "alice.bob")).toBe(false);
  });
});

describe("isHereCall", () => {
  it("returns false for empty text", () => {
    expect(isHereCall("")).toBe(false);
  });

  it("matches @here at the start of a message", () => {
    expect(isHereCall("@here is anyone available?")).toBe(true);
  });

  it("matches @here mid-message", () => {
    expect(isHereCall("hey @here can someone help")).toBe(true);
  });

  it("does not match when @here is part of a longer token", () => {
    expect(isHereCall("@hereisanotherword")).toBe(false);
    expect(isHereCall("@here_team")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isHereCall("@HERE ping")).toBe(true);
    expect(isHereCall("@Here ping")).toBe(true);
  });
});
