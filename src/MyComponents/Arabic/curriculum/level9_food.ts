// ============================================================================
// LEVEL 9 — Food, drink, and "I want to order"
// ============================================================================

import type { Level } from "../types";

export const level9: Level = {
  id: "L9",
  order: 9,
  title: "Food, Drink, and Daily Life",
  subtitle: "Order, ask, enjoy",
  theme: "food",
  goal: "Name common foods and drinks, and order in a café or restaurant.",
  lessons: [
    {
      id: "L9.1",
      levelId: "L9",
      order: 1,
      title: "Food Basics",
      subtitle: "Bread, rice, meat, fish, vegetables",
      theme: "food",
      estimatedMinutes: 25,
      xp: 60,
      prerequisites: ["L8.5"],
      summary: "The core words that cover most meals.",
      wrapUp: "You can now walk through a menu with real comprehension.",
      activities: [
        {
          kind: "info",
          title: "Essential food words",
          body:
            "خُبْز (khubz) — bread\n" +
            "أَرُزّ (aruzz) — rice\n" +
            "لَحْم (laḥm) — meat\n" +
            "دَجاج (dajāj) — chicken\n" +
            "سَمَك (samak) — fish\n" +
            "خُضار (khuḍār) — vegetables\n" +
            "فاكِهَة (fākiha) — fruit\n" +
            "سَلَطَة (salaṭa) — salad\n" +
            "جُبْن (jubn) — cheese\n" +
            "بَيْض (bayḍ) — eggs",
          showcase: [
            { ar: "خُبْز", translit: "khubz", en: "bread" },
            { ar: "دَجاج", translit: "dajāj", en: "chicken" },
            { ar: "سَمَك", translit: "samak", en: "fish" },
            { ar: "فاكِهَة", translit: "fākiha", en: "fruit" },
          ],
        },
        {
          kind: "mcq",
          question: "'khubz' means:",
          choices: ["rice", "meat", "bread", "cheese"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'dajāj' means:",
          choices: ["fish", "chicken", "beef", "duck"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match",
          pairs: [
            { ar: "خُبْز", en: "bread" },
            { ar: "أَرُزّ", en: "rice" },
            { ar: "لَحْم", en: "meat" },
            { ar: "سَمَك", en: "fish" },
            { ar: "فاكِهَة", en: "fruit" },
          ],
        },
      ],
    },

    {
      id: "L9.2",
      levelId: "L9",
      order: 2,
      title: "Drinks",
      subtitle: "Water, tea, coffee, juice",
      theme: "food",
      estimatedMinutes: 20,
      xp: 50,
      prerequisites: ["L9.1"],
      summary: "māʾ, shāy, qahwa, ʿaṣīr.",
      wrapUp: "Tea (شاي) is huge in Arab culture — you'll say this word a lot.",
      activities: [
        {
          kind: "info",
          title: "Drinks",
          body:
            "ماء (māʾ) — water\n" +
            "شاي (shāy) — tea\n" +
            "قَهْوَة (qahwa) — coffee\n" +
            "عَصير (ʿaṣīr) — juice\n" +
            "حَليب (ḥalīb) — milk\n\n" +
            "Fun fact: 'coffee' in English comes from 'qahwa'. 'Café' shares the same origin.",
          showcase: [
            { ar: "ماء", translit: "māʾ", en: "water" },
            { ar: "شاي", translit: "shāy", en: "tea" },
            { ar: "قَهْوَة", translit: "qahwa", en: "coffee" },
            { ar: "عَصير", translit: "ʿaṣīr", en: "juice" },
          ],
        },
        {
          kind: "mcq",
          question: "'shāy' means:",
          choices: ["tea", "coffee", "water", "juice"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'qahwa' means:",
          choices: ["milk", "tea", "coffee", "juice"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'water' (transliteration).",
          expected: "ma",
          altAccepted: ["māʾ", "maa"],
        },
      ],
    },

    {
      id: "L9.3",
      levelId: "L9",
      order: 3,
      title: "Ordering: 'I'd like…'",
      subtitle: "Politely asking for something",
      theme: "food",
      estimatedMinutes: 25,
      xp: 65,
      prerequisites: ["L9.2"],
      summary: "urīd, min faḍlik, the check.",
      wrapUp: "You could now order a full meal in an Arab café. That's huge progress.",
      activities: [
        {
          kind: "info",
          title: "Phrases for ordering",
          body:
            "أُريد … (urīd …) — I want / I'd like …\n" +
            "مِنْ فَضْلِك (min faḍlik) — please (to a man)  /  مِنْ فَضْلِكِ (min faḍliki) — to a woman\n" +
            "الحِساب مِنْ فَضْلِك (al-ḥisāb min faḍlik) — the check, please\n" +
            "بِكَمْ هذا؟ (bi-kam hādhā?) — how much is this?\n" +
            "شُكْراً (shukran) — thanks\n" +
            "عَفْواً (ʿafwan) — you're welcome",
          showcase: [
            { ar: "أُريد قَهْوَة", translit: "urīd qahwa", en: "I'd like coffee" },
            { ar: "مِنْ فَضْلِك", translit: "min faḍlik", en: "please" },
            { ar: "الحِساب مِنْ فَضْلِك", translit: "al-ḥisāb min faḍlik", en: "the check, please" },
            { ar: "بِكَمْ هذا؟", translit: "bi-kam hādhā?", en: "how much is this?" },
          ],
        },
        {
          kind: "mcq",
          question: "To politely say 'please' to a man:",
          choices: ["min faḍlik", "min faḍliki", "shukran", "ʿafwan"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'al-ḥisāb min faḍlik' means:",
          choices: ["the menu, please", "the check, please", "the water, please", "how much?"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "أُريد ____ مِنْ فَضْلِك. (I'd like tea, please.)",
          blank: "shāy",
          en: "tea",
          choices: ["qahwa", "shāy", "māʾ", "ʿaṣīr"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L9.4",
      levelId: "L9",
      order: 4,
      title: "Café Dialogue",
      subtitle: "Read a real café exchange",
      theme: "food",
      estimatedMinutes: 25,
      xp: 80,
      prerequisites: ["L9.3"],
      summary: "A full ordering conversation.",
      wrapUp: "You just ordered in Arabic. Level 9 done.",
      activities: [
        {
          kind: "dialogue",
          prompt: "Read and answer",
          lines: [
            { speaker: "A", ar: "مَرْحَباً! ماذا تُريد؟", translit: "marḥaban! mādhā turīd?", en: "Hello! What would you like?" },
            { speaker: "B", ar: "أُريد قَهْوَة وَخُبْز مِنْ فَضْلِك.", translit: "urīd qahwa wa-khubz min faḍlik.", en: "I'd like coffee and bread, please." },
            { speaker: "A", ar: "هَل تُريد جُبْن مَعَ الخُبْز؟", translit: "hal turīd jubn maʿa al-khubz?", en: "Would you like cheese with the bread?" },
            { speaker: "B", ar: "نَعَم، مِنْ فَضْلِك.", translit: "naʿam, min faḍlik.", en: "Yes, please." },
            { speaker: "A", ar: "تَفَضَّل. بِعَشَرَة.", translit: "tafaḍḍal. bi-ʿashara.", en: "Here you go. That's ten." },
            { speaker: "B", ar: "شُكْراً!", translit: "shukran!", en: "Thank you!" },
          ],
          question: "What did person B order?",
          choices: [
            "tea and bread",
            "coffee and bread",
            "juice and cheese",
            "water and fish",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "What was the price?",
          choices: ["5", "7", "10", "20"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'tafaḍḍal' most closely means:",
          choices: ["thank you", "please / here you go", "goodbye", "welcome"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
