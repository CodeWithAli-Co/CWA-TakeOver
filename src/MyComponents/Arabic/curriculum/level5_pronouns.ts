// ============================================================================
// LEVEL 5 — Pronouns, "to be", demonstratives, and zero-copula sentences
//
// Depth focus: full 12-person pronoun inventory (including dual), the absence
// of a present-tense copula, gender agreement, demonstratives.
// ============================================================================

import type { Level } from "../types";

export const level5: Level = {
  id: "L5",
  order: 5,
  title: "Pronouns, Demonstratives & 'To Be'",
  subtitle: "The structural backbone of simple Arabic sentences",
  theme: "pronouns",
  goal: "Use all 12 personal pronouns, handle gender agreement, build 'X is Y' sentences without a verb, and use demonstratives.",
  lessons: [
    {
      id: "L5.1",
      levelId: "L5",
      order: 1,
      title: "Singular Pronouns & the Missing Verb",
      subtitle: "anā, anta, anti — and the zero-copula rule",
      theme: "pronouns",
      estimatedMinutes: 35,
      xp: 80,
      prerequisites: ["L4.5"],
      summary: "Three pronouns plus a big grammatical insight: Arabic's present tense has no 'is/am/are'.",
      wrapUp: "'anā ṭālib' — 'I [am] a student' — is a complete sentence with ZERO verbs. This is one of the most useful structural facts in Arabic.",
      activities: [
        {
          kind: "info",
          title: "The singular pronouns",
          body:
            "أَنا (anā) — I (no gender distinction; same for men and women)\n" +
            "أَنْتَ (anta) — you (to a MAN)\n" +
            "أَنْتِ (anti) — you (to a WOMAN)\n\n" +
            "The -a/-i distinction on 'anta/anti' is the SAME pattern you saw in Level 4 with ḥāluka/ḥāluki. Fatḥa = masculine, kasra = feminine. Get used to this pattern: it appears EVERYWHERE in Arabic — on pronouns, on attached possessives (-ka/-ki), on verb endings.\n\n" +
            "English speakers often find 'anta/anti' frustrating because English doesn't mark gender in 'you'. In Arabic, there is no 'neutral you'. You must address someone either as m or f. (Modern Arabic internet/texting sometimes uses 'anta/i' as a hedge, but that's a work-around.)",
        },
        {
          kind: "info",
          title: "The zero copula",
          body:
            "In the English present tense, every sentence needs a form of 'to be':\n" +
            "  'I AM a student.'\n" +
            "  'She IS happy.'\n" +
            "  'We ARE here.'\n\n" +
            "In Arabic present tense, this verb is OMITTED. You just place the subject next to the predicate:\n\n" +
            "  أَنا طالِب (anā ṭālib) — I [am] a student (masculine)\n" +
            "  أَنا طالِبة (anā ṭāliba) — I [am] a student (feminine)\n" +
            "  أَنْتَ ذَكِيّ (anta dhakī) — You [are] smart (to a man)\n" +
            "  أَنْتِ ذَكِيَّة (anti dhakiyya) — You [are] smart (to a woman)\n" +
            "  البَيْت كَبير (al-bayt kabīr) — The house [is] big\n\n" +
            "This is called the NOMINAL SENTENCE (jumla ismiyya). Two parts:\n" +
            "  • MUBTADAʾ (subject) — typically a definite noun or pronoun\n" +
            "  • KHABAR (predicate) — typically an indefinite noun or adjective\n\n" +
            "Past and future tenses DO use an explicit verb (kāna 'was', yakūn 'will be'). Only present is zero-copula.\n\n" +
            "The zero-copula rule makes many sentences shorter in Arabic than in English — you're trading a verb for a simple juxtaposition.",
          showcase: [
            { ar: "أَنا طالِب", translit: "anā ṭālib", en: "I am a student (m)" },
            { ar: "أَنا طالِبة", translit: "anā ṭāliba", en: "I am a student (f)" },
            { ar: "أَنْتَ مُعَلِّم", translit: "anta muʿallim", en: "You are a teacher (m)" },
            { ar: "أَنْتِ مُعَلِّمة", translit: "anti muʿallima", en: "You are a teacher (f)" },
            { ar: "البَيْت كَبير", translit: "al-bayt kabīr", en: "The house is big" },
          ],
        },
        {
          kind: "info",
          title: "Gender agreement — the default rule",
          body:
            "Arabic has GRAMMATICAL GENDER: every noun is either masculine or feminine. Adjectives and verbs must AGREE with the subject's gender.\n\n" +
            "Default marker:\n" +
            "  • Masculine form → the base form, no suffix (ṭālib, kabīr, jamīl, ʿarabī)\n" +
            "  • Feminine form → adds ة (tāʾ marbūṭa) at the end: ṭāliba, kabīra, jamīla, ʿarabiyya\n\n" +
            "About 95% of Arabic nouns follow this rule. The exceptions:\n" +
            "  • Inherent feminine nouns without ة — e.g., أُمّ (umm, mother), بِنت (bint, girl), شَمس (shams, sun), عَيْن (ʿayn, eye), نار (nār, fire)\n" +
            "  • Cities and countries are generally feminine (مَدينة is inherently feminine; most proper country names too)\n" +
            "  • Some nouns are naturally masculine despite ending in ة (e.g., خَليفة 'caliph' is masculine)\n\n" +
            "When in doubt, trust the ة. It's right 9 times out of 10.",
        },
        {
          kind: "mcq",
          question: "'anā ṭālib' means:",
          choices: [
            "You are a student",
            "He is a student",
            "I am a student (male)",
            "We are students",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which form of 'you' do you use addressing a woman?",
          choices: ["anta", "anti", "anā", "huwa"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic present-tense sentences like 'I am a student' use:",
          choices: [
            "An explicit verb 'to be'",
            "A pronoun + adjective with no verb",
            "An auxiliary + adjective",
            "A participle ending",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which is the FEMININE form of the adjective 'big' (kabīr)?",
          choices: ["kabīrū", "kabīra", "kabīrun", "kabīrīn"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The noun أُمّ (umm, 'mother') is feminine despite NOT ending in ة. This means:",
          choices: [
            "It's an exception to spelling conventions",
            "It's inherently feminine by meaning",
            "It takes masculine agreement",
            "It's a loanword",
          ],
          correctIndex: 1,
          explain: "Some nouns are feminine BY MEANING (mother, girl, sister, daughter, eye, sun) even without ة. Adjectives still agree feminine: umm ḥanūna (ḥanūna = loving, fem).",
        },
        {
          kind: "fillblank",
          prompt: "____ mudarris. (I am a teacher — male speaker.)",
          blank: "anā",
          en: "I",
          choices: ["anā", "anta", "anti", "huwa"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "____ mudarrisa. (You are a teacher — addressing a woman.)",
          blank: "anti",
          en: "anti (you-feminine)",
          choices: ["anta", "anti", "anā", "hiya"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match pronoun to meaning",
          pairs: [
            { ar: "أَنا", en: "I" },
            { ar: "أَنْتَ", en: "you (m)" },
            { ar: "أَنْتِ", en: "you (f)" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'I am a student' (male speaker), transliteration.",
          expected: "ana talib",
          altAccepted: ["anā ṭālib", "ana taalib"],
        },
        {
          kind: "typing",
          prompt: "Type 'You are a doctor' (to a woman), transliteration. (ṭabība = female doctor)",
          expected: "anti tabiba",
          altAccepted: ["anti ṭabība", "anti tabeeba"],
        },
      ],
    },

    {
      id: "L5.2",
      levelId: "L5",
      order: 2,
      title: "Huwa, Hiya — Third Person",
      subtitle: "He / she / it — and the hidden 'it'",
      theme: "pronouns",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L5.1"],
      summary: "Arabic has no neutral 'it'. Every object is either he or she.",
      wrapUp: "Every Arabic noun is grammatically gendered. 'Huwa' for masculine things, 'hiya' for feminine. You get used to it in a month.",
      activities: [
        {
          kind: "info",
          title: "هُوَ / هِيَ",
          body:
            "هُوَ (huwa) — he / it (masculine)\n" +
            "هِيَ (hiya) — she / it (feminine)\n\n" +
            "Pronunciation notes:\n" +
            "  • huwa — stress on 'hu'. Short, quick. In dialect often shortened to 'hū' or even just 'hu'.\n" +
            "  • hiya — stress on 'hi'. Similarly sometimes 'hī' in casual speech.\n\n" +
            "Because Arabic has no neutral 'it':\n" +
            "  • A car (sayyāra, feminine) is 'hiya' — 'she is fast'.\n" +
            "  • A book (kitāb, masculine) is 'huwa' — 'he is boring'.\n\n" +
            "Examples:\n" +
            "  هُوَ مُدَرِّس (huwa mudarris) — he is a teacher\n" +
            "  هِيَ مُدَرِّسة (hiya mudarrisa) — she is a teacher\n" +
            "  هُوَ كَبير (huwa kabīr) — he/it is big (referring to some masculine noun)\n" +
            "  هِيَ جَميلة (hiya jamīla) — she/it is beautiful",
          showcase: [
            { ar: "هُوَ", translit: "huwa", en: "he / it (m)" },
            { ar: "هِيَ", translit: "hiya", en: "she / it (f)" },
            { ar: "هُوَ طَبيب", translit: "huwa ṭabīb", en: "he is a doctor" },
            { ar: "هِيَ طَبيبة", translit: "hiya ṭabība", en: "she is a doctor" },
          ],
        },
        {
          kind: "info",
          title: "Expressing 'it' — grammar in action",
          body:
            "Because Arabic has no 'it', you MUST know the gender of the noun you're referring to. Shortcut:\n\n" +
            "  • Ends in ة → almost always feminine → use hiya\n" +
            "  • Inherently feminine words (umm, bint, shams, ʿayn, nār, sayyāra, madīna) → hiya\n" +
            "  • Most others → masculine → use huwa\n\n" +
            "Examples:\n" +
            "  السَّيّارة سَريعة. هِيَ جَديدة.\n" +
            "  as-sayyāra sarīʿa. hiya jadīda.\n" +
            "  'The car is fast. It (she) is new.'\n\n" +
            "  الكِتاب مَشهور. هُوَ مُفيد.\n" +
            "  al-kitāb mashhūr. huwa mufīd.\n" +
            "  'The book is famous. It (he) is useful.'\n\n" +
            "For inanimate PLURALS, Arabic grammar does something surprising: plural things (non-human) are treated as FEMININE SINGULAR for agreement purposes. We'll see this in Level 8. For now: singular objects track their own grammatical gender.",
        },
        {
          kind: "mcq",
          question: "'huwa ṭabīb' means:",
          choices: [
            "He is a student",
            "He is a doctor",
            "She is a doctor",
            "I am a doctor",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'hiya mudarrisa jamīla' means:",
          choices: [
            "He is a handsome teacher",
            "She is a beautiful teacher",
            "They are beautiful teachers",
            "I am a beautiful teacher",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'Is it new?' — 'it' refers to سَيّارة (sayyāra, car). Which pronoun do you use?",
          choices: ["huwa", "hiya", "hum", "it-equivalent does not exist"],
          correctIndex: 1,
          explain: "sayyāra ends in ة → feminine → hiya. Arabic has no neutral 'it'.",
        },
        {
          kind: "mcq",
          question: "The typical feminine marker on Arabic nouns is:",
          choices: [
            "ـي",
            "ـة (tāʾ marbūṭa)",
            "ـُون",
            "ـان",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match pronoun to meaning",
          pairs: [
            { ar: "أَنا", en: "I" },
            { ar: "أَنْتَ", en: "you (m)" },
            { ar: "أَنْتِ", en: "you (f)" },
            { ar: "هُوَ", en: "he / it (m)" },
            { ar: "هِيَ", en: "she / it (f)" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "____ mudarrisa. (She is a teacher.)",
          blank: "hiya",
          en: "she",
          choices: ["huwa", "hiya", "anti", "anā"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ jamīl. (He is handsome.)",
          blank: "huwa",
          en: "he",
          choices: ["huwa", "hiya", "anta", "anā"],
          correctIndex: 0,
        },
        {
          kind: "typing",
          prompt: "Type 'she is a doctor' (f.), transliteration.",
          expected: "hiya tabiba",
          altAccepted: ["hiya ṭabība", "hiya tabeeba"],
        },
      ],
    },

    {
      id: "L5.3",
      levelId: "L5",
      order: 3,
      title: "Plurals: Naḥnu, Antum, Hum — and the Dual",
      subtitle: "Arabic has SEPARATE plural forms for 'you two' and 'you three-or-more'",
      theme: "pronouns",
      estimatedMinutes: 35,
      xp: 80,
      prerequisites: ["L5.2"],
      summary: "Arabic tracks singular / DUAL (exactly two) / plural as three grammatical numbers.",
      wrapUp: "The dual is a feature English lost centuries ago. Arabic keeps it. Every time you talk about exactly two of something, Arabic wants its own form.",
      activities: [
        {
          kind: "info",
          title: "The plural pronouns",
          body:
            "Three-or-more:\n" +
            "  نَحْنُ (naḥnu) — we (any gender mix — inclusive)\n" +
            "  أَنْتُم (antum) — you (plural, masculine or mixed group)\n" +
            "  أَنْتُنَّ (antunna) — you (plural, all-female group)\n" +
            "  هُم (hum) — they (masculine or mixed)\n" +
            "  هُنَّ (hunna) — they (all-female)\n\n" +
            "DUAL (exactly two):\n" +
            "  أَنْتُما (antumā) — you two (any gender)\n" +
            "  هُما (humā) — they two (any gender)\n" +
            "  نَحنُ does double duty for 'we two' (no separate dual form for 'we').\n\n" +
            "So the full pronoun inventory has TWELVE distinct forms:\n\n" +
            "                  SINGULAR       DUAL         PLURAL\n" +
            "  1st person:     أَنا anā       نَحنُ (shared)  نَحنُ naḥnu\n" +
            "  2nd m:          أَنْتَ anta    أَنْتُما antumā أَنْتُم antum\n" +
            "  2nd f:          أَنْتِ anti    أَنْتُما antumā أَنْتُنَّ antunna\n" +
            "  3rd m:          هُوَ huwa     هُما humā      هُم hum\n" +
            "  3rd f:          هِيَ hiya     هُما humā      هُنَّ hunna\n\n" +
            "The all-female plural forms (antunna, hunna) are used in very formal or religious contexts. In everyday speech, the 'mixed' form often wins even for all-female groups — similar to how English 'they' absorbed 'them/they' without gender.",
        },
        {
          kind: "info",
          title: "Why the dual matters",
          body:
            "Arabic TREATS 'exactly two' as its own grammatical category, distinct from 'three or more'. This applies to:\n" +
            "  • Pronouns: humā, antumā\n" +
            "  • Nouns: 'one book' = kitāb, 'two books' = kitābān (dual suffix), 'books' (3+) = kutub\n" +
            "  • Verbs: he wrote = kataba, they two wrote = katabā, they (3+) wrote = katabū\n" +
            "  • Adjectives: tall = ṭawīl, two talls = ṭawīlān, talls = ṭiwāl\n\n" +
            "This feature is preserved from Proto-Semitic. Hebrew kept traces (einayim = 'two eyes' uses a dual). English lost it entirely around the 1200s — we just say 'two' + plural.\n\n" +
            "For a beginner: use plural forms for dual too. It's technically imprecise but comprehensible. The dual is introduced here so you RECOGNIZE it, not so you produce it perfectly on day one.",
        },
        {
          kind: "info",
          title: "Plural adjective agreement",
          body:
            "When a pronoun is plural, the adjective pluralizes too:\n\n" +
            "  نَحنُ طُلّاب (naḥnu ṭullāb) — we [are] students\n" +
            "  أَنتُم مُدَرِّسون (antum mudarrisūn) — you [are] teachers\n" +
            "  هُم أَمريكيّون (hum amrīkiyyūn) — they [are] Americans\n\n" +
            "Two regular masculine plural endings:\n" +
            "  ـُون (-ūn) — nominative (subject)\n" +
            "  ـِين (-īn) — accusative/genitive\n" +
            "e.g., mudarris → mudarrisūn / mudarrisīn.\n\n" +
            "Regular feminine plural ending:\n" +
            "  ـات (-āt) — all cases\n" +
            "e.g., mudarrisa → mudarrisāt.\n\n" +
            "BROKEN plurals (common for nouns, irregular) are covered in Level 7. For now, recognize that plurals happen — and notice that -ūn and -āt are the two most common regular patterns.",
          showcase: [
            { ar: "نَحنُ طُلّاب", translit: "naḥnu ṭullāb", en: "we are students (m)" },
            { ar: "أَنتُم مُدَرِّسون", translit: "antum mudarrisūn", en: "you are teachers (m)" },
            { ar: "هُنَّ طالِبات", translit: "hunna ṭālibāt", en: "they are students (f)" },
            { ar: "هُما أَخَوان", translit: "humā akhawān", en: "they two are brothers (DUAL)" },
          ],
        },
        {
          kind: "mcq",
          question: "'naḥnu' means:",
          choices: ["I", "we", "they", "you (plural)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Addressing a group of five women — what pronoun?",
          choices: ["antum", "antunna", "antumā", "antā"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'humā' refers to:",
          choices: [
            "Three or more masculine people",
            "Exactly two people (any gender)",
            "An all-female group",
            "A mixed singular — formal you",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic tracks THREE grammatical numbers:",
          choices: [
            "Singular, plural, superlative",
            "Singular, dual, plural",
            "Small, medium, large",
            "First person, second person, third person",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The ending -ūn (e.g., on 'mudarrisūn') marks:",
          choices: [
            "Masculine singular",
            "Feminine plural",
            "Masculine regular plural (nominative case)",
            "Dual",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which of these was LOST by English but preserved in Arabic?",
          choices: [
            "Definite article",
            "Grammatical gender",
            "Dual number",
            "Past tense",
          ],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match pronoun to meaning",
          pairs: [
            { ar: "نَحنُ", en: "we" },
            { ar: "أَنْتُم", en: "you (pl, m/mixed)" },
            { ar: "أَنْتُنَّ", en: "you (pl, f)" },
            { ar: "هُم", en: "they (m/mixed)" },
            { ar: "هُنَّ", en: "they (f)" },
            { ar: "هُما", en: "they two" },
            { ar: "أَنْتُما", en: "you two" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "____ أَمريكيّون. (We are Americans.)",
          blank: "naḥnu",
          en: "naḥnu",
          choices: ["antum", "naḥnu", "hum", "anā"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'they are teachers' (m, plural) — transliteration.",
          expected: "hum mudarrisun",
          altAccepted: ["hum mudarrisūn", "hum mudarriseen", "hum mudarrisin"],
        },
      ],
    },

    {
      id: "L5.4",
      levelId: "L5",
      order: 4,
      title: "Hādhā, Hādhihi — Demonstratives",
      subtitle: "This, that, these, those",
      theme: "pronouns",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L5.3"],
      summary: "Pointing to things — which also requires gender and number agreement.",
      wrapUp: "Demonstratives obey the same gender/number system as everything else. If you can do pronouns, demonstratives follow.",
      activities: [
        {
          kind: "info",
          title: "Near demonstratives — 'this'",
          body:
            "  هذا (hādhā) — this (masculine)\n" +
            "  هذه (hādhihi) — this (feminine)\n" +
            "  هذان (hādhān) — these two (m, DUAL)\n" +
            "  هاتان (hātān) — these two (f, DUAL)\n" +
            "  هؤُلاء (hāʾulāʾ) — these (plural, any gender, HUMAN)\n\n" +
            "For NON-HUMAN plurals (books, cars, buildings), Arabic uses the FEMININE SINGULAR demonstrative: هذه. Yes, really. 'These books' = هذه الكُتُب (hādhihi l-kutub). This non-human-plural-agrees-as-feminine-singular rule is one of the most idiosyncratic quirks of Arabic grammar — don't fight it, just absorb it.\n\n" +
            "Usage:\n" +
            "  هذا كِتاب (hādhā kitāb) — this [is] a book\n" +
            "  هذه بِنت (hādhihi bint) — this [is] a girl\n" +
            "  هذا الكِتاب كَبير (hādhā l-kitāb kabīr) — this book [is] big\n" +
            "  هذه البَيوت كَبيرة (hādhihi l-buyūt kabīra) — these houses [are] big (fem-sing agreement!)",
        },
        {
          kind: "info",
          title: "Far demonstratives — 'that'",
          body:
            "  ذلك (dhālika) — that (m)\n" +
            "  تلك (tilka) — that (f)\n" +
            "  ذانِك (dhānika) — those two (m)\n" +
            "  تانِك (tānika) — those two (f)\n" +
            "  أُولئِك (ulāʾika) — those (pl, human)\n\n" +
            "Usage:\n" +
            "  ذلك البَيت (dhālika l-bayt) — that house\n" +
            "  تلك السَّيّارة (tilka s-sayyāra) — that car\n\n" +
            "The near/far distinction parallels English 'this/that'. Arabic has no third level ('yon'), though some dialects have informal equivalents.\n\n" +
            "Demonstrative + definite noun structure:\n" +
            "  [demonstrative] + [noun with الـ]\n" +
            "  هذا + الكِتاب → هذا الكِتاب (this book — literally 'this the-book')\n" +
            "  تلك + المَدينة → تلك المَدينة (that city)\n\n" +
            "Without the article, you get a predicative sentence:\n" +
            "  هذا كِتاب (hādhā kitāb) — this IS a book\n" +
            "  هذا الكِتاب (hādhā l-kitāb) — this book (a noun phrase, not a sentence)",
          showcase: [
            { ar: "هذا كِتاب", translit: "hādhā kitāb", en: "this is a book" },
            { ar: "هذا الكِتاب", translit: "hādhā l-kitāb", en: "this book (noun phrase)" },
            { ar: "هذه بِنت", translit: "hādhihi bint", en: "this is a girl" },
            { ar: "ذلك بَيت كَبير", translit: "dhālika bayt kabīr", en: "that is a big house" },
            { ar: "تلك المَدينة جَميلة", translit: "tilka l-madīna jamīla", en: "that city is beautiful" },
          ],
        },
        {
          kind: "mcq",
          question: "'hādhā kitāb' means:",
          choices: [
            "This book",
            "This IS a book",
            "That book",
            "Here is the book",
          ],
          correctIndex: 1,
          explain: "Without 'al-' on kitāb, you have a predicate sentence. With 'al-' (hādhā l-kitāb) it would be just a noun phrase.",
        },
        {
          kind: "mcq",
          question: "'tilka' is used for:",
          choices: [
            "this (masculine)",
            "this (feminine)",
            "that (masculine)",
            "that (feminine)",
          ],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "'these books' (books is non-human plural). Which demonstrative?",
          choices: [
            "hādhā — this (m)",
            "hādhihi — this (f)",
            "hāʾulāʾ — these (human)",
            "hādhān — these two",
          ],
          correctIndex: 1,
          explain: "Non-human plurals take feminine-singular agreement. 'These books' = hādhihi l-kutub.",
        },
        {
          kind: "mcq",
          question: "'hādhā l-bayt' (هذا البَيت) means:",
          choices: [
            "This is a house",
            "This house (noun phrase)",
            "That house",
            "A house is here",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The difference between 'hādhā bayt' and 'hādhā l-bayt' is:",
          choices: [
            "The first is a sentence ('this is a house'); the second is a noun phrase ('this house')",
            "The first is correct; the second is a typo",
            "The first is formal; the second is informal",
            "No difference",
          ],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match demonstrative to description",
          pairs: [
            { ar: "هذا", en: "this (m)" },
            { ar: "هذه", en: "this (f)" },
            { ar: "ذلك", en: "that (m)" },
            { ar: "تلك", en: "that (f)" },
            { ar: "هؤُلاء", en: "these (human)" },
            { ar: "أُولئِك", en: "those (human)" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "____ kitāb. (This is a book — masculine.)",
          blank: "hādhā",
          en: "hādhā",
          choices: ["hādhā", "hādhihi", "dhālika", "tilka"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "____ mudarrisa jamīla. (This is a beautiful teacher — feminine.)",
          blank: "hādhihi",
          en: "hādhihi",
          choices: ["hādhā", "hādhihi", "dhālika", "tilka"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'this is a girl' (transliteration).",
          expected: "hadhihi bint",
          altAccepted: ["hādhihi bint"],
        },
      ],
    },

    {
      id: "L5.5",
      levelId: "L5",
      order: 5,
      title: "Level 5 Review + Expanded Sentences",
      subtitle: "Build real nominal sentences",
      theme: "review",
      estimatedMinutes: 35,
      xp: 110,
      prerequisites: ["L5.4"],
      summary: "Pronouns + demonstratives + gender agreement + zero copula.",
      wrapUp: "Level 5 complete. You can now form probably 300+ different valid Arabic sentences. Level 6 hands you numbers, days, and time — so you can talk about WHEN, not just WHO / WHAT.",
      activities: [
        {
          kind: "info",
          title: "A working sentence template",
          body:
            "The zero-copula sentence has three common shapes. Memorize these; everything builds from them:\n\n" +
            "  1. Pronoun + indef noun:\n" +
            "     anā ṭālib. (I am a student.)\n" +
            "     hiya mudarrisa. (She is a teacher.)\n\n" +
            "  2. Pronoun + adjective:\n" +
            "     anta dhakī. (You are smart, m.)\n" +
            "     naḥnu saʿīdūn. (We are happy.)\n\n" +
            "  3. Definite noun + indef predicate:\n" +
            "     al-bayt kabīr. (The house is big.)\n" +
            "     al-mudarrisa jamīla. (The teacher is beautiful.)\n\n" +
            "  4. Demonstrative + predicate:\n" +
            "     hādhā kitāb. (This is a book.)\n" +
            "     hādhihi l-madīna jamīla. (This city is beautiful.)\n\n" +
            "Key agreement: the predicate AGREES with the subject in gender and number.",
        },
        {
          kind: "mcq",
          question: "'hiya ṭabība' means:",
          choices: [
            "He is a doctor",
            "She is a doctor",
            "I am a doctor",
            "You are a doctor",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'naḥnu min Lubnān' means:",
          choices: [
            "I am from Lebanon",
            "They are from Lebanon",
            "We are from Lebanon",
            "You are from Lebanon",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which sentence is correctly agreed?",
          choices: [
            "hiya mudarris — she is a teacher (m)",
            "hiya mudarrisa — she is a teacher (f)",
            "huwa mudarrisa — he is a teacher (f)",
            "hum mudarrisa — they are a teacher (f)",
          ],
          correctIndex: 1,
          explain: "Gender agrees: hiya (f) → mudarrisa (f). The others mix genders or numbers.",
        },
        {
          kind: "mcq",
          question: "Arabic treats 'these books' (non-human plural) with:",
          choices: [
            "Plural demonstrative",
            "Feminine-singular demonstrative (hādhihi)",
            "Masculine-singular demonstrative (hādhā)",
            "Dual demonstrative",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic lacks a present-tense 'to be' verb. 'The house is big' is:",
          choices: [
            "al-bayt yakūnu kabīr",
            "al-bayt huwa kabīr",
            "al-bayt kabīr",
            "al-bayt bi-kabīr",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "____ ṭabība. (She is a doctor.)",
          blank: "hiya",
          en: "she",
          choices: ["huwa", "hiya", "anti", "anā"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "____ al-bayt kabīr. (This house is big.)",
          blank: "hādhā",
          en: "this (m)",
          choices: ["hādhā", "hādhihi", "hādhān", "hādhihi"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "hiya mudarrisa ____. (She is a BEAUTIFUL teacher.)",
          blank: "jamīla",
          en: "beautiful (f)",
          choices: ["jamīl", "jamīla", "jamīlūn", "jamīlān"],
          correctIndex: 1,
          explain: "mudarrisa is feminine, so the following adjective must be feminine: jamīla.",
        },
        {
          kind: "match",
          prompt: "Match Arabic pronoun/demonstrative to English",
          pairs: [
            { ar: "أَنا", en: "I" },
            { ar: "نَحنُ", en: "we" },
            { ar: "هُوَ", en: "he" },
            { ar: "هِيَ", en: "she" },
            { ar: "هُم", en: "they (m)" },
            { ar: "هُنَّ", en: "they (f)" },
            { ar: "هذا", en: "this (m)" },
            { ar: "هذه", en: "this (f)" },
            { ar: "ذلك", en: "that (m)" },
            { ar: "تلك", en: "that (f)" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'we are Egyptian' (male/mixed plural), transliteration.",
          expected: "nahnu misriyyun",
          altAccepted: [
            "naḥnu miṣriyyūn",
            "nahnu misriyeen",
            "nahnu misriyin",
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'this is my friend' — use 'ṣadīqī' for 'my friend (m)'.",
          expected: "hadha sadiqi",
          altAccepted: ["hādhā ṣadīqī"],
        },
      ],
    },
  ],
};
