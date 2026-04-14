// ============================================================================
// LEVEL 1 — Foundations of the Alphabet (letters 1–14 of 28)
// Teaches recognition of the isolated forms, basic sound, and sample words.
// ============================================================================

import type { Level } from "../types";

export const level1: Level = {
  id: "L1",
  order: 1,
  title: "Foundations of the Arabic Script",
  subtitle: "Meet the first half of the alphabet",
  theme: "alphabet",
  goal: "Recognize and pronounce the first 14 letters of the Arabic alphabet.",
  lessons: [
    // -----------------------------------------------------------------------
    {
      id: "L1.1",
      levelId: "L1",
      order: 1,
      title: "Welcome to Arabic",
      subtitle: "Orientation & how the script works",
      theme: "alphabet",
      estimatedMinutes: 20,
      xp: 30,
      summary: "How Arabic is written — direction, shape, and mindset.",
      wrapUp: "You now know how the script behaves. From here, we meet the letters themselves.",
      activities: [
        {
          kind: "info",
          title: "A few things to know first",
          body:
            "Arabic is written RIGHT to LEFT.\n\n" +
            "The alphabet has 28 consonants. Short vowels (a, i, u) are usually marked above or below the letter as small signs called harakat — we'll learn those in Level 3.\n\n" +
            "Most letters connect to their neighbors like cursive handwriting, and each letter has up to four shapes: isolated, initial, medial, final. We'll build up to that gradually.",
          tip: "You don't need perfect pronunciation on day one. You need repetition.",
        },
        {
          kind: "info",
          title: "The 28 letters at a glance",
          body: "Here are the first letters you'll learn this level. Just look — you'll drill them next.",
          showcase: [
            { ar: "ا", translit: "alif", en: "a / long ā" },
            { ar: "ب", translit: "bā", en: "b" },
            { ar: "ت", translit: "tā", en: "t" },
            { ar: "ث", translit: "thā", en: "th (as in think)" },
            { ar: "ج", translit: "jīm", en: "j" },
            { ar: "ح", translit: "ḥā", en: "deep H (throaty)" },
            { ar: "خ", translit: "khā", en: "kh (as in Bach)" },
          ],
        },
        {
          kind: "mcq",
          question: "Which direction is Arabic read and written?",
          choices: ["Left to right", "Right to left", "Top to bottom", "Bottom to top"],
          correctIndex: 1,
          explain: "Right to left. Numbers in Arabic, though, are written left to right.",
        },
        {
          kind: "mcq",
          question: "How many letters are in the Arabic alphabet?",
          choices: ["26", "28", "30", "33"],
          correctIndex: 1,
          explain: "28 consonant letters. Short vowels are written as marks, not as full letters.",
        },
        {
          kind: "info",
          title: "Closing",
          body:
            "That's orientation done. Every day from here builds on the last. 20–30 minutes at a time, 3–4 days a week, and in a few weeks you'll be reading real Arabic.",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.2",
      levelId: "L1",
      order: 2,
      title: "Alif, Bā, Tā, Thā",
      subtitle: "The first four letters",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 40,
      prerequisites: ["L1.1"],
      summary: "Your first four letters — notice the dots, they change everything.",
      wrapUp: "Dots are everything in Arabic. ب ت ث share the same body.",
      activities: [
        {
          kind: "info",
          title: "ا ب ت ث — look at the pattern",
          body:
            "Alif (ا) is a simple vertical line. It marks a long 'ā' sound.\n\n" +
            "Bā, Tā, and Thā share the same boat-shaped body. What changes is the dots:\n" +
            "  ب — one dot BELOW → 'b'\n" +
            "  ت — two dots ABOVE → 't'\n" +
            "  ث — three dots ABOVE → 'th' (as in think)",
          showcase: [
            { ar: "ا", translit: "alif", en: "long ā", note: "A vertical stroke. Sometimes carries hamza: أ, إ." },
            { ar: "ب", translit: "bā", en: "b", note: "One dot below the boat." },
            { ar: "ت", translit: "tā", en: "t", note: "Two dots above." },
            { ar: "ث", translit: "thā", en: "th (think)", note: "Three dots above — soft, not the 'th' in 'this'." },
          ],
        },
        {
          kind: "flashcard",
          prompt: "Drill the four letters",
          cards: [
            { ar: "ا", translit: "alif", en: "long ā" },
            { ar: "ب", translit: "bā", en: "b" },
            { ar: "ت", translit: "tā", en: "t" },
            { ar: "ث", translit: "thā", en: "th" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ب",
          question: "Which letter is this?",
          choices: ["tā (t)", "bā (b)", "thā (th)", "nūn (n)"],
          correctIndex: 1,
          explain: "One dot below → bā → 'b'.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ت",
          question: "Which letter is this?",
          choices: ["bā (b)", "tā (t)", "thā (th)", "yā (y)"],
          correctIndex: 1,
          explain: "Two dots above → tā.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ث",
          question: "Which letter is this?",
          choices: ["tā (t)", "thā (th)", "bā (b)", "shīn (sh)"],
          correctIndex: 1,
          explain: "Three dots above → thā (th as in 'think').",
        },
        {
          kind: "match",
          prompt: "Match each Arabic letter to its sound",
          pairs: [
            { ar: "ا", en: "long ā" },
            { ar: "ب", en: "b" },
            { ar: "ت", en: "t" },
            { ar: "ث", en: "th (think)" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of ب",
          expected: "ba",
          altAccepted: ["bā", "baa", "b"],
          hint: "One dot below.",
        },
        {
          kind: "listen",
          prompt: "Which letter do you hear?",
          speak: "ثَ",
          choices: ["bā", "tā", "thā", "alif"],
          correctIndex: 2,
        },
        {
          kind: "info",
          title: "Wrap-up",
          body:
            "You just learned the dot-pattern trick — it applies everywhere in Arabic. ب ت ث share a body; only the dots change the sound. Same will be true for ج ح خ, and for د ذ, and for ر ز.",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.3",
      levelId: "L1",
      order: 3,
      title: "Jīm, Ḥā, Khā",
      subtitle: "Three letters, one body",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 40,
      prerequisites: ["L1.2"],
      summary: "ج ح خ — identical shape, different throat.",
      wrapUp: "You just met the first throat sound: ح. That one is Arabic's signature.",
      activities: [
        {
          kind: "info",
          title: "ج ح خ",
          body:
            "These three share a body shaped like a teardrop with a hook.\n" +
            "  ج — dot INSIDE → 'j' (jīm)\n" +
            "  ح — NO dot → a deep H from the throat (ḥā)\n" +
            "  خ — dot ABOVE → 'kh' as in Bach (khā)\n\n" +
            "ح is one of the famous throat letters. It's a breathy H, deeper than English H. Say 'hah' and push it from below your Adam's apple.",
          showcase: [
            { ar: "ج", translit: "jīm", en: "j" },
            { ar: "ح", translit: "ḥā", en: "deep H", note: "Pushed from the throat." },
            { ar: "خ", translit: "khā", en: "kh", note: "Like clearing your throat gently." },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ح",
          question: "Which letter is this?",
          choices: ["jīm (j)", "ḥā (deep H)", "khā (kh)", "hā (light h)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ج",
          question: "Which letter is this?",
          choices: ["ḥā", "jīm", "khā", "tā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "خ",
          question: "Which letter is this?",
          choices: ["khā", "jīm", "ḥā", "thā"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "ج", en: "j" },
            { ar: "ح", en: "deep H" },
            { ar: "خ", en: "kh (Bach)" },
          ],
        },
        {
          kind: "listen",
          prompt: "Which letter do you hear?",
          speak: "خَ",
          choices: ["jīm", "ḥā", "khā", "hā"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of ج",
          expected: "j",
          altAccepted: ["jim", "jīm"],
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.4",
      levelId: "L1",
      order: 4,
      title: "Dāl, Dhāl, Rā, Zāy",
      subtitle: "The non-connector family (first half)",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 40,
      prerequisites: ["L1.3"],
      summary: "د ذ ر ز — these don't connect to the next letter.",
      wrapUp: "You just met the non-connectors. When they appear, the letter after them starts fresh.",
      activities: [
        {
          kind: "info",
          title: "د ذ ر ز",
          body:
            "Four letters that never connect to the letter AFTER them:\n" +
            "  د — dāl → 'd'\n" +
            "  ذ — dhāl → 'th' as in 'this'\n" +
            "  ر — rā → rolled 'r' (like Spanish 'r')\n" +
            "  ز — zāy → 'z'\n\n" +
            "Note the paired dots again: د / ذ differ by a single dot, as do ر / ز.",
          showcase: [
            { ar: "د", translit: "dāl", en: "d" },
            { ar: "ذ", translit: "dhāl", en: "th (this)" },
            { ar: "ر", translit: "rā", en: "rolled r" },
            { ar: "ز", translit: "zāy", en: "z" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "د",
          question: "Which letter is this?",
          choices: ["dāl (d)", "dhāl (th)", "rā (r)", "zāy (z)"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ذ",
          question: "Which letter is this?",
          choices: ["dāl", "dhāl", "thā", "zāy"],
          correctIndex: 1,
          explain: "A dot on top of dāl turns 'd' into 'th' (as in 'this').",
        },
        {
          kind: "mcq",
          arabicPrompt: "ز",
          question: "Which letter is this?",
          choices: ["rā", "zāy", "dāl", "thā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which of these four letters does NOT connect to the next letter?",
          choices: ["ب", "ت", "ر", "ج"],
          correctIndex: 2,
          explain: "د ذ ر ز are all non-connectors. So are و and ا.",
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "د", en: "d" },
            { ar: "ذ", en: "th (this)" },
            { ar: "ر", en: "rolled r" },
            { ar: "ز", en: "z" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of ر",
          expected: "r",
          altAccepted: ["ra", "rā"],
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.5",
      levelId: "L1",
      order: 5,
      title: "Sīn, Shīn",
      subtitle: "Two letters, built from three teeth",
      theme: "alphabet",
      estimatedMinutes: 20,
      xp: 35,
      prerequisites: ["L1.4"],
      summary: "س and ش — three little teeth, with or without dots.",
      wrapUp: "Now you know the three-tooth letters. They show up constantly.",
      activities: [
        {
          kind: "info",
          title: "س ش",
          body:
            "Both have a three-tooth body that looks like a small wave:\n" +
            "  س — no dots → 's'\n" +
            "  ش — three dots above → 'sh'\n\n" +
            "'Shams' (شَمْس) means 'sun' and is one of the most famous Arabic words.",
          showcase: [
            { ar: "س", translit: "sīn", en: "s" },
            { ar: "ش", translit: "shīn", en: "sh" },
            { ar: "شَمْس", translit: "shams", en: "sun" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "س",
          question: "Which letter is this?",
          choices: ["sīn (s)", "shīn (sh)", "ṣād (heavy s)", "sīn (deep s)"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ش",
          question: "Which letter is this?",
          choices: ["sīn", "shīn", "thā", "ṣād"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "س", en: "s" },
            { ar: "ش", en: "sh" },
          ],
        },
        {
          kind: "typing",
          prompt: "The word شمس means 'sun'. Type its transliteration.",
          expected: "shams",
          hint: "sh-a-m-s",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.6",
      levelId: "L1",
      order: 6,
      title: "Level 1 Review",
      subtitle: "Lock in the first 14 letters",
      theme: "review",
      estimatedMinutes: 25,
      xp: 60,
      prerequisites: ["L1.2", "L1.3", "L1.4", "L1.5"],
      summary: "Rapid-fire review of every letter you've met so far.",
      wrapUp: "Level 1 complete. The second half of the alphabet is next — and it shares many patterns with what you already know.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "ث",
          question: "Which letter?",
          choices: ["tā", "thā", "bā", "sīn"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ح",
          question: "Which letter?",
          choices: ["jīm", "ḥā", "khā", "hā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ذ",
          question: "Which letter?",
          choices: ["dāl", "dhāl", "zāy", "rā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ش",
          question: "Which letter?",
          choices: ["sīn", "shīn", "thā", "ṣād"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which of these does NOT connect to the next letter?",
          choices: ["ب", "ج", "ر", "س"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which letter is pronounced from deep in the throat (a breathy H)?",
          choices: ["ه", "ح", "خ", "ج"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match each letter to its sound",
          pairs: [
            { ar: "ب", en: "b" },
            { ar: "ت", en: "t" },
            { ar: "ج", en: "j" },
            { ar: "ح", en: "deep H" },
            { ar: "د", en: "d" },
            { ar: "ر", en: "r" },
            { ar: "س", en: "s" },
            { ar: "ش", en: "sh" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of the word شمس (sun).",
          expected: "shams",
        },
      ],
    },
  ],
};
