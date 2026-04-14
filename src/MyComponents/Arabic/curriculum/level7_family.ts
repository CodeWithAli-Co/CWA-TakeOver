// ============================================================================
// LEVEL 7 — Family, people, and description
// ============================================================================

import type { Level } from "../types";

export const level7: Level = {
  id: "L7",
  order: 7,
  title: "Family & People",
  subtitle: "Talk about who's in your life",
  theme: "family",
  goal: "Name family members and describe people with basic adjectives.",
  lessons: [
    {
      id: "L7.1",
      levelId: "L7",
      order: 1,
      title: "Immediate Family",
      subtitle: "Parents, siblings, children",
      theme: "family",
      estimatedMinutes: 25,
      xp: 60,
      prerequisites: ["L6.6"],
      summary: "ab, umm, akh, ukht, ibn, bint.",
      wrapUp: "Notice how each word has a masculine and feminine version. That's Arabic's rhythm.",
      activities: [
        {
          kind: "info",
          title: "Core family",
          body:
            "أَب (ab) — father\n" +
            "أُمّ (umm) — mother\n" +
            "أَخ (akh) — brother\n" +
            "أُخْت (ukht) — sister\n" +
            "اِبْن (ibn) — son\n" +
            "بِنْت (bint) — daughter / girl\n" +
            "زَوْج (zawj) — husband\n" +
            "زَوْجَة (zawja) — wife",
          showcase: [
            { ar: "أَب", translit: "ab", en: "father" },
            { ar: "أُمّ", translit: "umm", en: "mother" },
            { ar: "أَخ", translit: "akh", en: "brother" },
            { ar: "أُخْت", translit: "ukht", en: "sister" },
            { ar: "اِبْن", translit: "ibn", en: "son" },
            { ar: "بِنْت", translit: "bint", en: "daughter" },
          ],
        },
        {
          kind: "mcq",
          question: "'akh' means:",
          choices: ["father", "brother", "son", "friend"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'umm' means:",
          choices: ["mother", "aunt", "sister", "daughter"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match family word to English",
          pairs: [
            { ar: "أَب", en: "father" },
            { ar: "أُمّ", en: "mother" },
            { ar: "أَخ", en: "brother" },
            { ar: "أُخْت", en: "sister" },
            { ar: "اِبْن", en: "son" },
            { ar: "بِنْت", en: "daughter" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the word for 'mother' (transliteration).",
          expected: "umm",
        },
      ],
    },

    {
      id: "L7.2",
      levelId: "L7",
      order: 2,
      title: "Possessive Endings — 'my family'",
      subtitle: "ī, ka, ki, hu, hā",
      theme: "grammar",
      estimatedMinutes: 25,
      xp: 65,
      prerequisites: ["L7.1"],
      summary: "Attach a suffix to a word to show possession.",
      wrapUp: "Possessive suffixes are everywhere in Arabic. You'll recognize them now every time.",
      activities: [
        {
          kind: "info",
          title: "Attached possessives",
          body:
            "Instead of separate words, Arabic sticks possessives onto the noun:\n\n" +
            "  ـي (ī) — my        → كِتابي (kitābī) = my book\n" +
            "  ـكَ (ka) — your (m) → كِتابُكَ (kitābuka) = your book (m)\n" +
            "  ـكِ (ki) — your (f) → كِتابُكِ (kitābuki)\n" +
            "  ـهُ (hu) — his      → كِتابُهُ (kitābuhu)\n" +
            "  ـها (hā) — her     → كِتابُها (kitābuhā)\n\n" +
            "So: أَبي (abī) = my father. أُمّي (ummī) = my mother. اِسْمُكَ (ismuka) = your (m) name.",
          showcase: [
            { ar: "أَبي", translit: "abī", en: "my father" },
            { ar: "أُمّي", translit: "ummī", en: "my mother" },
            { ar: "أَخوهُ", translit: "akhūhu", en: "his brother" },
            { ar: "اِبْنُها", translit: "ibnuhā", en: "her son" },
          ],
        },
        {
          kind: "mcq",
          question: "'kitābī' means:",
          choices: ["your book", "his book", "my book", "her book"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To say 'her son', you attach which ending to ibn?",
          choices: ["ī", "ka", "hu", "hā"],
          correctIndex: 3,
        },
        {
          kind: "fillblank",
          prompt: "اِسْمُ ____ حَنيف. (His name is Hanif.)",
          blank: "hu",
          en: "his",
          choices: ["ī", "ka", "hu", "hā"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "Type 'my mother' (ummī).",
          expected: "ummi",
          altAccepted: ["ummī"],
        },
      ],
    },

    {
      id: "L7.3",
      levelId: "L7",
      order: 3,
      title: "Describing People",
      subtitle: "Big, small, tall, short, kind",
      theme: "family",
      estimatedMinutes: 25,
      xp: 60,
      prerequisites: ["L7.2"],
      summary: "Adjectives always match gender — you'll see.",
      wrapUp: "Adjectives follow the noun AND must match its gender. That's the big rule.",
      activities: [
        {
          kind: "info",
          title: "Basic adjectives",
          body:
            "كَبير / كَبيرَة (kabīr/kabīra) — big, old\n" +
            "صَغير / صَغيرَة (ṣaghīr/ṣaghīra) — small, young\n" +
            "طَويل / طَويلَة (ṭawīl/ṭawīla) — tall, long\n" +
            "قَصير / قَصيرَة (qaṣīr/qaṣīra) — short\n" +
            "جَميل / جَميلَة (jamīl/jamīla) — beautiful, handsome\n" +
            "طَيِّب / طَيِّبَة (ṭayyib/ṭayyiba) — kind, good\n" +
            "جَديد / جَديدَة (jadīd/jadīda) — new\n" +
            "قَديم / قَديمَة (qadīm/qadīma) — old (thing)\n\n" +
            "Rule: adjective comes AFTER the noun and matches its gender.\n" +
            "  بَيت كَبير (bayt kabīr) = a big house  (masculine)\n" +
            "  مَدينَة كَبيرَة (madīna kabīra) = a big city  (feminine)",
          showcase: [
            { ar: "بَيت كَبير", translit: "bayt kabīr", en: "a big house" },
            { ar: "مَدينَة جَميلَة", translit: "madīna jamīla", en: "a beautiful city" },
            { ar: "وَلَد صَغير", translit: "walad ṣaghīr", en: "a small boy" },
            { ar: "بِنْت طَويلَة", translit: "bint ṭawīla", en: "a tall girl" },
          ],
        },
        {
          kind: "mcq",
          question: "'kabīra' would be used to describe:",
          choices: ["a boy", "a girl", "a book", "two men"],
          correctIndex: 1,
          explain: "The ـة ending = feminine. Use the feminine adjective for feminine nouns.",
        },
        {
          kind: "mcq",
          question: "'bint ṭawīla' means:",
          choices: ["a tall boy", "a tall girl", "a short girl", "a beautiful girl"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "بَيت ____. (a new house)",
          blank: "jadīd",
          en: "new",
          choices: ["jadīd", "jadīda", "kabīr", "qadīm"],
          correctIndex: 0,
          explain: "bayt is masculine, so the adjective stays masculine: jadīd.",
        },
        {
          kind: "fillblank",
          prompt: "سَيّارَة ____. (a beautiful car)",
          blank: "jamīla",
          en: "beautiful (f)",
          choices: ["jamīl", "jamīla", "ṣaghīr", "ṭawīl"],
          correctIndex: 1,
          explain: "sayyāra (car) is feminine (ends in ـة), so the adjective is feminine: jamīla.",
        },
      ],
    },

    {
      id: "L7.4",
      levelId: "L7",
      order: 4,
      title: "Dialogue + Review",
      subtitle: "Family in conversation",
      theme: "review",
      estimatedMinutes: 25,
      xp: 75,
      prerequisites: ["L7.3"],
      summary: "A short family conversation you can now read.",
      wrapUp: "Level 7 complete. You can now talk about people in your life.",
      activities: [
        {
          kind: "dialogue",
          prompt: "Read the dialogue carefully.",
          lines: [
            { speaker: "A", ar: "هَل لَدَيْكَ أَخ؟", translit: "hal ladayka akh?", en: "Do you have a brother?" },
            { speaker: "B", ar: "نَعَم، لَدَيَّ أَخ صَغير.", translit: "naʿam, ladayya akh ṣaghīr.", en: "Yes, I have a small (young) brother." },
            { speaker: "A", ar: "ما اسْمُهُ؟", translit: "mā smuhu?", en: "What's his name?" },
            { speaker: "B", ar: "اِسْمُهُ عُمَر.", translit: "ismuhu ʿUmar.", en: "His name is Omar." },
            { speaker: "A", ar: "وَكَمْ عُمْرُهُ؟", translit: "wa kam ʿumruhu?", en: "And how old is he?" },
            { speaker: "B", ar: "عُمْرُهُ سَبْعَة.", translit: "ʿumruhu sabʿa.", en: "He is seven." },
          ],
          question: "How old is Omar?",
          choices: ["3", "5", "7", "9"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "In the dialogue, what is the brother's name?",
          choices: ["Hanif", "Ali", "Omar", "Yusuf"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'ismuhu' means:",
          choices: ["my name", "your name", "his name", "her name"],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Lock in the vocabulary",
          pairs: [
            { ar: "أَب", en: "father" },
            { ar: "أُمّ", en: "mother" },
            { ar: "اِبْن", en: "son" },
            { ar: "بِنْت", en: "daughter" },
            { ar: "كَبير", en: "big" },
            { ar: "جَميل", en: "beautiful (m)" },
          ],
        },
      ],
    },
  ],
};
