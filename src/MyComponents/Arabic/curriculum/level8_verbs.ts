// ============================================================================
// LEVEL 8 — Verbs and simple sentences
// ============================================================================

import type { Level } from "../types";

export const level8: Level = {
  id: "L8",
  order: 8,
  title: "Verbs & Simple Sentences",
  subtitle: "Say what you do",
  theme: "verbs",
  goal: "Conjugate common verbs in the present tense and form sentences.",
  lessons: [
    {
      id: "L8.1",
      levelId: "L8",
      order: 1,
      title: "The Arabic Root System",
      subtitle: "How Arabic makes thousands of words from three letters",
      theme: "grammar",
      estimatedMinutes: 25,
      xp: 65,
      prerequisites: ["L7.4"],
      summary: "Most Arabic words grow out of 3-letter roots.",
      wrapUp: "Roots are Arabic's superpower. Learn one root and you unlock a whole family of words.",
      activities: [
        {
          kind: "info",
          title: "Roots in action",
          body:
            "Most Arabic words are built on a 3-letter root that carries a core meaning. The same root appears in many related words.\n\n" +
            "Root ك ت ب (k-t-b) — all about 'writing':\n" +
            "  كَتَبَ (kataba) — he wrote\n" +
            "  يَكْتُب (yaktub) — he writes\n" +
            "  كِتاب (kitāb) — book\n" +
            "  مَكْتَب (maktab) — office / desk\n" +
            "  مَكْتَبَة (maktaba) — library / bookstore\n" +
            "  كاتِب (kātib) — writer\n\n" +
            "Once you recognize a root, you can often guess a new word's meaning.",
          showcase: [
            { ar: "ك ت ب", translit: "k-t-b", en: "the root for writing" },
            { ar: "كاتِب", translit: "kātib", en: "writer" },
            { ar: "مَكْتَبَة", translit: "maktaba", en: "library" },
          ],
        },
        {
          kind: "mcq",
          question: "Which word is NOT from the root k-t-b?",
          choices: ["kitāb (book)", "maktab (office)", "qalam (pen)", "kātib (writer)"],
          correctIndex: 2,
          explain: "qalam is a separate root (q-l-m) — also meaning 'write / pen', but different root.",
        },
        {
          kind: "mcq",
          question: "'maktaba' means:",
          choices: ["office", "library", "writer", "book"],
          correctIndex: 1,
        },
        {
          kind: "info",
          title: "Another root",
          body:
            "Root د ر س (d-r-s) — about 'studying':\n" +
            "  دَرَسَ (darasa) — he studied\n" +
            "  يَدْرُس (yadrus) — he studies\n" +
            "  دَرْس (dars) — a lesson\n" +
            "  مَدْرَسَة (madrasa) — school\n" +
            "  مُدَرِّس (mudarris) — teacher\n" +
            "  طالِب (ṭālib) — student (from a different root t-l-b)",
        },
      ],
    },

    {
      id: "L8.2",
      levelId: "L8",
      order: 2,
      title: "Present-Tense Verbs — He / She / I / You",
      subtitle: "The conjugation pattern",
      theme: "verbs",
      estimatedMinutes: 30,
      xp: 80,
      prerequisites: ["L8.1"],
      summary: "Prefixes and suffixes for each subject.",
      wrapUp: "The present tense is a matter of prefixes. Once learned, it applies to every verb.",
      activities: [
        {
          kind: "info",
          title: "Present tense of yadrus (to study)",
          body:
            "Base: the 3-letter root د ر س with vowels around it.\n\n" +
            "  أَنا أَدْرُس (anā adrus) — I study\n" +
            "  أَنْتَ تَدْرُس (anta tadrus) — you study (m)\n" +
            "  أَنْتِ تَدْرُسين (anti tadrusīn) — you study (f)\n" +
            "  هُوَ يَدْرُس (huwa yadrus) — he studies\n" +
            "  هِيَ تَدْرُس (hiya tadrus) — she studies\n" +
            "  نَحْنُ نَدْرُس (naḥnu nadrus) — we study\n" +
            "  هُم يَدْرُسون (hum yadrusūn) — they study\n\n" +
            "Notice the prefixes: أ (a-) = I, ت (ta-) = you/she, ي (ya-) = he/they, ن (na-) = we.",
          showcase: [
            { ar: "أَدْرُس", translit: "adrus", en: "I study" },
            { ar: "يَدْرُس", translit: "yadrus", en: "he studies" },
            { ar: "تَدْرُس", translit: "tadrus", en: "she / you (m) study" },
            { ar: "نَدْرُس", translit: "nadrus", en: "we study" },
          ],
        },
        {
          kind: "mcq",
          question: "'anā adrus al-ʿarabiyya' means:",
          choices: [
            "He studies Arabic",
            "She studies Arabic",
            "I study Arabic",
            "We study Arabic",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To say 'he writes' from the root k-t-b, the form is:",
          choices: ["aktub", "taktub", "yaktub", "naktub"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "نَحْنُ ____ (we study)",
          blank: "nadrus",
          en: "we study",
          choices: ["adrus", "yadrus", "tadrus", "nadrus"],
          correctIndex: 3,
        },
        {
          kind: "typing",
          prompt: "Type 'I study' in transliteration (two words).",
          expected: "ana adrus",
          altAccepted: ["anā adrus"],
        },
      ],
    },

    {
      id: "L8.3",
      levelId: "L8",
      order: 3,
      title: "Useful Everyday Verbs",
      subtitle: "Eat, drink, speak, go, have",
      theme: "verbs",
      estimatedMinutes: 25,
      xp: 65,
      prerequisites: ["L8.2"],
      summary: "A small set of verbs gives you huge conversational range.",
      wrapUp: "With these 5–6 verbs plus pronouns, you can already say a huge variety of things.",
      activities: [
        {
          kind: "info",
          title: "A starter verb pack",
          body:
            "يَأْكُل (yaʾkul) — eats\n" +
            "يَشْرَب (yashrab) — drinks\n" +
            "يَتَكَلَّم (yatakallam) — speaks\n" +
            "يَذْهَب (yadhhab) — goes\n" +
            "يُريد (yurīd) — wants\n" +
            "يَعْرِف (yaʿrif) — knows\n\n" +
            "Each conjugates the same way — swap the ي for أ / ت / ن to change the subject.",
          showcase: [
            { ar: "أَشْرَب ماء", translit: "ashrab māʾ", en: "I drink water" },
            { ar: "هُوَ يَأْكُل", translit: "huwa yaʾkul", en: "he eats" },
            { ar: "هِيَ تَتَكَلَّم العَرَبِيَّة", translit: "hiya tatakallam al-ʿarabiyya", en: "she speaks Arabic" },
            { ar: "أَنا أُريد قَهْوَة", translit: "anā urīd qahwa", en: "I want coffee" },
          ],
        },
        {
          kind: "mcq",
          question: "'huwa yashrab māʾ' means:",
          choices: ["he eats water", "he drinks water", "he wants water", "he knows water"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'hiya tatakallam al-ʿarabiyya' means:",
          choices: [
            "she speaks English",
            "he speaks Arabic",
            "she speaks Arabic",
            "we speak Arabic",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ قَهْوَة. (I want coffee.)",
          blank: "urīd",
          en: "I want",
          choices: ["yurīd", "turīd", "urīd", "nurīd"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L8.4",
      levelId: "L8",
      order: 4,
      title: "Negation — 'I don't…'",
      subtitle: "lā + verb",
      theme: "grammar",
      estimatedMinutes: 20,
      xp: 55,
      prerequisites: ["L8.3"],
      summary: "لا before a present verb = 'does not'.",
      wrapUp: "You can now both affirm and deny — a full conversational toolkit.",
      activities: [
        {
          kind: "info",
          title: "Saying 'no' and 'don't'",
          body:
            "لا (lā) — 'no' (as an answer), and also 'does/do not' before a present-tense verb.\n\n" +
            "  أَنا لا أَشْرَب قَهْوَة (anā lā ashrab qahwa) — I don't drink coffee.\n" +
            "  هُوَ لا يَعْرِف (huwa lā yaʿrif) — he doesn't know.\n\n" +
            "To deny a noun sentence ('X is Y'), Arabic uses the verb ليس (laysa) — we'll touch that later.",
          showcase: [
            { ar: "أَنا لا أَشْرَب قَهْوَة", translit: "anā lā ashrab qahwa", en: "I don't drink coffee" },
            { ar: "هُوَ لا يَعْرِف", translit: "huwa lā yaʿrif", en: "he doesn't know" },
          ],
        },
        {
          kind: "mcq",
          question: "'anā lā ākul laḥm' means:",
          choices: [
            "I eat meat",
            "I want meat",
            "I don't eat meat",
            "I know meat",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "هِيَ ____ تَتَكَلَّم العَرَبِيَّة. (She doesn't speak Arabic.)",
          blank: "lā",
          en: "not",
          choices: ["lā", "mā", "laysa", "laysat"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L8.5",
      levelId: "L8",
      order: 5,
      title: "Level 8 Review — Speak!",
      subtitle: "Build real sentences",
      theme: "review",
      estimatedMinutes: 30,
      xp: 100,
      prerequisites: ["L8.4"],
      summary: "You have enough to say real things. Prove it.",
      wrapUp: "Level 8 is a turning point. You're not learning the script anymore — you're using the language.",
      activities: [
        {
          kind: "mcq",
          question: "'naḥnu nadrus al-ʿarabiyya' means:",
          choices: [
            "I study Arabic",
            "They study Arabic",
            "We study Arabic",
            "She studies Arabic",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'huwa yaʾkul' means:",
          choices: ["he eats", "he drinks", "he writes", "he studies"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ القَهْوَة. (I drink coffee.)",
          blank: "ashrab",
          en: "I drink",
          choices: ["yashrab", "tashrab", "ashrab", "nashrab"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "هِيَ ____ العَرَبِيَّة. (She speaks Arabic.)",
          blank: "tatakallam",
          en: "she speaks",
          choices: ["atakallam", "tatakallam", "yatakallam", "natakallam"],
          correctIndex: 1,
        },
        {
          kind: "dialogue",
          prompt: "Read and answer",
          lines: [
            { speaker: "A", ar: "ماذا تَدْرُس؟", translit: "mādhā tadrus?", en: "What do you study?" },
            { speaker: "B", ar: "أَدْرُس العَرَبِيَّة.", translit: "adrus al-ʿarabiyya.", en: "I study Arabic." },
            { speaker: "A", ar: "أَيْنَ؟", translit: "ayna?", en: "Where?" },
            { speaker: "B", ar: "في البَيْت.", translit: "fī l-bayt.", en: "At home." },
          ],
          question: "Where does person B study?",
          choices: ["at school", "at home", "at the library", "at work"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
