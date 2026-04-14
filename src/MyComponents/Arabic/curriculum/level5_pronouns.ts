// ============================================================================
// LEVEL 5 — Pronouns, "to be", and pointing words
// ============================================================================

import type { Level } from "../types";

export const level5: Level = {
  id: "L5",
  order: 5,
  title: "Pronouns & Being",
  subtitle: "I, you, he, she — and how to say 'is'",
  theme: "pronouns",
  goal: "Use subject pronouns and form simple 'X is Y' sentences without a verb.",
  lessons: [
    {
      id: "L5.1",
      levelId: "L5",
      order: 1,
      title: "Anā, Anta, Anti",
      subtitle: "I, you (m), you (f)",
      theme: "pronouns",
      estimatedMinutes: 25,
      xp: 55,
      prerequisites: ["L4.5"],
      summary: "The three pronouns you'll use most.",
      wrapUp: "Arabic distinguishes masculine and feminine 'you'. Get used to it — it's everywhere.",
      activities: [
        {
          kind: "info",
          title: "The singular pronouns",
          body:
            "أَنا (anā) — I\n" +
            "أَنْتَ (anta) — you (to a man)\n" +
            "أَنْتِ (anti) — you (to a woman)\n\n" +
            "In Arabic, you don't say 'I am happy' — you say 'I happy' (anā saʿīd). The 'is/am/are' is implied.",
          showcase: [
            { ar: "أَنا", translit: "anā", en: "I" },
            { ar: "أَنْتَ", translit: "anta", en: "you (m)" },
            { ar: "أَنْتِ", translit: "anti", en: "you (f)" },
            { ar: "أَنا سَعيد", translit: "anā saʿīd", en: "I am happy (m)" },
            { ar: "أَنا سَعيدَة", translit: "anā saʿīda", en: "I am happy (f)" },
          ],
        },
        {
          kind: "mcq",
          question: "To say 'you' to a woman, you use:",
          choices: ["anta", "anti", "huwa", "hiya"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'anā ṭālib' means:",
          choices: ["you are a student", "he is a student", "I am a student", "we are students"],
          correctIndex: 2,
          explain: "No verb needed — anā + noun = 'I am …'",
        },
        {
          kind: "fillblank",
          prompt: "____ ṭālib. (I am a student — male)",
          blank: "anā",
          en: "I",
          choices: ["anā", "anta", "hiya", "huwa"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L5.2",
      levelId: "L5",
      order: 2,
      title: "Huwa, Hiya — He and She",
      subtitle: "Third-person pronouns",
      theme: "pronouns",
      estimatedMinutes: 20,
      xp: 50,
      prerequisites: ["L5.1"],
      summary: "هُوَ and هِيَ — and how the noun after them must match gender.",
      wrapUp: "You now have: I, you (m/f), he, she. That's enough to make hundreds of sentences.",
      activities: [
        {
          kind: "info",
          title: "He, She",
          body:
            "هُوَ (huwa) — he, it (m)\n" +
            "هِيَ (hiya) — she, it (f)\n\n" +
            "Arabic has no neuter 'it'. Every noun is either masculine or feminine. Words ending in ـة (tāʾ marbūṭa) are almost always feminine.",
          showcase: [
            { ar: "هُوَ", translit: "huwa", en: "he" },
            { ar: "هِيَ", translit: "hiya", en: "she" },
            { ar: "هُوَ مُدَرِّس", translit: "huwa mudarris", en: "he is a teacher" },
            { ar: "هِيَ مُدَرِّسَة", translit: "hiya mudarrisa", en: "she is a teacher" },
          ],
        },
        {
          kind: "mcq",
          question: "'huwa ṭabīb' means:",
          choices: ["she is a doctor", "he is a doctor", "I am a doctor", "we are doctors"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which ending on a noun typically marks it as FEMININE?",
          choices: ["ـا", "ـة", "ـي", "ـو"],
          correctIndex: 1,
          explain: "ـة (tāʾ marbūṭa) is the feminine marker.",
        },
        {
          kind: "fillblank",
          prompt: "____ mudarrisa. (She is a teacher.)",
          blank: "hiya",
          en: "she",
          choices: ["huwa", "hiya", "anta", "anti"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match pronoun to meaning",
          pairs: [
            { ar: "أَنا", en: "I" },
            { ar: "أَنْتَ", en: "you (m)" },
            { ar: "أَنْتِ", en: "you (f)" },
            { ar: "هُوَ", en: "he" },
            { ar: "هِيَ", en: "she" },
          ],
        },
      ],
    },

    {
      id: "L5.3",
      levelId: "L5",
      order: 3,
      title: "Naḥnu, Antum, Hum",
      subtitle: "We, you (all), they",
      theme: "pronouns",
      estimatedMinutes: 20,
      xp: 50,
      prerequisites: ["L5.2"],
      summary: "Plural pronouns — for groups.",
      wrapUp: "You now know all the common pronouns.",
      activities: [
        {
          kind: "info",
          title: "The plurals",
          body:
            "نَحْنُ (naḥnu) — we\n" +
            "أَنْتُم (antum) — you (plural, group with at least one man)\n" +
            "أَنْتُنَّ (antunna) — you (plural, women only — less common)\n" +
            "هُم (hum) — they (m or mixed)\n" +
            "هُنَّ (hunna) — they (women only)",
          showcase: [
            { ar: "نَحْنُ", translit: "naḥnu", en: "we" },
            { ar: "أَنْتُم", translit: "antum", en: "you (pl.)" },
            { ar: "هُم", translit: "hum", en: "they" },
            { ar: "نَحْنُ طُلّاب", translit: "naḥnu ṭullāb", en: "we are students" },
          ],
        },
        {
          kind: "mcq",
          question: "'naḥnu min Amrīkā' means:",
          choices: ["I am from America", "You are from America", "We are from America", "They are from America"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'antum' is used to address:",
          choices: ["one man", "one woman", "a group of people", "yourself"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L5.4",
      levelId: "L5",
      order: 4,
      title: "Hādhā, Hādhihi — This",
      subtitle: "Pointing at things",
      theme: "pronouns",
      estimatedMinutes: 20,
      xp: 45,
      prerequisites: ["L5.3"],
      summary: "هذا (this m) and هذه (this f) — the demonstratives.",
      wrapUp: "You can now point to anything and say what it is.",
      activities: [
        {
          kind: "info",
          title: "This / that",
          body:
            "هذا (hādhā) — this (masculine)\n" +
            "هذه (hādhihi) — this (feminine)\n" +
            "ذلك (dhālika) — that (m)\n" +
            "تلك (tilka) — that (f)\n\n" +
            "Usage: هذا كِتاب (hādhā kitāb) = 'this is a book'. هذه مُدَرِّسَة (hādhihi mudarrisa) = 'this is a teacher (f)'.",
          showcase: [
            { ar: "هذا كِتاب", translit: "hādhā kitāb", en: "this is a book" },
            { ar: "هذه بِنْت", translit: "hādhihi bint", en: "this is a girl" },
            { ar: "ذلك وَلَد", translit: "dhālika walad", en: "that is a boy" },
          ],
        },
        {
          kind: "mcq",
          question: "'hādhā' means:",
          choices: ["this (m)", "this (f)", "that (m)", "that (f)"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'hādhihi mudarrisa' means:",
          choices: ["this is a male teacher", "this is a female teacher", "that is a teacher", "he is a teacher"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ kitāb. (This is a book.)",
          blank: "hādhā",
          en: "this",
          choices: ["hādhā", "hādhihi", "dhālika", "tilka"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L5.5",
      levelId: "L5",
      order: 5,
      title: "Level 5 Review",
      subtitle: "Build sentences with pronouns",
      theme: "review",
      estimatedMinutes: 25,
      xp: 75,
      prerequisites: ["L5.4"],
      summary: "Mix pronouns + demonstratives + what you know.",
      wrapUp: "You can now form dozens of simple true sentences. Next, we count.",
      activities: [
        {
          kind: "mcq",
          question: "'hiya ṭabība' means:",
          choices: ["he is a doctor", "she is a doctor", "I am a doctor", "you are a doctor"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'naḥnu min Lubnān' means:",
          choices: ["I'm from Lebanon", "They're from Lebanon", "We're from Lebanon", "Are you from Lebanon?"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "____ mudarrisa. (She is a teacher.)",
          blank: "hiya",
          en: "she",
          choices: ["huwa", "hiya", "anta", "anti"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ bayt. (This is a house.)",
          blank: "hādhā",
          en: "this (m)",
          choices: ["hādhā", "hādhihi", "huwa", "hiya"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match Arabic pronoun to English",
          pairs: [
            { ar: "أَنا", en: "I" },
            { ar: "نَحْنُ", en: "we" },
            { ar: "أَنْتُم", en: "you (pl.)" },
            { ar: "هُم", en: "they" },
            { ar: "هذا", en: "this (m)" },
            { ar: "هذه", en: "this (f)" },
          ],
        },
      ],
    },
  ],
};
