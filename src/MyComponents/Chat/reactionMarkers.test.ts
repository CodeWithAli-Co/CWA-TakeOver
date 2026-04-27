/**
 * reactionMarkers.test.ts — Round-trip + boundary cases for the
 * `{rx:...}` codec. The codec is the only thing keeping reactions
 * working on deployments without the `reactions` JSONB column —
 * a regression here silently loses reaction data on those rows.
 */
import { describe, it, expect } from "vitest";
import {
  parseReactionsMarker,
  stripReactionsMarker,
  encodeReactionsMarker,
} from "./reactionMarkers";

describe("parseReactionsMarker", () => {
  it("returns empty object when no marker is present", () => {
    expect(parseReactionsMarker("hello world")).toEqual({});
  });

  it("returns empty object for an empty string", () => {
    expect(parseReactionsMarker("")).toEqual({});
  });

  it("parses a single emoji with one user", () => {
    expect(parseReactionsMarker("{rx:👍=alice}\nhello")).toEqual({
      "👍": ["alice"],
    });
  });

  it("parses multiple users on one emoji", () => {
    expect(parseReactionsMarker("{rx:👍=alice,bob,carol}\nhi")).toEqual({
      "👍": ["alice", "bob", "carol"],
    });
  });

  it("parses multiple emojis", () => {
    expect(parseReactionsMarker("{rx:👍=alice;❤=bob,carol}\nhi")).toEqual({
      "👍": ["alice"],
      "❤": ["bob", "carol"],
    });
  });

  it("trims whitespace inside fields", () => {
    expect(parseReactionsMarker("{rx: 👍 = alice , bob }\nhi")).toEqual({
      "👍": ["alice", "bob"],
    });
  });

  it("ignores marker if it appears anywhere other than the start", () => {
    expect(parseReactionsMarker("hello {rx:👍=alice}\nworld")).toEqual({});
  });

  it("skips chunks without an = (malformed entries)", () => {
    expect(parseReactionsMarker("{rx:malformed;👍=alice}\nhi")).toEqual({
      "👍": ["alice"],
    });
  });

  it("drops empty user entries from the comma-separated list", () => {
    expect(parseReactionsMarker("{rx:👍=alice,,,bob}\nhi")).toEqual({
      "👍": ["alice", "bob"],
    });
  });
});

describe("stripReactionsMarker", () => {
  it("returns the body untouched when no marker is present", () => {
    expect(stripReactionsMarker("hello world")).toBe("hello world");
  });

  it("removes the marker and trims the leading newline", () => {
    expect(stripReactionsMarker("{rx:👍=alice}\nhello")).toBe("hello");
  });

  it("removes the marker even with no trailing newline", () => {
    expect(stripReactionsMarker("{rx:👍=alice}hello")).toBe("hello");
  });

  it("returns empty string when only the marker is present", () => {
    expect(stripReactionsMarker("{rx:👍=alice}\n")).toBe("");
  });
});

describe("encodeReactionsMarker", () => {
  it("returns empty string for empty map (no placeholder marker)", () => {
    expect(encodeReactionsMarker({})).toBe("");
  });

  it("returns empty string when every emoji has zero users", () => {
    // Important: removing the last reactor of every emoji and
    // re-encoding must not pollute the message with `{rx:}`.
    expect(encodeReactionsMarker({ "👍": [], "❤": [] })).toBe("");
  });

  it("encodes a single emoji with one user", () => {
    expect(encodeReactionsMarker({ "👍": ["alice"] })).toBe("{rx:👍=alice}\n");
  });

  it("encodes multiple users on one emoji", () => {
    expect(encodeReactionsMarker({ "👍": ["alice", "bob"] })).toBe(
      "{rx:👍=alice,bob}\n",
    );
  });

  it("encodes multiple emojis joined by ;", () => {
    expect(
      encodeReactionsMarker({ "👍": ["alice"], "❤": ["bob", "carol"] }),
    ).toBe("{rx:👍=alice;❤=bob,carol}\n");
  });

  it("skips emojis whose users array is empty", () => {
    expect(
      encodeReactionsMarker({ "👍": ["alice"], "❤": [] }),
    ).toBe("{rx:👍=alice}\n");
  });
});

describe("round-trip", () => {
  it("parse(encode(x)) === x for a single emoji", () => {
    const reactions = { "👍": ["alice"] };
    const encoded = encodeReactionsMarker(reactions);
    expect(parseReactionsMarker(encoded)).toEqual(reactions);
  });

  it("parse(encode(x)) === x for multiple emojis + users", () => {
    const reactions = {
      "👍": ["alice", "bob"],
      "❤": ["carol"],
      "🚀": ["dave", "eve", "frank"],
    };
    const encoded = encodeReactionsMarker(reactions);
    expect(parseReactionsMarker(encoded)).toEqual(reactions);
  });

  it("strip + parse together leave the bare body", () => {
    const original = "{rx:👍=alice}\nthe actual message";
    expect(stripReactionsMarker(original)).toBe("the actual message");
    expect(parseReactionsMarker(original)).toEqual({ "👍": ["alice"] });
  });

  it("encoded + body, then strip, gives back the original body", () => {
    const body = "the actual message";
    const reactions = { "👍": ["alice"] };
    const composed = encodeReactionsMarker(reactions) + body;
    expect(stripReactionsMarker(composed)).toBe(body);
    expect(parseReactionsMarker(composed)).toEqual(reactions);
  });
});
