// ============================================================================
// LEVEL 10 — Real reading + cultural notes + final review
// ============================================================================

import type { Level } from "../types";

export const level10: Level = {
  id: "L10",
  order: 10,
  title: "Reading & Culture",
  subtitle: "Put it all together",
  theme: "reading",
  goal: "Read short Arabic passages, understand cultural context, and feel comfortable keeping going.",
  lessons: [
    {
      id: "L10.1",
      levelId: "L10",
      order: 1,
      title: "The Definite Article — 'al-'",
      subtitle: "How 'the' works in Arabic",
      theme: "grammar",
      estimatedMinutes: 25,
      xp: 70,
      prerequisites: ["L9.4"],
      summary: "Al-kitāb = 'the book'. Sometimes it's spoken as 'ash-shams' — here's why.",
      wrapUp: "Sun and moon letters — the one grammar rule you'll hear in every Arabic sentence.",
      activities: [
        {
          kind: "info",
          title: "Writing vs speaking 'the'",
          body:
            "In writing, 'the' is always ال (al-) attached to the start of the noun:\n" +
            "  كِتاب (kitāb) = a book → الكِتاب (al-kitāb) = the book\n\n" +
            "But in SPEECH, the 'l' sometimes assimilates into the next letter. If the noun starts with a 'sun letter' (like ش), the 'l' is silent and the first consonant doubles.\n\n" +
            "  الشَّمس → written al-shams, but pronounced ash-shams.\n" +
            "  السَّلام → written al-salām, pronounced as-salām. (Now you know why it's 'as-salāmu ʿalaykum' not 'al-salāmu'.)\n\n" +
            "With 'moon letters' (like ق, ك, م, ب), the 'l' stays — al-kitāb, al-qamar.",
          showcase: [
            { ar: "الكِتاب", translit: "al-kitāb", en: "the book (moon letter)" },
            { ar: "الشَّمس", translit: "ash-shams", en: "the sun (sun letter)" },
            { ar: "القَمَر", translit: "al-qamar", en: "the moon (moon letter)" },
          ],
        },
        {
          kind: "mcq",
          question: "The phrase written الشَّمس is pronounced:",
          choices: ["al-shams", "ash-shams", "as-shams", "az-shams"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which word definitely uses a 'moon letter' (so you keep the 'l')?",
          choices: ["الشَّمس", "السَّلام", "الكِتاب", "الصَّيف"],
          correctIndex: 2,
        },
        {
          kind: "info",
          title: "Sun / Moon letters — a shortcut",
          body:
            "Sun letters (l merges): ت ث د ذ ر ز س ش ص ض ط ظ ل ن\n" +
            "Moon letters (l stays): أ ب ج ح خ ع غ ف ق ك م ه و ي\n\n" +
            "You don't need to memorize this table today. Just listen for it: if the next letter is a 'tongue-front' consonant, it probably merges.",
        },
      ],
    },

    {
      id: "L10.2",
      levelId: "L10",
      order: 2,
      title: "Idāfa — Linking Two Nouns",
      subtitle: "How Arabic says 'the book of the teacher'",
      theme: "grammar",
      estimatedMinutes: 25,
      xp: 70,
      prerequisites: ["L10.1"],
      summary: "Stack two nouns: noun + definite noun = possession.",
      wrapUp: "Idāfa is half of Arabic sentences. You'll now recognize it everywhere.",
      activities: [
        {
          kind: "info",
          title: "The idāfa construction",
          body:
            "To say 'the teacher's book', Arabic puts two nouns in a chain:\n\n" +
            "  كِتابُ المُدَرِّس (kitāb al-mudarris) — book-of the-teacher → 'the teacher's book'\n\n" +
            "Rules:\n" +
            "  • The first noun drops its 'al-' (even though it's definite)\n" +
            "  • The second noun usually has 'al-'\n" +
            "  • The first noun takes the ending -u\n\n" +
            "More examples:\n" +
            "  بابُ البَيْت (bāb al-bayt) — the door of the house\n" +
            "  اِسْمُ البِنْت (ism al-bint) — the girl's name\n" +
            "  كِتابُ الطالِب (kitāb aṭ-ṭālib) — the student's book",
          showcase: [
            { ar: "كِتابُ المُدَرِّس", translit: "kitāb al-mudarris", en: "the teacher's book" },
            { ar: "بابُ البَيْت", translit: "bāb al-bayt", en: "the door of the house" },
            { ar: "اِسْمُ البِنْت", translit: "ism al-bint", en: "the girl's name" },
          ],
        },
        {
          kind: "mcq",
          question: "'kitāb al-mudarris' means:",
          choices: [
            "a book and a teacher",
            "the teacher's book",
            "the book of teaching",
            "the teacher writes",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In an idāfa, the FIRST noun:",
          choices: ["takes al-", "drops al-", "takes -an ending", "disappears"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ البَيت (the door of the house)",
          blank: "bāb",
          en: "door",
          choices: ["al-bāb", "bāb", "bābu", "abwāb"],
          correctIndex: 1,
          explain: "First noun drops al-: just بابُ. (The -u ending is often unwritten in casual speech.)",
        },
      ],
    },

    {
      id: "L10.3",
      levelId: "L10",
      order: 3,
      title: "Your First Paragraph",
      subtitle: "A real short passage",
      theme: "reading",
      estimatedMinutes: 30,
      xp: 100,
      prerequisites: ["L10.2"],
      summary: "Read a short paragraph about Hanif and answer three questions.",
      wrapUp: "You just read a paragraph of Arabic and understood it. A year ago this was just lines and dots.",
      activities: [
        {
          kind: "reading",
          prompt: "Read the paragraph carefully.",
          passageAr:
            "اِسْمي حَنيف. أَنا مِنْ أَمْريكا. أَدْرُس العَرَبِيَّة في البَيت كُلّ يَوم. عِنْدي أَخ صَغير اِسْمُهُ عُمَر. نَحْنُ نُحِبّ القَهْوَة وَالكُتُب.",
          translation:
            "My name is Hanif. I am from America. I study Arabic at home every day. I have a little brother named Omar. We love coffee and books.",
          question: "Where does Hanif study Arabic?",
          choices: ["at school", "at work", "at home", "at the library"],
          correctIndex: 2,
        },
        {
          kind: "reading",
          prompt: "Same passage — second question.",
          passageAr:
            "اِسْمي حَنيف. أَنا مِنْ أَمْريكا. أَدْرُس العَرَبِيَّة في البَيت كُلّ يَوم. عِنْدي أَخ صَغير اِسْمُهُ عُمَر. نَحْنُ نُحِبّ القَهْوَة وَالكُتُب.",
          translation:
            "My name is Hanif. I am from America. I study Arabic at home every day. I have a little brother named Omar. We love coffee and books.",
          question: "What is Omar to Hanif?",
          choices: ["his father", "his son", "his little brother", "his friend"],
          correctIndex: 2,
        },
        {
          kind: "reading",
          prompt: "Last one.",
          passageAr:
            "اِسْمي حَنيف. أَنا مِنْ أَمْريكا. أَدْرُس العَرَبِيَّة في البَيت كُلّ يَوم. عِنْدي أَخ صَغير اِسْمُهُ عُمَر. نَحْنُ نُحِبّ القَهْوَة وَالكُتُب.",
          translation:
            "My name is Hanif. I am from America. I study Arabic at home every day. I have a little brother named Omar. We love coffee and books.",
          question: "What do the two brothers love?",
          choices: ["tea and bread", "coffee and books", "coffee and cheese", "books and music"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L10.4",
      levelId: "L10",
      order: 4,
      title: "Cultural Notes & What's Next",
      subtitle: "Context and how to keep going",
      theme: "culture",
      estimatedMinutes: 20,
      xp: 60,
      prerequisites: ["L10.3"],
      summary: "A little wisdom for anyone learning Arabic.",
      wrapUp: "You finished the foundational course. Genuine congratulations — most people never get this far.",
      activities: [
        {
          kind: "info",
          title: "Standard vs dialect",
          body:
            "The Arabic you've been learning is Modern Standard Arabic (fuṣḥā / فُصْحى) — the formal written and media language, understood everywhere.\n\n" +
            "Spoken dialects (Egyptian, Levantine, Gulf, Moroccan, etc.) differ — sometimes a lot. But MSA is your universal passport: if you know it, people will understand you, and you'll read books, news, and religious texts.",
        },
        {
          kind: "info",
          title: "A few daily phrases that carry weight",
          body:
            "إِنْ شاءَ الله (in shāʾ Allāh) — 'if God wills'. Used for future plans.\n" +
            "ما شاءَ الله (mā shāʾ Allāh) — 'what God has willed' — said when admiring someone.\n" +
            "الحَمْدُ لله (al-ḥamdu lillāh) — 'praise be to God' — often means 'I'm fine', 'all good'.\n" +
            "بارَكَ الله فيك (bāraka Llāhu fīk) — 'God bless you' — a warm thanks.",
          showcase: [
            { ar: "إِنْ شاءَ الله", translit: "in shāʾ Allāh", en: "God willing" },
            { ar: "ما شاءَ الله", translit: "mā shāʾ Allāh", en: "how wonderful" },
            { ar: "الحَمْدُ لله", translit: "al-ḥamdu lillāh", en: "praise God / all's well" },
          ],
        },
        {
          kind: "info",
          title: "How to keep improving",
          body:
            "Three habits that will take you from here to real fluency:\n\n" +
            "  1. Read every day — even 5 minutes of children's books or signs. Your eyes need the script.\n" +
            "  2. Listen every day — Al Jazeera, YouTube, Quran recitation. Your ears build melody.\n" +
            "  3. Write and speak — even to yourself. Arabic you produce sticks; Arabic you only consume fades.\n\n" +
            "Come back to Level 1 occasionally. The letters always reward a second look.",
        },
        {
          kind: "mcq",
          question: "The formal, universal Arabic you've been learning is called:",
          choices: ["ʿāmmiyya", "fuṣḥā", "shāmī", "masrī"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'in shāʾ Allāh' is used when:",
          choices: [
            "admiring someone's child",
            "talking about a future plan",
            "greeting someone",
            "thanking someone",
          ],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L10.5",
      levelId: "L10",
      order: 5,
      title: "Capstone Review",
      subtitle: "Prove you own it",
      theme: "review",
      estimatedMinutes: 30,
      xp: 150,
      prerequisites: ["L10.4"],
      summary: "Random questions from every level. The graduation exam.",
      wrapUp: "You did it. Whatever your score, the fact that you got here means you can learn this language for real.",
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
          arabicPrompt: "بِنْت",
          question: "This word means:",
          choices: ["boy", "girl", "house", "book"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which is 'thank you'?",
          choices: ["ʿafwan", "shukran", "tafaḍḍal", "min faḍlik"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'hiya ṭabība' means:",
          choices: [
            "he is a doctor",
            "she is a doctor",
            "I am a doctor",
            "she is a teacher",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "٥",
          question: "What number?",
          choices: ["3", "4", "5", "6"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'al-jumʿa' is which day?",
          choices: ["Sunday", "Wednesday", "Friday", "Saturday"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'anā urīd qahwa' means:",
          choices: [
            "I drink water",
            "I want coffee",
            "I speak Arabic",
            "I eat bread",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'kitāb al-mudarris' means:",
          choices: [
            "the book is with the teacher",
            "the teacher's book",
            "a book and a teacher",
            "the teacher writes",
          ],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'my name is Hanif' in Arabic transliteration.",
          expected: "ismi hanif",
          altAccepted: ["ismī ḥanīf", "ismi Hanif", "ismī Hanif"],
        },
      ],
    },
  ],
};
