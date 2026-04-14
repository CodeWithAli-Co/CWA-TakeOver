// ============================================================================
// LEVEL 3 — Harakat (vowel marks) + letter forms + first real reading
// ============================================================================

import type { Level } from "../types";

export const level3: Level = {
  id: "L3",
  order: 3,
  title: "Vowels and Letter Forms",
  subtitle: "Bringing the letters to life",
  theme: "harakat",
  goal: "Read short Arabic words using the vowel marks and understand how letters change shape when connected.",
  lessons: [
    {
      id: "L3.1",
      levelId: "L3",
      order: 1,
      title: "Fatḥa, Kasra, Ḍamma",
      subtitle: "The three short vowels",
      theme: "harakat",
      estimatedMinutes: 25,
      xp: 50,
      prerequisites: ["L2.7"],
      summary: "ـَ ـِ ـُ — the three little marks that tell you which vowel to say.",
      wrapUp: "You can now read تَ, تِ, تُ — 'ta', 'ti', 'tu'. That's real Arabic reading.",
      activities: [
        {
          kind: "info",
          title: "The three short vowels",
          body:
            "Harakat are small marks written ABOVE or BELOW a letter to show its vowel.\n\n" +
            "  ـَ (fatḥa) — small slash ABOVE → 'a' (like 'ah')\n" +
            "  ـِ (kasra) — small slash BELOW → 'i' (like 'ih')\n" +
            "  ـُ (ḍamma) — tiny comma-like mark ABOVE → 'u' (like 'oo' short)\n\n" +
            "Without these marks, you still see the letters — native readers infer vowels from context. We keep them on while you learn.",
          showcase: [
            { ar: "بَ", translit: "ba", en: "letter بـ with fatḥa" },
            { ar: "بِ", translit: "bi", en: "letter بـ with kasra" },
            { ar: "بُ", translit: "bu", en: "letter بـ with ḍamma" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "تَ",
          question: "How is this pronounced?",
          choices: ["ti", "tu", "ta", "t"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "تِ",
          question: "How is this pronounced?",
          choices: ["ta", "ti", "tu", "t"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "تُ",
          question: "How is this pronounced?",
          choices: ["ta", "ti", "tu", "at"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "Type how مَ is pronounced",
          expected: "ma",
          altAccepted: ["mā"],
        },
        {
          kind: "typing",
          prompt: "Type how كِ is pronounced",
          expected: "ki",
        },
        {
          kind: "typing",
          prompt: "Type how نُ is pronounced",
          expected: "nu",
        },
      ],
    },

    {
      id: "L3.2",
      levelId: "L3",
      order: 2,
      title: "Sukūn & Shadda",
      subtitle: "No vowel, and double consonant",
      theme: "harakat",
      estimatedMinutes: 25,
      xp: 45,
      prerequisites: ["L3.1"],
      summary: "ـْ and ـّ — 'stop' and 'double'.",
      wrapUp: "You can now read multi-letter words like مَكْتَب (office).",
      activities: [
        {
          kind: "info",
          title: "Sukūn ـْ",
          body:
            "A small circle ABOVE a letter = 'no vowel' here. The letter is pronounced alone, closing the previous syllable.\n\n" +
            "مَكْتَب → mak-tab → 'office'. The ك carries a sukūn, so it's just 'k' (no vowel after).",
          showcase: [
            { ar: "مَكْتَب", translit: "maktab", en: "office, desk" },
            { ar: "بِنْت", translit: "bint", en: "girl" },
          ],
        },
        {
          kind: "info",
          title: "Shadda ـّ",
          body:
            "A small 'w'-like sign ABOVE a letter = DOUBLE that consonant. Hold it slightly longer.\n\n" +
            "مُدَرِّس → mudarris → 'teacher'. The ر carries a shadda, so it's pronounced 'rr'.",
          showcase: [
            { ar: "مُدَرِّس", translit: "mudarris", en: "teacher (male)" },
            { ar: "سُكَّر", translit: "sukkar", en: "sugar" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "بِنْت",
          question: "How is this pronounced?",
          choices: ["banat", "bint", "bunt", "bant"],
          correctIndex: 1,
          explain: "Kasra under ب = 'bi', sukūn on ن = 'n' closes the syllable, ت = 't'. Together: bint ('girl').",
        },
        {
          kind: "mcq",
          arabicPrompt: "سُكَّر",
          question: "How is this pronounced?",
          choices: ["sukar", "sukkar", "sakkar", "sikar"],
          correctIndex: 1,
          explain: "The shadda on ك doubles it — 'sukkar' ('sugar'). Yes, this is where English 'sugar' comes from.",
        },
        {
          kind: "typing",
          prompt: "مَكْتَب means 'office / desk'. Type the transliteration.",
          expected: "maktab",
        },
      ],
    },

    {
      id: "L3.3",
      levelId: "L3",
      order: 3,
      title: "Tanwīn & Long Vowels",
      subtitle: "Doubled endings and stretched vowels",
      theme: "harakat",
      estimatedMinutes: 25,
      xp: 50,
      prerequisites: ["L3.2"],
      summary: "ـً ـٍ ـٌ and long 'ā', 'ī', 'ū'.",
      wrapUp: "You've now met every basic reading mark. Real reading begins next lesson.",
      activities: [
        {
          kind: "info",
          title: "Tanwīn — the 'n' endings",
          body:
            "Doubled harakat at the END of a noun add an 'n' sound:\n" +
            "  ـً (fatḥatān) → 'an' (ex: شُكْراً → shukran → 'thanks')\n" +
            "  ـٍ (kasratān) → 'in'\n" +
            "  ـٌ (ḍammatān) → 'un'\n\n" +
            "These show the noun is indefinite ('a book', not 'the book').",
          showcase: [
            { ar: "شُكْراً", translit: "shukran", en: "thanks" },
            { ar: "أَهْلاً", translit: "ahlan", en: "hello / welcome" },
          ],
        },
        {
          kind: "info",
          title: "Long vowels",
          body:
            "Short vowel + a matching letter = long vowel:\n" +
            "  ـَ + ا → 'ā' (long a)     e.g., بَاب → bāb (door)\n" +
            "  ـِ + ي → 'ī' (long ee)    e.g., فِي → fī (in)\n" +
            "  ـُ + و → 'ū' (long oo)    e.g., نُور → nūr (light)",
          showcase: [
            { ar: "بَاب", translit: "bāb", en: "door" },
            { ar: "فِي", translit: "fī", en: "in" },
            { ar: "نُور", translit: "nūr", en: "light" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "شُكْراً",
          question: "How is this pronounced?",
          choices: ["shukra", "shukran", "shokra", "shokraan"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "بَاب",
          question: "How is this pronounced?",
          choices: ["bab", "bāb (long ā)", "bīb", "bub"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type the Arabic transliteration of نُور (light).",
          expected: "nur",
          altAccepted: ["nūr", "noor"],
        },
      ],
    },

    {
      id: "L3.4",
      levelId: "L3",
      order: 4,
      title: "Letter Forms — Isolated, Initial, Medial, Final",
      subtitle: "Why the same letter can look different",
      theme: "alphabet",
      estimatedMinutes: 30,
      xp: 60,
      prerequisites: ["L3.3"],
      summary: "One letter, up to four shapes — depending on position.",
      wrapUp: "You're no longer just seeing letters — you're seeing *connected* letters, which is how Arabic actually appears in print.",
      activities: [
        {
          kind: "info",
          title: "Why shapes change",
          body:
            "Arabic is cursive. Each letter has up to four forms:\n" +
            "  • Isolated — stands alone\n" +
            "  • Initial — beginning of a word\n" +
            "  • Medial — middle of a word\n" +
            "  • Final — end of a word\n\n" +
            "Example — the letter ب:\n" +
            "  Isolated: ب\n" +
            "  Initial:  بـ\n" +
            "  Medial:  ـبـ\n" +
            "  Final:   ـب",
          showcase: [
            { ar: "ب / بـ / ـبـ / ـب", translit: "bā — four forms", en: "same letter, 4 shapes" },
            { ar: "ع / عـ / ـعـ / ـع", translit: "ʿayn — four forms", en: "note how much ʿayn changes" },
          ],
        },
        {
          kind: "info",
          title: "Non-connectors",
          body:
            "Six letters don't connect to the letter AFTER them — so the next letter starts fresh in its initial form.\n\n" +
            "The six non-connectors: ا  د  ذ  ر  ز  و\n\n" +
            "That's why د in دَرَس ('he studied') has a clear break after it.",
        },
        {
          kind: "trace",
          prompt: "Which is the INITIAL form of ب?",
          target: "بـ",
          choices: ["ـب", "بـ", "ـبـ", "ب"],
          correctIndex: 1,
        },
        {
          kind: "trace",
          prompt: "Which is the FINAL form of م?",
          target: "ـم",
          choices: ["ـمـ", "م", "ـم", "مـ"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which of these is a non-connector (doesn't join the next letter)?",
          choices: ["ب", "ت", "ر", "ن"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L3.5",
      levelId: "L3",
      order: 5,
      title: "Reading Your First Words",
      subtitle: "Put it all together",
      theme: "reading",
      estimatedMinutes: 30,
      xp: 80,
      prerequisites: ["L3.4"],
      summary: "Short, real words — you can actually read them now.",
      wrapUp: "You just read Arabic. Not a letter — whole words, with vowels and meaning.",
      activities: [
        {
          kind: "info",
          title: "Common everyday words",
          body: "These are some of the most frequent words in Arabic. Read each one aloud.",
          showcase: [
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "بَيت", translit: "bayt", en: "house" },
            { ar: "ماء", translit: "māʾ", en: "water" },
            { ar: "قَلَم", translit: "qalam", en: "pen" },
            { ar: "وَلَد", translit: "walad", en: "boy" },
            { ar: "بِنْت", translit: "bint", en: "girl" },
            { ar: "بابُ", translit: "bābu", en: "door" },
            { ar: "شَمس", translit: "shams", en: "sun" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "كِتاب",
          question: "What does this mean?",
          choices: ["pen", "book", "desk", "chair"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "بَيت",
          question: "What does this mean?",
          choices: ["between", "house", "egg", "country"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "قَلَم",
          question: "What does this mean?",
          choices: ["pen", "pencil", "paper", "book"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match the Arabic word to its English meaning",
          pairs: [
            { ar: "كِتاب", en: "book" },
            { ar: "بَيت", en: "house" },
            { ar: "ماء", en: "water" },
            { ar: "شَمس", en: "sun" },
            { ar: "وَلَد", en: "boy" },
            { ar: "بِنْت", en: "girl" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'shams' (sun) — just the transliteration.",
          expected: "shams",
        },
        {
          kind: "typing",
          prompt: "Type 'bayt' (house) — just the transliteration.",
          expected: "bayt",
        },
      ],
    },

    {
      id: "L3.6",
      levelId: "L3",
      order: 6,
      title: "Level 3 Review",
      subtitle: "Vowels, forms, and first reading",
      theme: "review",
      estimatedMinutes: 25,
      xp: 80,
      prerequisites: ["L3.5"],
      summary: "Lock in everything from this level.",
      wrapUp: "Script, vowels, and basic reading are behind you. Time to learn what to SAY.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "بِ",
          question: "How is this pronounced?",
          choices: ["ba", "bi", "bu", "b"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "كُ",
          question: "How is this pronounced?",
          choices: ["ka", "ki", "ku", "kū"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "The mark ـْ (small circle) is called:",
          choices: ["fatḥa", "sukūn", "shadda", "kasra"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The mark ـّ is called shadda. It means:",
          choices: ["no vowel", "long vowel", "doubled consonant", "indefinite ending"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "شُكْراً",
          question: "This word means:",
          choices: ["hello", "thank you", "please", "goodbye"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "How many letters are non-connectors?",
          choices: ["4", "6", "8", "10"],
          correctIndex: 1,
          explain: "Six: ا د ذ ر ز و",
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "كِتاب", en: "book" },
            { ar: "قَلَم", en: "pen" },
            { ar: "بَيت", en: "house" },
            { ar: "ماء", en: "water" },
            { ar: "شَمس", en: "sun" },
          ],
        },
      ],
    },
  ],
};
