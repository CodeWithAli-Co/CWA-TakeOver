// ============================================================================
// LEVEL 3 — Harakat (vowel marks), letter forms, and first real reading
//
// Depth focus: the full vowel system, tanwīn, sun/moon letters, four forms
// in context, and transitioning from letter recognition to word reading.
// ============================================================================

import type { Level } from "../types";

export const level3: Level = {
  id: "L3",
  order: 3,
  title: "Vowels, Forms, and First Reading",
  subtitle: "Bringing the letters to life",
  theme: "harakat",
  goal: "Read vocalized Arabic words end-to-end, apply the harakat system correctly, and recognize letters in their connected forms.",
  lessons: [
    {
      id: "L3.1",
      levelId: "L3",
      order: 1,
      title: "Fatḥa, Kasra, Ḍamma",
      subtitle: "The three short vowels and the vocalization system",
      theme: "harakat",
      estimatedMinutes: 40,
      xp: 75,
      prerequisites: ["L2.7"],
      summary: "The three marks that make Arabic's 28 consonants into readable words.",
      wrapUp: "You can now vocalize any consonant. The next two lessons build up the rest of the mark set.",
      activities: [
        {
          kind: "info",
          title: "Why harakat exist",
          body:
            "Arabic's writing system is an ABJAD — a consonantal script. It writes consonants by default and treats short vowels as optional annotations.\n\n" +
            "For a native, this works because:\n" +
            "  • Arabic roots are consonantal (K-T-B = writing). The vowels are predictable from the morphological pattern.\n" +
            "  • Context + morphology + familiarity make most words unambiguous even without vowels.\n\n" +
            "For a beginner, this DOES NOT work — you lack the pattern intuition. So we use HARAKAT (small marks above/below the consonant) as training wheels.\n\n" +
            "Where you'll see fully vocalized Arabic:\n" +
            "  • The Qurʾān (every letter)\n" +
            "  • Children's books\n" +
            "  • Language textbooks\n" +
            "  • Poetry, to ensure meter\n" +
            "  • Dictionaries (to specify pronunciation)\n\n" +
            "Where you'll see UNVOCALIZED Arabic:\n" +
            "  • Newspapers\n" +
            "  • Novels for adults\n" +
            "  • Road signs, product packaging\n" +
            "  • Most everyday writing\n\n" +
            "The bargain: we'll write harakat for you through Level 6. From Level 7 onward, we'll start dropping them. By Level 10, you'll read passages with only essential vocalization — just like a real newspaper.",
        },
        {
          kind: "info",
          title: "Fatḥa ـَ — the 'a' vowel",
          body:
            "A short diagonal slash ABOVE the consonant.\n\n" +
            "  بَ → 'ba'  (like English 'ba' in 'bat', short)\n" +
            "  تَ → 'ta'\n" +
            "  مَ → 'ma'\n\n" +
            "Fatḥa is the most common vowel in Arabic. It's short — roughly half the length of English 'bat'.\n\n" +
            "Near an emphatic consonant (ص ض ط ظ), fatḥa darkens toward 'aw/o':\n" +
            "  صَبْر (ṣabr) — the 'a' sounds fuller than in سَبْر (sabr).",
          showcase: [
            { ar: "بَ", translit: "ba", en: "b + fatḥa" },
            { ar: "تَ", translit: "ta", en: "t + fatḥa" },
            { ar: "مَ", translit: "ma", en: "m + fatḥa" },
            { ar: "كَلَبَ", translit: "kalaba", en: "demonstration of three fatḥas in a row" },
          ],
        },
        {
          kind: "info",
          title: "Kasra ـِ — the 'i' vowel",
          body:
            "A short diagonal slash BELOW the consonant.\n\n" +
            "  بِ → 'bi'  (like English 'ih' — 'bit' shortened)\n" +
            "  تِ → 'ti'\n" +
            "  مِ → 'mi'\n\n" +
            "Kasra is often the vowel that marks GENITIVE case (more on cases in Level 6 and beyond). If a noun is possessed by something, its last vowel is typically a kasra.\n\n" +
            "Kasra near an emphatic still darkens, but less dramatically than fatḥa.",
          showcase: [
            { ar: "بِ", translit: "bi", en: "b + kasra" },
            { ar: "تِ", translit: "ti", en: "t + kasra" },
            { ar: "مِ", translit: "mi", en: "m + kasra" },
            { ar: "بِنْت", translit: "bint", en: "girl — ب with kasra" },
          ],
        },
        {
          kind: "info",
          title: "Ḍamma ـُ — the 'u' vowel",
          body:
            "A tiny comma-like curl ABOVE the consonant (resembles a small و).\n\n" +
            "  بُ → 'bu'  (like English 'put' shortened)\n" +
            "  تُ → 'tu'\n" +
            "  مُ → 'mu'\n\n" +
            "Ḍamma is often the vowel that marks NOMINATIVE case (subject of a sentence). It's also the vowel that appears on the first letter of many derived nouns (mu-FaʿʿaL pattern), which you'll learn in Level 8.",
          showcase: [
            { ar: "بُ", translit: "bu", en: "b + ḍamma" },
            { ar: "تُ", translit: "tu", en: "t + ḍamma" },
            { ar: "مُ", translit: "mu", en: "m + ḍamma" },
            { ar: "مُدَرِّس", translit: "mudarris", en: "teacher — م with ḍamma" },
          ],
        },
        {
          kind: "flashcard",
          prompt: "All three vowel marks on sample letters",
          cards: [
            { ar: "بَ", translit: "ba", en: "fatḥa" },
            { ar: "بِ", translit: "bi", en: "kasra" },
            { ar: "بُ", translit: "bu", en: "ḍamma" },
            { ar: "كَ", translit: "ka", en: "fatḥa" },
            { ar: "كِ", translit: "ki", en: "kasra" },
            { ar: "كُ", translit: "ku", en: "ḍamma" },
            { ar: "لَ", translit: "la", en: "fatḥa" },
            { ar: "لِ", translit: "li", en: "kasra" },
            { ar: "لُ", translit: "lu", en: "ḍamma" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "تَ",
          question: "How is this read?",
          choices: ["ti", "tu", "ta", "t (no vowel)"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "كِ",
          question: "How is this read?",
          choices: ["ka", "ki", "ku", "k (no vowel)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "نُ",
          question: "How is this read?",
          choices: ["na", "ni", "nu", "n (no vowel)"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Fatḥa, kasra, and ḍamma are what kind of marks?",
          choices: [
            "Letters in the alphabet",
            "Short-vowel diacritics placed above or below consonants",
            "Tone marks",
            "Punctuation",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which vowel mark appears BELOW the letter?",
          choices: ["fatḥa", "ḍamma", "kasra", "sukūn"],
          correctIndex: 2,
        },
        {
          kind: "typing",
          prompt: "How is مَ read? (Just transliteration.)",
          expected: "ma",
        },
        {
          kind: "typing",
          prompt: "How is بِ read?",
          expected: "bi",
        },
        {
          kind: "typing",
          prompt: "How is كُ read?",
          expected: "ku",
        },
        {
          kind: "fillblank",
          prompt: "The mark ____ placed ABOVE a letter produces the 'a' vowel.",
          blank: "fatḥa",
          en: "fatḥa",
          choices: ["fatḥa", "kasra", "ḍamma", "sukūn"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L3.2",
      levelId: "L3",
      order: 2,
      title: "Sukūn, Shadda, and Long Vowels",
      subtitle: "No vowel, doubled consonants, and stretched sounds",
      theme: "harakat",
      estimatedMinutes: 40,
      xp: 80,
      prerequisites: ["L3.1"],
      summary: "ـْ, ـّ, and the three long-vowel combinations. Now you can read multi-syllable words.",
      wrapUp: "You've got the full reading toolkit now. The next lesson adds tanwīn (indefinite noun endings) and then we start reading real words.",
      activities: [
        {
          kind: "info",
          title: "Sukūn ـْ — 'no vowel'",
          body:
            "A small CIRCLE placed ABOVE a consonant. It means: pronounce this consonant with NO vowel following it — it closes the previous syllable.\n\n" +
            "Example: مَكْتَب (maktab, office)\n" +
            "  م + fatḥa = 'ma'\n" +
            "  ك + sukūn = 'k' (no vowel; it closes the 'mak' syllable)\n" +
            "  ت + fatḥa = 'ta'\n" +
            "  ب = final consonant\n" +
            "  → 'mak-tab'\n\n" +
            "Without sukūn, you'd read this as maKaTaB with three separate syllables. Sukūn compresses ك into the previous syllable.\n\n" +
            "Rule: sukūn never appears on the FIRST letter of a word (you can't start a word with no vowel). It only appears mid-word or at a word-final consonant.",
          showcase: [
            { ar: "مَكْتَب", translit: "maktab", en: "office — sukūn on ك" },
            { ar: "بِنْت", translit: "bint", en: "girl — sukūn on ن" },
            { ar: "كَلْب", translit: "kalb", en: "dog — sukūn on ل" },
            { ar: "قَلْب", translit: "qalb", en: "heart — sukūn on ل" },
          ],
        },
        {
          kind: "info",
          title: "Shadda ـّ — 'doubled consonant'",
          body:
            "A mark resembling a small 'w' or the letter ش without dots, placed ABOVE a consonant. Meaning: DOUBLE this consonant (hold it slightly longer).\n\n" +
            "Example: مُدَرِّس (mudarris, teacher)\n" +
            "  م + ḍamma = 'mu'\n" +
            "  د + fatḥa = 'da'\n" +
            "  ر with SHADDA + kasra = 'rri' (hold the r)\n" +
            "  س = final consonant\n" +
            "  → 'mu-dar-ris'\n\n" +
            "In English, we often blur doubled consonants (e.g., 'unnoticed' → we don't really hold the 'n'). In Arabic, the doubling is AUDIBLE and phonemically important:\n\n" +
            "  دَرَسَ (darasa) — he studied\n" +
            "  دَرَّسَ (darrasa) — he taught (caused to study)\n\n" +
            "Same letters, same vowels — shadda on ر changes the meaning.\n\n" +
            "A shadda can combine with a vowel mark: the vowel sits on top of or below the shadda.",
          showcase: [
            { ar: "مُدَرِّس", translit: "mudarris", en: "male teacher — shadda on ر" },
            { ar: "سُكَّر", translit: "sukkar", en: "sugar — shadda on ك" },
            { ar: "اللَّه", translit: "Allāh", en: "God — shadda on ل" },
            { ar: "دَرَّسَ", translit: "darrasa", en: "he taught (caused to study)" },
          ],
        },
        {
          kind: "info",
          title: "Long vowels — the three long-vowel combinations",
          body:
            "Short vowel + matching 'weak letter' = long vowel.\n\n" +
            "  ـَ + ا = long 'ā'   (fatḥa + alif)\n" +
            "  ـِ + ي = long 'ī'   (kasra + yāʾ)\n" +
            "  ـُ + و = long 'ū'   (ḍamma + wāw)\n\n" +
            "Examples:\n" +
            "  بَاب (bāb) — door — ب with fatḥa, then alif = 'bā'\n" +
            "  فِي (fī) — in — ف with kasra, then yāʾ = 'fī'\n" +
            "  نُور (nūr) — light — ن with ḍamma, then wāw = 'nū'\n\n" +
            "Duration matters: a long vowel is held about twice as long as a short one. Mispronouncing length can change meaning:\n\n" +
            "  كَتَبَ (kataba) — he wrote\n" +
            "  كاتَبَ (kātaba) — he corresponded with (form III verb)\n\n" +
            "The only difference is a long 'ā' after ك.",
          showcase: [
            { ar: "بَاب", translit: "bāb", en: "door" },
            { ar: "فِي", translit: "fī", en: "in" },
            { ar: "نُور", translit: "nūr", en: "light" },
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "جَميل", translit: "jamīl", en: "beautiful (m)" },
            { ar: "سُوق", translit: "sūq", en: "market" },
          ],
        },
        {
          kind: "info",
          title: "Diphthongs — aw and ay",
          body:
            "When fatḥa is followed by a CONSONANT و or ي (not long vowels), you get a diphthong:\n\n" +
            "  ـَ + ْو  = 'aw'   (fatḥa + wāw with sukūn)\n" +
            "  ـَ + ْي  = 'ay'   (fatḥa + yāʾ with sukūn)\n\n" +
            "Examples:\n" +
            "  يَوم (yawm) — day\n" +
            "  بَيت (bayt) — house\n" +
            "  لَيل (layl) — night\n" +
            "  شَيء (shayʾ) — thing\n\n" +
            "The و/ي here is the CONSONANT, not a long vowel. The distinguishing clue: the preceding vowel is fatḥa, and the و or ي carries a sukūn.",
        },
        {
          kind: "flashcard",
          prompt: "Reading multi-letter chunks",
          cards: [
            { ar: "مَكْ", translit: "mak", en: "fatḥa + sukūn" },
            { ar: "بِنْ", translit: "bin", en: "kasra + sukūn" },
            { ar: "رِّ", translit: "rri", en: "shadda with kasra" },
            { ar: "با", translit: "bā", en: "long ā" },
            { ar: "في", translit: "fī", en: "long ī" },
            { ar: "نو", translit: "nū", en: "long ū" },
            { ar: "بَي", translit: "bay", en: "diphthong ay" },
            { ar: "يَو", translit: "yaw", en: "diphthong aw" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "بِنْت",
          question: "How is this word read?",
          choices: ["banat", "bint", "bunt", "bīnt"],
          correctIndex: 1,
          explain: "ب with kasra = 'bi'. ن with sukūn = 'n' (closes the syllable). ت = 't'. → 'bint' (girl).",
        },
        {
          kind: "mcq",
          arabicPrompt: "سُكَّر",
          question: "How is this read?",
          choices: ["sukar", "sukkar", "sakkar", "sikar"],
          correctIndex: 1,
          explain: "The shadda on ك doubles it: 'suk-kar' (sugar). English 'sugar' comes from this Arabic word via Medieval Latin.",
        },
        {
          kind: "mcq",
          arabicPrompt: "كِتاب",
          question: "How is this read?",
          choices: ["katab", "kitāb", "kutub", "kattab"],
          correctIndex: 1,
          explain: "ك+kasra = 'ki'. ت+fatḥa+alif = 'tā' (long). ب = 'b'. → kitāb (book).",
        },
        {
          kind: "mcq",
          arabicPrompt: "يَوم",
          question: "How is this read?",
          choices: ["yūm", "yawm", "yam", "yam"],
          correctIndex: 1,
          explain: "ي+fatḥa = 'ya'. و+sukūn = consonant w. → 'yawm' (day) — a diphthong, not a long vowel.",
        },
        {
          kind: "mcq",
          question: "The mark ـّ (shadda) means:",
          choices: [
            "Skip this letter",
            "Double this consonant",
            "Replace this vowel",
            "Emphasize this syllable",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which combination produces a long 'ū' vowel?",
          choices: [
            "ḍamma + alif",
            "ḍamma + wāw",
            "ḍamma + yāʾ",
            "fatḥa + wāw (diphthong)",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "دَرَسَ means 'he studied'. دَرَّسَ (with shadda on ر) means:",
          choices: [
            "He studied (same)",
            "He taught (caused to study)",
            "He didn't study",
            "He's studying",
          ],
          correctIndex: 1,
          explain: "Shadda on the middle letter of the root creates Form II — the CAUSATIVE / INTENSIVE verb. darasa (studied) → darrasa (taught).",
        },
        {
          kind: "typing",
          prompt: "Type how مَكْتَب is pronounced.",
          expected: "maktab",
        },
        {
          kind: "typing",
          prompt: "Type how مُدَرِّس is pronounced.",
          expected: "mudarris",
        },
        {
          kind: "typing",
          prompt: "Type how نُور is pronounced.",
          expected: "nur",
          altAccepted: ["nūr", "noor"],
        },
        {
          kind: "fillblank",
          prompt: "The mark ____ means 'no vowel follows this letter; close the syllable'.",
          blank: "sukūn",
          en: "sukūn",
          choices: ["fatḥa", "sukūn", "shadda", "kasra"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L3.3",
      levelId: "L3",
      order: 3,
      title: "Tanwīn and the Indefinite Noun",
      subtitle: "Why 'shukran' ends with 'an'",
      theme: "harakat",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L3.2"],
      summary: "The doubled vowel marks that add 'n' — and signal 'a/an' in Arabic.",
      wrapUp: "You can now read every short mark in the system. Every Arabic text is now readable to you — even if you don't know all the words.",
      activities: [
        {
          kind: "info",
          title: "What is tanwīn?",
          body:
            "TANWĪN is a grammatical feature that adds an 'n' sound to the END of a noun to indicate INDEFINITENESS ('a book', not 'the book').\n\n" +
            "Arabic has NO indefinite article — no word for 'a' or 'an'. Instead, indefinite is marked by this 'n'-sound ending attached to the word's final short vowel.\n\n" +
            "Tanwīn is written by DOUBLING the vowel mark:\n" +
            "  ـً (fatḥatān) — 'an'\n" +
            "  ـٍ (kasratān) — 'in'\n" +
            "  ـٌ (ḍammatān) — 'un'\n\n" +
            "Rule: tanwīn only appears on the FINAL letter of a word, and only on nouns/adjectives (not verbs).\n\n" +
            "Each tanwīn marks a different grammatical case:\n" +
            "  ـً (an) — accusative (direct object; some adverbs)\n" +
            "  ـٍ (in) — genitive (after prepositions; possessed nouns)\n" +
            "  ـٌ (un) — nominative (subject)\n\n" +
            "Don't worry about mastering cases yet — that's Level 6. Just recognize the sound when you read.",
        },
        {
          kind: "info",
          title: "Tanwīn in everyday words",
          body:
            "Many common words you'll hear end in tanwīn:\n\n" +
            "  شُكراً (shukran) — thanks\n" +
            "  أَهلاً (ahlan) — hi / welcome\n" +
            "  عَفواً (ʿafwan) — you're welcome / pardon\n" +
            "  جِدّاً (jiddan) — very / much\n" +
            "  حَسَناً (ḥasanan) — fine / OK (literally 'well')\n" +
            "  مَرحَباً (marḥaban) — hello\n" +
            "  غَداً (ghadan) — tomorrow\n\n" +
            "Notice: when the word ends in a consonant, fatḥatān is WRITTEN on a silent alif (ـً on ا) for spelling convention. So 'shukran' is spelled شُكراً with a trailing alif + fatḥatān.\n\n" +
            "Exception: if the word ends in ة (tāʾ marbūṭa) or ء (hamza), no trailing alif is needed — tanwīn sits directly on the last letter.",
          showcase: [
            { ar: "شُكراً", translit: "shukran", en: "thanks" },
            { ar: "أَهلاً", translit: "ahlan", en: "hi / welcome" },
            { ar: "عَفواً", translit: "ʿafwan", en: "pardon / you're welcome" },
            { ar: "جِدّاً", translit: "jiddan", en: "very" },
            { ar: "مَرحَباً", translit: "marḥaban", en: "hello" },
            { ar: "كِتابٌ", translit: "kitābun", en: "a book (nominative)" },
            { ar: "كِتابٍ", translit: "kitābin", en: "a book (genitive)" },
            { ar: "كِتاباً", translit: "kitāban", en: "a book (accusative)" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "شُكراً",
          question: "How is this read, and what does it mean?",
          choices: [
            "shukra — 'thanks'",
            "shukran — 'thanks'",
            "shukrin — 'thanks' (genitive)",
            "shukri — 'my thanks'",
          ],
          correctIndex: 1,
          explain: "The fatḥatān on the silent alif reads as 'an'. Full word: shukran.",
        },
        {
          kind: "mcq",
          question: "Arabic indicates INDEFINITE ('a book' vs 'the book') by:",
          choices: [
            "A separate word placed before the noun",
            "Doubled vowel marks (tanwīn) attached to the final letter",
            "A prefix attached to the verb",
            "Capitalization",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The three tanwīn marks ـً ـٍ ـٌ correspond to which three grammatical cases?",
          choices: [
            "Past, present, future",
            "Masculine, feminine, neuter",
            "Accusative, genitive, nominative",
            "Singular, dual, plural",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Why is 'shukran' spelled with a silent alif at the end (شُكراً)?",
          choices: [
            "The alif is pronounced 'ā'",
            "Spelling convention — fatḥatān is written on a trailing silent alif when the word ends in a consonant",
            "To double the 'r'",
            "To mark feminine gender",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "شُكراً", en: "thanks" },
            { ar: "أَهلاً", en: "hi / welcome" },
            { ar: "عَفواً", en: "pardon / you're welcome" },
            { ar: "مَرحَباً", en: "hello" },
            { ar: "غَداً", en: "tomorrow" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of أَهلاً (hi).",
          expected: "ahlan",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَرحَباً (hello).",
          expected: "marhaban",
          altAccepted: ["marḥaban", "marhaba"],
        },
        {
          kind: "fillblank",
          prompt: "Tanwīn (doubled vowel marks) attaches to nouns and adjectives to mark ____.",
          blank: "indefiniteness",
          en: "indefiniteness (a / an)",
          choices: [
            "indefiniteness (a / an)",
            "past tense",
            "plural number",
            "negation",
          ],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L3.4",
      levelId: "L3",
      order: 4,
      title: "Letter Forms in Context",
      subtitle: "One letter, up to four shapes — seen in real words",
      theme: "alphabet",
      estimatedMinutes: 40,
      xp: 85,
      prerequisites: ["L3.3"],
      summary: "What initial/medial/final shapes actually look like in connected writing.",
      wrapUp: "Connected Arabic is no longer mysterious. The same letter in a word just looks compressed — dots and distinctive features persist.",
      activities: [
        {
          kind: "info",
          title: "The four forms — review and rules",
          body:
            "Every letter has up to FOUR forms depending on its position in a word:\n\n" +
            "  ISOLATED — standing alone, or following a non-connector\n" +
            "  INITIAL   — at the start of a word, connecting RIGHT\n" +
            "  MEDIAL    — in the middle, connecting both sides\n" +
            "  FINAL     — at the end, connecting on the LEFT (from the previous letter)\n\n" +
            "For MOST letters, the isolated form is the 'full' version. Initial and medial forms are compressed, often dropping the tail. Final forms are often similar to isolated but joined on the right.\n\n" +
            "The six non-connectors (ا د ذ ر ز و) have only TWO forms: isolated and final. Because they don't connect to the letter after them, an initial form would be pointless, and medial is just the final form.",
        },
        {
          kind: "info",
          title: "Worked example: ب (bāʾ)",
          body:
            "ب has all four forms:\n\n" +
            "  Isolated: ب       (boat body with dot below, tail curving right)\n" +
            "  Initial:  بـ      (just a 'tooth' with a dot below, ready to connect left)\n" +
            "  Medial:   ـبـ     (tooth with dot below, connected both sides)\n" +
            "  Final:    ـب      (tooth + curling tail, connected from the right)\n\n" +
            "In the word كَتَبَ (kataba, 'he wrote'):\n" +
            "  ك — initial form\n" +
            "  ت — medial form\n" +
            "  ب — final form\n\n" +
            "Note how the shapes compress when connected. The DOT PATTERN never changes — that's your anchor.",
          showcase: [
            { ar: "ب", translit: "bāʾ isolated", en: "alone" },
            { ar: "بـ", translit: "initial", en: "e.g. بَيت (bayt, house)" },
            { ar: "ـبـ", translit: "medial", en: "e.g. كَبير (kabīr, big)" },
            { ar: "ـب", translit: "final", en: "e.g. كَتَبَ (kataba, he wrote)" },
          ],
        },
        {
          kind: "info",
          title: "Worked example: ع (ʿayn)",
          body:
            "ʿayn's four forms are the most visually dramatic — the letter barely looks the same in each:\n\n" +
            "  Isolated: ع\n" +
            "  Initial:  عـ      (just a small angle, mostly closed)\n" +
            "  Medial:   ـعـ     (a diamond-shape pocket, connected both sides)\n" +
            "  Final:    ـع      (opens downward with a tail)\n\n" +
            "Example words:\n" +
            "  عِلم (ʿilm, knowledge) — initial form\n" +
            "  مَعَ (maʿa, with) — medial form\n" +
            "  رَبِيع (rabīʿ, spring) — final form\n" +
            "  وَدَاع (wadāʿ, farewell) — final form (after non-connector ا)",
        },
        {
          kind: "info",
          title: "Non-connectors — only two forms",
          body:
            "The six non-connectors (ا د ذ ر ز و) don't have initial or medial forms. Wherever they sit, they connect ONLY from the right.\n\n" +
            "When a non-connector appears mid-word, the letter AFTER it starts fresh in its initial form — you see a visible gap.\n\n" +
            "Example: دَرَسَ (darasa, 'he studied'):\n" +
            "  د — non-connector (standalone form, no right-connection here because it's initial)\n" +
            "  ر — non-connector (starts fresh because د doesn't connect forward)\n" +
            "  س — initial form (because ر doesn't connect forward either)\n" +
            "  (and there's no letter after س to force compression)",
          showcase: [
            { ar: "دَرَسَ", translit: "darasa", en: "he studied — three non-connector-related breaks" },
            { ar: "أُستاذ", translit: "ustādh", en: "professor" },
            { ar: "زَوج", translit: "zawj", en: "husband" },
          ],
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
          prompt: "Which is the MEDIAL form of م?",
          target: "ـمـ",
          choices: ["م", "مـ", "ـمـ", "ـم"],
          correctIndex: 2,
        },
        {
          kind: "trace",
          prompt: "Which is the FINAL form of ع?",
          target: "ـع",
          choices: ["ع", "عـ", "ـعـ", "ـع"],
          correctIndex: 3,
        },
        {
          kind: "trace",
          prompt: "Which is the INITIAL form of ك?",
          target: "كـ",
          choices: ["ك", "كـ", "ـكـ", "ـك"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Why do ا د ذ ر ز و have only TWO forms instead of four?",
          choices: [
            "They're the most common letters",
            "They're non-connectors — they don't connect to the letter AFTER them",
            "They are vowels, not consonants",
            "It's a historical accident",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In the word كَتَبَ (kataba), the letter ت appears in which form?",
          choices: ["Isolated", "Initial", "Medial", "Final"],
          correctIndex: 2,
          explain: "Middle letter of a three-letter word — medial form. Look for the 'tooth' with two dots above, connected on both sides.",
        },
        {
          kind: "mcq",
          question: "When reading, what should you use to IDENTIFY a letter in an unfamiliar form?",
          choices: [
            "The letter's tail — it's always distinctive",
            "The dot pattern — it's invariant across forms",
            "Context — just guess from surrounding letters",
            "The size — letters scale differently",
          ],
          correctIndex: 1,
          explain: "Dot count and placement are INVARIANT across all four forms. That's your anchor when a letter's body is unfamiliar.",
        },
        {
          kind: "fillblank",
          prompt: "A non-connector in the middle of a word forces the letter AFTER it to appear in its ____ form.",
          blank: "initial",
          en: "initial",
          choices: ["isolated", "initial", "medial", "final"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L3.5",
      levelId: "L3",
      order: 5,
      title: "Sun Letters and Moon Letters",
      subtitle: "How 'the' is pronounced",
      theme: "grammar",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L3.4"],
      summary: "The definite article الـ (al-) is WRITTEN the same way always, but PRONOUNCED two different ways.",
      wrapUp: "Sun/moon letters is the single most audible phonological rule in Arabic. Every vocalized text follows it — even if writers don't always mark it.",
      activities: [
        {
          kind: "info",
          title: "The definite article — al-",
          body:
            "Arabic has ONE definite article, always attached to the noun (no space): الـ (al-, 'the').\n\n" +
            "  كِتاب (kitāb) — a book\n" +
            "  الكِتاب (al-kitāb) — the book\n\n" +
            "It's always written the same way. But depending on what letter follows it, the 'l' is SOMETIMES silent and the following letter DOUBLES.",
        },
        {
          kind: "info",
          title: "Sun letters (ḥurūf shamsiyya) — l assimilates",
          body:
            "When the noun starts with one of 14 'SUN' letters, the 'l' of 'al-' is SILENT and the following letter is doubled.\n\n" +
            "The 14 sun letters: ت ث د ذ ر ز س ش ص ض ط ظ ل ن\n\n" +
            "Why they're called 'sun letters': the Arabic word for SUN is شَمس (shams). It begins with ش, which is a sun letter. So 'the sun' is written الشَّمس but PRONOUNCED ash-shams — the 'l' is silent and the ش is doubled.\n\n" +
            "More examples:\n" +
            "  التَّمر → at-tamr (the dates)  —  not 'al-tamr'\n" +
            "  السَّلام → as-salām (the peace)  —  this is why the greeting is 'as-salāmu ʿalaykum', not 'al-'\n" +
            "  الرَّجُل → ar-rajul (the man)\n\n" +
            "In fully vocalized text, you'll see a shadda (ـّ) on the sun letter to mark the doubling. In unvocalized text, you have to KNOW the rule.\n\n" +
            "Phonetic reason: all 14 sun letters are produced with the TONGUE TIP at or near where 'l' is produced. The 'l' assimilates into them for ease of articulation.",
          showcase: [
            { ar: "الشَّمس", translit: "ash-shams", en: "the sun" },
            { ar: "السَّلام", translit: "as-salām", en: "the peace" },
            { ar: "التَّمر", translit: "at-tamr", en: "the dates" },
            { ar: "الرَّجُل", translit: "ar-rajul", en: "the man" },
            { ar: "النُّور", translit: "an-nūr", en: "the light" },
          ],
        },
        {
          kind: "info",
          title: "Moon letters (ḥurūf qamariyya) — l stays",
          body:
            "The other 14 letters are called MOON LETTERS. With these, 'al-' is pronounced clearly — no assimilation.\n\n" +
            "The 14 moon letters: أ ب ج ح خ ع غ ف ق ك م ه و ي (plus the hamza)\n\n" +
            "Called 'moon letters' because the Arabic word for moon is قَمَر (qamar), which starts with ق (a moon letter). So 'the moon' is الْقَمَر, pronounced al-qamar, with a clear 'l'.\n\n" +
            "More examples:\n" +
            "  الكِتاب → al-kitāb (the book)\n" +
            "  البَيت → al-bayt (the house)\n" +
            "  المَدينة → al-madīna (the city)\n" +
            "  الحَمدُ لله → al-ḥamdu lillāh (praise to God)",
          showcase: [
            { ar: "القَمَر", translit: "al-qamar", en: "the moon" },
            { ar: "الكِتاب", translit: "al-kitāb", en: "the book" },
            { ar: "البَيت", translit: "al-bayt", en: "the house" },
            { ar: "المَدينة", translit: "al-madīna", en: "the city" },
            { ar: "الحَمدُ لله", translit: "al-ḥamdu lillāh", en: "praise to God" },
          ],
        },
        {
          kind: "info",
          title: "A rough test (no need to memorize the lists)",
          body:
            "If the noun begins with one of these tongue-tip consonants, it's a SUN letter:\n" +
            "  ت ث د ذ ر ز س ش ص ض ط ظ ل ن\n\n" +
            "Mnemonic: these are all produced with the tongue tip at the teeth or alveolar ridge. Everything else (throat letters, labials, velar k, voiced/voiceless h, etc.) is a MOON letter.\n\n" +
            "You don't need to memorize the list today. Listen for the pattern when you hear vocalized Arabic and it'll internalize.\n\n" +
            "Writing behavior:\n" +
            "  • Fully vocalized: sun letters get a shadda; the sukūn on the 'l' is usually omitted.\n" +
            "  • Unvocalized: الـ is always written the same way — you infer pronunciation.\n" +
            "  • Transliteration: some systems write 'al-shams', others write 'ash-shams'. Both refer to the same word; the second reflects pronunciation.",
        },
        {
          kind: "mcq",
          arabicPrompt: "الشَّمس",
          question: "This word is pronounced:",
          choices: ["al-shams", "ash-shams", "al-sams", "az-shams"],
          correctIndex: 1,
          explain: "ش is a sun letter, so the 'l' is silent and ش doubles. → ash-shams.",
        },
        {
          kind: "mcq",
          arabicPrompt: "القَمَر",
          question: "This word is pronounced:",
          choices: ["al-qamar", "aq-qamar", "ak-qamar", "a-qamar"],
          correctIndex: 0,
          explain: "ق is a moon letter, so 'l' stays. → al-qamar.",
        },
        {
          kind: "mcq",
          question: "Which is a SUN letter (causes l-assimilation)?",
          choices: ["ب", "ر", "ك", "م"],
          correctIndex: 1,
          explain: "ر (rāʾ) is a sun letter. So 'the man' (الرَّجُل) is pronounced ar-rajul, not al-rajul.",
        },
        {
          kind: "mcq",
          question: "Which is a MOON letter (l is pronounced clearly)?",
          choices: ["ت", "د", "ف", "س"],
          correctIndex: 2,
          explain: "ف is a moon letter. الفُندُق 'the hotel' is pronounced al-funduq.",
        },
        {
          kind: "mcq",
          question: "The phonetic reason the 'l' assimilates into sun letters is:",
          choices: [
            "Historical accident with no phonetic basis",
            "Sun letters are all produced with the tongue tip at or near where 'l' is produced",
            "Sun letters are feminine",
            "Sun letters are more common",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match the word (as written) to its correct pronunciation",
          pairs: [
            { ar: "الشَّمس", en: "ash-shams" },
            { ar: "القَمَر", en: "al-qamar" },
            { ar: "السَّلام", en: "as-salām" },
            { ar: "الكِتاب", en: "al-kitāb" },
            { ar: "النُّور", en: "an-nūr" },
            { ar: "البَيت", en: "al-bayt" },
          ],
        },
        {
          kind: "typing",
          prompt: "How is الشَّمس pronounced? (Dashes OK, lowercase.)",
          expected: "ash-shams",
          altAccepted: ["ashshams", "ash shams"],
        },
        {
          kind: "typing",
          prompt: "How is القَمَر pronounced?",
          expected: "al-qamar",
          altAccepted: ["alqamar", "al qamar"],
        },
        {
          kind: "fillblank",
          prompt: "'Peace be upon you' is السَّلام عَلَيكُم. It starts with ____, because س is a sun letter.",
          blank: "as-",
          en: "as-",
          choices: ["al-", "as-", "at-", "ar-"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L3.6",
      levelId: "L3",
      order: 6,
      title: "Reading Your First Real Words",
      subtitle: "Put everything together — read, don't guess",
      theme: "reading",
      estimatedMinutes: 35,
      xp: 90,
      prerequisites: ["L3.5"],
      summary: "12 high-frequency words, read letter-by-letter with full vocalization.",
      wrapUp: "You can now read vocalized Arabic. The next 7 levels are about vocabulary, grammar, and context — the reading itself is solved.",
      activities: [
        {
          kind: "info",
          title: "A reading method for beginners",
          body:
            "When you encounter a new vocalized Arabic word, go LEFT-EDGE to RIGHT-EDGE of each letter cluster, in this order:\n\n" +
            "  1. IDENTIFY the letter (by body + dots).\n" +
            "  2. READ its vowel mark (or sukūn, or shadda + vowel).\n" +
            "  3. CONCATENATE syllables.\n\n" +
            "Example: بِنْت (girl)\n" +
            "  ب — bāʾ. Mark is kasra → 'bi'.\n" +
            "  ن — nūn. Mark is sukūn → 'n' (close syllable: 'bin').\n" +
            "  ت — tāʾ. No visible vowel at end → 't'. Full: 'bint'.\n\n" +
            "Example: مَكْتَبة (library)\n" +
            "  م — mīm + fatḥa → 'ma'\n" +
            "  ك — kāf + sukūn → 'k' (closes: 'mak')\n" +
            "  ت — tāʾ + fatḥa → 'ta'\n" +
            "  ب — bāʾ + fatḥa → 'ba'\n" +
            "  ة — tāʾ marbūṭa → silent or soft 'h' (feminine). Stop: 'maktaba'.\n\n" +
            "With practice this process telescopes into instant recognition. For now, slow is fine.",
        },
        {
          kind: "info",
          title: "High-frequency vocabulary — read each one",
          body: "These are some of the most common words in Arabic. Read each one letter by letter using the method above.",
          showcase: [
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "بَيت", translit: "bayt", en: "house" },
            { ar: "ماء", translit: "māʾ", en: "water" },
            { ar: "قَلَم", translit: "qalam", en: "pen" },
            { ar: "وَلَد", translit: "walad", en: "boy" },
            { ar: "بِنت", translit: "bint", en: "girl" },
            { ar: "باب", translit: "bāb", en: "door" },
            { ar: "شَمس", translit: "shams", en: "sun" },
            { ar: "قَمَر", translit: "qamar", en: "moon" },
            { ar: "رَجُل", translit: "rajul", en: "man" },
            { ar: "اِمرأة", translit: "imraʾa", en: "woman" },
            { ar: "مَكتَبة", translit: "maktaba", en: "library" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "كِتاب",
          question: "This word means:",
          choices: ["pen", "book", "door", "desk"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "بَيت",
          question: "This word means:",
          choices: ["between", "house", "egg", "life"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "قَلَم",
          question: "This word means:",
          choices: ["pen", "pencil (only)", "paper", "book"],
          correctIndex: 0,
          explain: "qalam covers pen, pencil, or any writing instrument — one root (q-l-m) meaning 'to shape / trim', because reeds were trimmed to write with.",
        },
        {
          kind: "mcq",
          arabicPrompt: "اِمرأة",
          question: "This word means:",
          choices: ["man", "woman", "mother", "child"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "مَكتَبة",
          question: "This word means:",
          choices: [
            "office",
            "library / bookstore",
            "desk",
            "writer",
          ],
          correctIndex: 1,
          explain: "maktaba — place where many books live. From the same root as kitāb (book), kātib (writer), maktab (office/desk). The ـة suffix often forms a place noun from a verbal root.",
        },
        {
          kind: "mcq",
          question: "Three words share the root ك-ت-ب (k-t-b). They are:",
          choices: [
            "kitāb, kalb, bayt",
            "kitāb, kātib, maktaba",
            "qamar, qalam, qalb",
            "walad, bint, imraʾa",
          ],
          correctIndex: 1,
          explain: "kitāb (book), kātib (writer), maktaba (library) all derive from the same 3-letter root carrying the sense of 'writing'. This is the ROOT-AND-PATTERN system that runs through all of Arabic vocabulary.",
        },
        {
          kind: "match",
          prompt: "Match the Arabic word to its English meaning",
          pairs: [
            { ar: "كِتاب", en: "book" },
            { ar: "بَيت", en: "house" },
            { ar: "ماء", en: "water" },
            { ar: "قَلَم", en: "pen" },
            { ar: "وَلَد", en: "boy" },
            { ar: "بِنت", en: "girl" },
            { ar: "شَمس", en: "sun" },
            { ar: "قَمَر", en: "moon" },
            { ar: "رَجُل", en: "man" },
            { ar: "اِمرأة", en: "woman" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of شَمس.",
          expected: "shams",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of بَيت.",
          expected: "bayt",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of قَلَم.",
          expected: "qalam",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَكتَبة.",
          expected: "maktaba",
        },
        {
          kind: "fillblank",
          prompt: "Three words that share an Arabic ____ carry related meanings — e.g., kitāb, kātib, maktaba all mean things related to writing.",
          blank: "root",
          en: "root (3-letter consonant skeleton)",
          choices: ["suffix", "prefix", "root", "gender"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L3.7",
      levelId: "L3",
      order: 7,
      title: "Level 3 Review",
      subtitle: "Vowels, forms, article, reading",
      theme: "review",
      estimatedMinutes: 35,
      xp: 120,
      prerequisites: ["L3.6"],
      summary: "Comprehensive review of the entire reading system.",
      wrapUp: "Everything past this point is ABOUT CONTENT — the mechanics are yours. Next up: what to actually SAY in Arabic.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "تِ",
          question: "How is this read?",
          choices: ["ta", "ti", "tu", "t"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "كُ",
          question: "How is this read?",
          choices: ["ka", "ki", "ku", "kū"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "The mark ـْ is called:",
          choices: ["fatḥa", "sukūn", "shadda", "kasra"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The mark ـّ (shadda) indicates:",
          choices: ["no vowel", "long vowel", "doubled consonant", "indefinite ending"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "شُكراً",
          question: "This word is read as ____ and means ____.",
          choices: [
            "shukr, 'gratitude'",
            "shukran, 'thank you'",
            "shukri, 'my thanks'",
            "ashkur, 'I thank'",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The combination ـَ + ا produces:",
          choices: [
            "A diphthong 'aw'",
            "A long 'ā' vowel",
            "A short 'a' followed by a silent letter",
            "A short 'a' followed by glottal stop",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "السَّلام",
          question: "This word is pronounced:",
          choices: ["al-salām", "as-salām", "at-salām", "aṣ-ṣalām"],
          correctIndex: 1,
          explain: "س is a sun letter — the 'l' assimilates and ص... wait, س. Same principle: doubled s, silent l. → as-salām.",
        },
        {
          kind: "mcq",
          question: "Sun letters cause:",
          choices: [
            "The vowel before them to lengthen",
            "The 'l' of 'al-' to assimilate (become silent, next letter doubles)",
            "The letter after them to disappear",
            "A change in meaning",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Non-connectors (ا د ذ ر ز و) have how many FORMS?",
          choices: ["One", "Two (isolated + final)", "Three", "Four like every letter"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "مَكتَبة",
          question: "This word means:",
          choices: ["office / desk", "library / bookstore", "writer", "book"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match each Arabic word to its English meaning",
          pairs: [
            { ar: "كِتاب", en: "book" },
            { ar: "قَلَم", en: "pen" },
            { ar: "بَيت", en: "house" },
            { ar: "ماء", en: "water" },
            { ar: "شَمس", en: "sun" },
            { ar: "قَمَر", en: "moon" },
            { ar: "وَلَد", en: "boy" },
            { ar: "بِنت", en: "girl" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the pronunciation of الشَّمس.",
          expected: "ash-shams",
          altAccepted: ["ashshams", "ash shams"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of سُكَّر.",
          expected: "sukkar",
        },
        {
          kind: "fillblank",
          prompt: "Arabic has no indefinite article — instead, indefinite nouns take ____ endings (doubled vowels).",
          blank: "tanwīn",
          en: "tanwīn",
          choices: ["alif", "hamza", "tanwīn", "shadda"],
          correctIndex: 2,
        },
      ],
    },
  ],
};
