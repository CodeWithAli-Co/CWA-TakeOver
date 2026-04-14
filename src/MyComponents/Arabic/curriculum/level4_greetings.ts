// ============================================================================
// LEVEL 4 — Greetings & Introductions (first conversational Arabic)
// ============================================================================

import type { Level } from "../types";

export const level4: Level = {
  id: "L4",
  order: 4,
  title: "Greetings & Introductions",
  subtitle: "Your first conversations in Arabic",
  theme: "greetings",
  goal: "Greet, respond to greetings, introduce yourself, and ask simple personal questions.",
  lessons: [
    {
      id: "L4.1",
      levelId: "L4",
      order: 1,
      title: "Salām & Marḥaban",
      subtitle: "Hello, peace, welcome",
      theme: "greetings",
      estimatedMinutes: 20,
      xp: 45,
      prerequisites: ["L3.6"],
      summary: "The greetings you'll use every day.",
      wrapUp: "You now know how to say hello three different ways — and how to respond correctly.",
      activities: [
        {
          kind: "info",
          title: "Three ways to greet",
          body:
            "السَّلامُ عَلَيكُم (as-salāmu ʿalaykum) — 'peace be upon you'. The Muslim greeting.\n" +
            "Response: وَعَلَيكُمُ السَّلام (wa-ʿalaykumu s-salām) — 'and upon you be peace'.\n\n" +
            "مَرْحَباً (marḥaban) — 'hello'. Used casually, anytime.\n" +
            "Response: مَرْحَباً بِك (marḥaban bik) — 'hello to you'.\n\n" +
            "أَهْلاً (ahlan) — 'hi' / 'welcome'. Informal.\n" +
            "Response: أَهْلاً وَسَهْلاً (ahlan wa sahlan) — 'warm welcome'.",
          showcase: [
            { ar: "السَّلامُ عَلَيكُم", translit: "as-salāmu ʿalaykum", en: "peace be upon you" },
            { ar: "وَعَلَيكُمُ السَّلام", translit: "wa-ʿalaykumu s-salām", en: "and upon you be peace" },
            { ar: "مَرْحَباً", translit: "marḥaban", en: "hello" },
            { ar: "أَهْلاً", translit: "ahlan", en: "hi / welcome" },
          ],
        },
        {
          kind: "mcq",
          question: "Someone says 'As-salāmu ʿalaykum' to you. The standard reply is:",
          choices: ["Marḥaban", "Wa-ʿalaykumu s-salām", "Shukran", "Maʿa s-salāma"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "مَرْحَباً",
          question: "This means:",
          choices: ["Goodbye", "Please", "Hello", "Thank you"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which greeting is the most formal / traditional?",
          choices: ["ahlan", "marḥaban", "as-salāmu ʿalaykum", "ṣabāḥ al-khayr"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَرْحَباً",
          expected: "marhaban",
          altAccepted: ["marḥaban", "marhaba"],
        },
      ],
    },

    {
      id: "L4.2",
      levelId: "L4",
      order: 2,
      title: "Morning, Evening, Goodbye",
      subtitle: "Time-of-day greetings + farewells",
      theme: "greetings",
      estimatedMinutes: 25,
      xp: 50,
      prerequisites: ["L4.1"],
      summary: "Sabah al-khayr, masa' al-khayr, and how to say goodbye properly.",
      wrapUp: "You have enough greetings now to start any conversation and end it warmly.",
      activities: [
        {
          kind: "info",
          title: "Good morning / good evening",
          body:
            "صَباحُ الخَيْر (ṣabāḥ al-khayr) — 'morning of goodness' = good morning.\n" +
            "Response: صَباحُ النُّور (ṣabāḥ an-nūr) — 'morning of light'.\n\n" +
            "مَساءُ الخَيْر (masāʾ al-khayr) — good evening.\n" +
            "Response: مَساءُ النُّور (masāʾ an-nūr).",
          showcase: [
            { ar: "صَباحُ الخَيْر", translit: "ṣabāḥ al-khayr", en: "good morning" },
            { ar: "صَباحُ النُّور", translit: "ṣabāḥ an-nūr", en: "good morning (reply)" },
            { ar: "مَساءُ الخَيْر", translit: "masāʾ al-khayr", en: "good evening" },
          ],
        },
        {
          kind: "info",
          title: "Goodbye",
          body:
            "مَعَ السَّلامَة (maʿa s-salāma) — 'with peace' = goodbye.\n" +
            "إلى اللِّقاء (ilā l-liqāʾ) — 'until the meeting' = see you later.\n" +
            "تُصبِح عَلى خَيْر (tuṣbiḥ ʿalā khayr) — 'may you wake to goodness' = good night.",
          showcase: [
            { ar: "مَعَ السَّلامَة", translit: "maʿa s-salāma", en: "goodbye" },
            { ar: "إلى اللِّقاء", translit: "ilā l-liqāʾ", en: "see you later" },
          ],
        },
        {
          kind: "mcq",
          question: "Someone says 'ṣabāḥ al-khayr'. Your best response is:",
          choices: ["masāʾ al-khayr", "ṣabāḥ an-nūr", "maʿa s-salāma", "shukran"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'Maʿa s-salāma' means:",
          choices: ["please", "goodbye", "welcome", "good morning"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match the phrase to its meaning",
          pairs: [
            { ar: "صَباحُ الخَيْر", en: "good morning" },
            { ar: "مَساءُ الخَيْر", en: "good evening" },
            { ar: "مَعَ السَّلامَة", en: "goodbye" },
            { ar: "أَهْلاً", en: "hi / welcome" },
          ],
        },
      ],
    },

    {
      id: "L4.3",
      levelId: "L4",
      order: 3,
      title: "How are you? / My name is…",
      subtitle: "Your first real exchange",
      theme: "greetings",
      estimatedMinutes: 25,
      xp: 55,
      prerequisites: ["L4.2"],
      summary: "Kayfa hāluk, ismī, tasharrafnā.",
      wrapUp: "You can now introduce yourself to anyone in Arabic. That's a milestone.",
      activities: [
        {
          kind: "info",
          title: "Asking 'how are you?'",
          body:
            "كَيْفَ حالُك؟ (kayfa ḥāluk?) — 'how is your condition?' = how are you?\n" +
            "  (to a man: ḥāluk — to a woman: ḥāluki)\n\n" +
            "Common replies:\n" +
            "  بِخَيْر، الحَمْدُ لله (bi-khayr, al-ḥamdu lillāh) — 'fine, praise be to God'\n" +
            "  تَمام (tamām) — 'great'\n" +
            "  الحَمْدُ لله (al-ḥamdu lillāh) — 'praise God' (neutral, common)",
          showcase: [
            { ar: "كَيْفَ حالُك؟", translit: "kayfa ḥāluk?", en: "how are you?" },
            { ar: "بِخَيْر، الحَمْدُ لله", translit: "bi-khayr, al-ḥamdu lillāh", en: "fine, praise God" },
            { ar: "تَمام", translit: "tamām", en: "great" },
          ],
        },
        {
          kind: "info",
          title: "My name is…",
          body:
            "اِسْمي … (ismī …) — 'my name is …'\n" +
            "ما اسْمُك؟ (mā smuk?) — 'what is your name?' (to a man)\n" +
            "ما اسْمُكِ؟ (mā smuki?) — 'what is your name?' (to a woman)\n\n" +
            "Nice-to-meet-you: تَشَرَّفْنا (tasharrafnā) — 'we are honored'.",
          showcase: [
            { ar: "اِسْمي حَنيف", translit: "ismī Ḥanīf", en: "my name is Hanif" },
            { ar: "ما اسْمُك؟", translit: "mā smuk?", en: "what's your name? (m)" },
            { ar: "تَشَرَّفْنا", translit: "tasharrafnā", en: "pleased to meet you" },
          ],
        },
        {
          kind: "mcq",
          question: "'Kayfa ḥāluk?' means:",
          choices: ["What's your name?", "How are you?", "Where are you from?", "How old are you?"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'Al-ḥamdu lillāh' literally means:",
          choices: ["Please God", "Praise be to God", "God willing", "By God"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ Ḥanīf. (My name is Hanif.)",
          blank: "ismī",
          en: "my name",
          choices: ["ismuk", "ismī", "anā", "huwa"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'My name is Hanif' in transliteration (use ismī).",
          expected: "ismi hanif",
          altAccepted: ["ismī ḥanīf", "ismi Hanif", "ismī Hanif"],
        },
      ],
    },

    {
      id: "L4.4",
      levelId: "L4",
      order: 4,
      title: "Where are you from?",
      subtitle: "Countries and origins",
      theme: "greetings",
      estimatedMinutes: 25,
      xp: 55,
      prerequisites: ["L4.3"],
      summary: "Min ayna anta, and the names of a few countries.",
      wrapUp: "You can locate yourself in Arabic — a huge part of small talk.",
      activities: [
        {
          kind: "info",
          title: "From where?",
          body:
            "مِنْ أَيْنَ أَنْتَ؟ (min ayna anta?) — 'from where are you?' (to a man)\n" +
            "مِنْ أَيْنَ أَنْتِ؟ (min ayna anti?) — same, to a woman.\n\n" +
            "Reply: أَنا مِنْ … (anā min …) — 'I am from …'",
          showcase: [
            { ar: "أَنا مِنْ أَمْريكا", translit: "anā min Amrīkā", en: "I am from America" },
            { ar: "أَنا مِنْ مِصْر", translit: "anā min Miṣr", en: "I am from Egypt" },
            { ar: "أَنا مِنْ السُّعودِيَّة", translit: "anā min as-Suʿūdiyya", en: "I am from Saudi Arabia" },
          ],
        },
        {
          kind: "info",
          title: "A few country names",
          body: "Pick them up by ear — they often resemble the English name.",
          showcase: [
            { ar: "أَمْريكا", translit: "Amrīkā", en: "America" },
            { ar: "كَنَدا", translit: "Kanadā", en: "Canada" },
            { ar: "إنْجلِتْرا", translit: "Ingiltirā", en: "England" },
            { ar: "مِصْر", translit: "Miṣr", en: "Egypt" },
            { ar: "المَغْرِب", translit: "al-Maghrib", en: "Morocco" },
            { ar: "لُبْنان", translit: "Lubnān", en: "Lebanon" },
            { ar: "السُّعودِيَّة", translit: "as-Suʿūdiyya", en: "Saudi Arabia" },
          ],
        },
        {
          kind: "mcq",
          question: "'Min ayna anta?' means:",
          choices: ["Who are you?", "Where are you from?", "Where are you going?", "How are you?"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match country to name",
          pairs: [
            { ar: "مِصْر", en: "Egypt" },
            { ar: "أَمْريكا", en: "America" },
            { ar: "لُبْنان", en: "Lebanon" },
            { ar: "المَغْرِب", en: "Morocco" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ أَمْريكا. (I am from America.)",
          blank: "min",
          en: "from",
          choices: ["min", "fī", "ilā", "maʿa"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L4.5",
      levelId: "L4",
      order: 5,
      title: "A Full Dialogue",
      subtitle: "Put greetings into a real conversation",
      theme: "greetings",
      estimatedMinutes: 25,
      xp: 70,
      prerequisites: ["L4.4"],
      summary: "A complete Arabic dialogue — you understand all of it now.",
      wrapUp: "You just read a full Arabic dialogue end to end. Level 4 done.",
      activities: [
        {
          kind: "info",
          title: "A first meeting",
          body: "Two people meet. Read it slowly. You know every word.",
        },
        {
          kind: "dialogue",
          prompt: "Read the dialogue, then answer the question.",
          lines: [
            { speaker: "A", ar: "السَّلامُ عَلَيكُم", translit: "as-salāmu ʿalaykum", en: "Peace be upon you." },
            { speaker: "B", ar: "وَعَلَيكُمُ السَّلام", translit: "wa-ʿalaykumu s-salām", en: "And upon you be peace." },
            { speaker: "A", ar: "كَيْفَ حالُك؟", translit: "kayfa ḥāluk?", en: "How are you?" },
            { speaker: "B", ar: "بِخَيْر، الحَمْدُ لله. وَأَنْتَ؟", translit: "bi-khayr, al-ḥamdu lillāh. wa anta?", en: "Fine, praise God. And you?" },
            { speaker: "A", ar: "تَمام. ما اسْمُك؟", translit: "tamām. mā smuk?", en: "Great. What's your name?" },
            { speaker: "B", ar: "اِسْمي حَنيف. وَأَنْتَ؟", translit: "ismī Ḥanīf. wa anta?", en: "My name is Hanif. And you?" },
            { speaker: "A", ar: "اِسْمي عَلي. تَشَرَّفْنا.", translit: "ismī ʿAlī. tasharrafnā.", en: "My name is Ali. Pleased to meet you." },
            { speaker: "B", ar: "تَشَرَّفْنا. مَعَ السَّلامَة.", translit: "tasharrafnā. maʿa s-salāma.", en: "Likewise. Goodbye." },
          ],
          question: "What are the two people's names?",
          choices: ["Hanif and Omar", "Hanif and Ali", "Ali and Ahmad", "Hanif and Yusuf"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In the dialogue, which phrase means 'pleased to meet you'?",
          choices: ["maʿa s-salāma", "tasharrafnā", "kayfa ḥāluk", "al-ḥamdu lillāh"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which phrase is said at the END of the dialogue?",
          choices: ["as-salāmu ʿalaykum", "ismī", "maʿa s-salāma", "kayfa ḥāluk"],
          correctIndex: 2,
        },
      ],
    },
  ],
};
