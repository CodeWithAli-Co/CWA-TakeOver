// ============================================================================
// LEVEL 2 — The rest of the alphabet (letters 15–28) + emphatic sounds
// ============================================================================

import type { Level } from "../types";

export const level2: Level = {
  id: "L2",
  order: 2,
  title: "Completing the Alphabet",
  subtitle: "The heavy letters, the throaty ones, and the rest",
  theme: "alphabet",
  goal: "Recognize and pronounce the remaining 14 letters — including the emphatic and throat letters.",
  lessons: [
    {
      id: "L2.1",
      levelId: "L2",
      order: 1,
      title: "Ṣād, Ḍād — the emphatic family",
      subtitle: "Arabic's 'heavy' consonants",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 45,
      prerequisites: ["L1.6"],
      summary: "ص ض — heavy versions of س and د. Say them with a fat tongue.",
      wrapUp: "ض is so Arabic-specific that Arabic itself is called 'the language of ḍād'.",
      activities: [
        {
          kind: "info",
          title: "The emphatic letters",
          body:
            "Arabic has 'heavy' versions of some letters that make the vowels around them sound thicker.\n" +
            "  ص — ṣād → heavy S (tongue flat, mouth fuller)\n" +
            "  ض — ḍād → heavy D (pronounced with the side of the tongue pressing the molars)\n\n" +
            "Tip: compare سَيف (sayf = sword) vs صَيف (ṣayf = summer). Totally different words, one letter apart.",
          showcase: [
            { ar: "ص", translit: "ṣād", en: "heavy S" },
            { ar: "ض", translit: "ḍād", en: "heavy D" },
            { ar: "صَيف", translit: "ṣayf", en: "summer" },
            { ar: "سَيف", translit: "sayf", en: "sword" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ص",
          question: "Which letter?",
          choices: ["sīn (s)", "ṣād (heavy S)", "shīn (sh)", "zāy (z)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ض",
          question: "Which letter?",
          choices: ["dāl", "dhāl", "ḍād", "ẓā"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "صَيف means:",
          choices: ["sword", "summer", "light", "guest"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L2.2",
      levelId: "L2",
      order: 2,
      title: "Ṭā, Ẓā",
      subtitle: "More heavy letters",
      theme: "alphabet",
      estimatedMinutes: 20,
      xp: 40,
      prerequisites: ["L2.1"],
      summary: "ط ظ — the heavy versions of ت and ذ.",
      wrapUp: "Four down in the emphatic family: ص ض ط ظ.",
      activities: [
        {
          kind: "info",
          title: "ط ظ",
          body:
            "ط — ṭā → heavy T (flat tongue, full mouth)\n" +
            "ظ — ẓā → heavy 'th' as in 'this' (also flat-tongued)\n\n" +
            "Compare: تِين (tīn = figs) vs طِين (ṭīn = clay, mud).",
          showcase: [
            { ar: "ط", translit: "ṭā", en: "heavy T" },
            { ar: "ظ", translit: "ẓā", en: "heavy th" },
            { ar: "طِين", translit: "ṭīn", en: "clay / mud" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ط",
          question: "Which letter?",
          choices: ["tā", "ṭā (heavy T)", "ẓā", "thā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ظ",
          question: "Which letter?",
          choices: ["ẓā", "ḍād", "dhāl", "thā"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "ص", en: "heavy S" },
            { ar: "ض", en: "heavy D" },
            { ar: "ط", en: "heavy T" },
            { ar: "ظ", en: "heavy th" },
          ],
        },
      ],
    },

    {
      id: "L2.3",
      levelId: "L2",
      order: 3,
      title: "ʿAyn, Ghayn",
      subtitle: "The two throat-garglers",
      theme: "pronunciation",
      estimatedMinutes: 25,
      xp: 50,
      prerequisites: ["L2.2"],
      summary: "ع ـ غ — the hardest letters for English speakers. Worth the effort.",
      wrapUp: "ع shows up in names you already know — Ali (عَلي), Omar (عُمَر). Listen for it everywhere.",
      activities: [
        {
          kind: "info",
          title: "ع — ʿayn",
          body:
            "ʿAyn is produced by constricting the throat and making a voiced sound — almost like you're about to gag lightly. It's not an English sound at all.\n\n" +
            "In transliteration, we write it as an apostrophe or ʿ (e.g., 'Ali' is really ʿAlī — عَلي).",
          tip: "Don't pronounce it like a regular 'a'. Engage the throat.",
        },
        {
          kind: "info",
          title: "غ — ghayn",
          body:
            "Ghayn is like a French 'r' or the sound of gargling water — a voiced kh. Same throat location, but with voice added.",
          showcase: [
            { ar: "ع", translit: "ʿayn", en: "throat stop (ʿ)" },
            { ar: "غ", translit: "ghayn", en: "voiced kh / gargled r" },
            { ar: "عَلي", translit: "ʿAlī", en: "Ali (name)" },
            { ar: "غَداً", translit: "ghadan", en: "tomorrow" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ع",
          question: "Which letter?",
          choices: ["ʿayn", "ghayn", "ḥā", "khā"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "غ",
          question: "Which letter?",
          choices: ["ʿayn", "ghayn", "qāf", "khā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The name 'Ali' (عَلي) begins with which letter?",
          choices: ["alif", "ʿayn", "hā", "ghayn"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L2.4",
      levelId: "L2",
      order: 4,
      title: "Fā, Qāf",
      subtitle: "The deep-back K",
      theme: "alphabet",
      estimatedMinutes: 20,
      xp: 40,
      prerequisites: ["L2.3"],
      summary: "ف ق — 'f' and a 'k' made from the back of the throat.",
      wrapUp: "ق (qāf) is what makes 'Qur'an' sound different from 'Koran' — it's deeper.",
      activities: [
        {
          kind: "info",
          title: "ف ق",
          body:
            "ف — fā → 'f' (one dot above)\n" +
            "ق — qāf → a 'k' produced at the back of the throat (two dots above)\n\n" +
            "Compare كَلب (kalb = dog) with قَلب (qalb = heart). Different letter, different word.",
          showcase: [
            { ar: "ف", translit: "fā", en: "f" },
            { ar: "ق", translit: "qāf", en: "deep K" },
            { ar: "قَلب", translit: "qalb", en: "heart" },
            { ar: "كَلب", translit: "kalb", en: "dog" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ف",
          question: "Which letter?",
          choices: ["fā (f)", "qāf", "kāf", "thā"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ق",
          question: "Which letter?",
          choices: ["fā", "qāf", "kāf", "ghayn"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "قَلب means:",
          choices: ["dog", "heart", "book", "hand"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L2.5",
      levelId: "L2",
      order: 5,
      title: "Kāf, Lām, Mīm, Nūn",
      subtitle: "Four of the most common letters in Arabic",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 45,
      prerequisites: ["L2.4"],
      summary: "ك ل م ن — you'll see these in almost every sentence.",
      wrapUp: "Together, ل + ا make a special joined form لا ('lā' = 'no / not'). We'll see it constantly.",
      activities: [
        {
          kind: "info",
          title: "ك ل م ن",
          body:
            "ك — kāf → 'k' (regular, front-of-mouth)\n" +
            "ل — lām → 'l'\n" +
            "م — mīm → 'm'\n" +
            "ن — nūn → 'n'\n\n" +
            "These four show up in nearly every Arabic sentence — kitāb (book), maktab (office), man (who), anā (I).",
          showcase: [
            { ar: "ك", translit: "kāf", en: "k" },
            { ar: "ل", translit: "lām", en: "l" },
            { ar: "م", translit: "mīm", en: "m" },
            { ar: "ن", translit: "nūn", en: "n" },
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "ماء", translit: "māʾ", en: "water" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ك",
          question: "Which letter?",
          choices: ["qāf", "kāf", "lām", "fā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ل",
          question: "Which letter?",
          choices: ["alif", "lām", "mīm", "nūn"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "م",
          question: "Which letter?",
          choices: ["mīm", "nūn", "lām", "sīn"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ن",
          question: "Which letter?",
          choices: ["tā", "thā", "nūn", "yā"],
          correctIndex: 2,
          explain: "Nūn has one dot above. The rounded bowl shape distinguishes it from ب/ت/ث.",
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "ك", en: "k" },
            { ar: "ل", en: "l" },
            { ar: "م", en: "m" },
            { ar: "ن", en: "n" },
          ],
        },
      ],
    },

    {
      id: "L2.6",
      levelId: "L2",
      order: 6,
      title: "Hā, Wāw, Yā — and the Hamza",
      subtitle: "The last three letters + the glottal stop",
      theme: "alphabet",
      estimatedMinutes: 25,
      xp: 50,
      prerequisites: ["L2.5"],
      summary: "ه و ي — plus the mysterious ء (hamza), which isn't really a letter.",
      wrapUp: "Congratulations — you now recognize all 28 letters of the Arabic alphabet.",
      activities: [
        {
          kind: "info",
          title: "ه و ي",
          body:
            "ه — hā → light 'h' (like English 'hi')\n" +
            "و — wāw → 'w' or long 'ū' (oo) — and it's a non-connector\n" +
            "ي — yā → 'y' or long 'ī' (ee)\n\n" +
            "و and ي act as BOTH consonants (w/y) AND long vowels (ū/ī) depending on context. That's perfectly normal in Arabic.",
          showcase: [
            { ar: "ه", translit: "hā", en: "h" },
            { ar: "و", translit: "wāw", en: "w / long ū" },
            { ar: "ي", translit: "yā", en: "y / long ī" },
          ],
        },
        {
          kind: "info",
          title: "ء — the hamza",
          body:
            "Hamza is a glottal stop — the catch in the throat between 'uh' and 'oh' when you say 'uh-oh'.\n\n" +
            "It can sit alone (ء) or perch on a carrier letter (أ إ ؤ ئ). You'll see it in words like أَنا ('anā' = I) and قُرآن (Qurʾān).",
          showcase: [
            { ar: "ء", translit: "hamza", en: "glottal stop" },
            { ar: "أَنا", translit: "anā", en: "I" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "و",
          question: "Which letter?",
          choices: ["wāw", "yā", "hā", "alif"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ي",
          question: "Which letter?",
          choices: ["tā", "yā", "bā", "nūn"],
          correctIndex: 1,
          explain: "Two dots below — yā.",
        },
        {
          kind: "mcq",
          question: "و is a non-connector. That means:",
          choices: [
            "It never appears at the end of a word",
            "The letter AFTER it starts fresh (doesn't connect)",
            "It is silent",
            "It has no dots",
          ],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L2.7",
      levelId: "L2",
      order: 7,
      title: "Level 2 Review — All 28 Letters",
      subtitle: "Full alphabet rapid check",
      theme: "review",
      estimatedMinutes: 30,
      xp: 90,
      prerequisites: ["L2.1", "L2.2", "L2.3", "L2.4", "L2.5", "L2.6"],
      summary: "You know the alphabet — now prove it.",
      wrapUp: "The alphabet is behind you. Next level: harakat — the vowel marks that bring letters to life as words.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "ض",
          question: "Which letter?",
          choices: ["dāl", "dhāl", "ḍād", "ẓā"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ع",
          question: "Which letter?",
          choices: ["ghayn", "ʿayn", "ḥā", "hā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ق",
          question: "Which letter?",
          choices: ["fā", "kāf", "qāf", "ghayn"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ط",
          question: "Which letter?",
          choices: ["tā", "ṭā", "ẓā", "ḍād"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which pair sounds EMPHATIC (heavy)?",
          choices: ["ت / د", "ص / ض", "س / ش", "ج / ح"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The letter ء (hamza) represents:",
          choices: ["a long vowel", "a glottal stop", "a silent letter", "the number one"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Final match — pick the sound for each letter",
          pairs: [
            { ar: "ق", en: "deep K" },
            { ar: "ك", en: "k" },
            { ar: "ع", en: "throat ʿ" },
            { ar: "غ", en: "gargled gh" },
            { ar: "ف", en: "f" },
            { ar: "ه", en: "light h" },
            { ar: "و", en: "w / long ū" },
            { ar: "ي", en: "y / long ī" },
          ],
        },
      ],
    },
  ],
};
