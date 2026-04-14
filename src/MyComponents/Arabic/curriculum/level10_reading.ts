// ============================================================================
// LEVEL 10 — Reading, classical structures, culture, and capstone
//
// Depth focus: the definite article and sun/moon refresher, idāfa mastery,
// past tense introduction, reading connected passages, cultural literacy,
// and a thorough capstone exam covering the whole course.
// ============================================================================

import type { Level } from "../types";

export const level10: Level = {
  id: "L10",
  order: 10,
  title: "Reading, Culture & Capstone",
  subtitle: "Connect everything and read real Arabic",
  theme: "reading",
  goal: "Read short paragraphs, recognize past-tense verbs, handle classical structures, understand cultural context, and complete a capstone review.",
  lessons: [
    {
      id: "L10.1",
      levelId: "L10",
      order: 1,
      title: "Past Tense — kataba, Not yaktubu",
      subtitle: "Arabic's simpler tense",
      theme: "verbs",
      estimatedMinutes: 40,
      xp: 100,
      prerequisites: ["L9.4"],
      summary: "The PAST tense is built with SUFFIXES only — simpler than the present.",
      wrapUp: "You now have both past and present. With these two tenses you can read most practical Arabic.",
      activities: [
        {
          kind: "info",
          title: "Past tense structure — suffixes only",
          body:
            "Arabic past tense (الماضي, al-māḍī) is formed by taking the ROOT with its past-tense stem vowels, and adding a SUFFIX for the subject.\n\n" +
            "For the verb كَتَبَ (kataba, 'he wrote'), the past-tense stem is katab- (a-a vowels on the first two consonants).\n\n" +
            "Full past-tense conjugation of كَتَبَ:\n\n" +
            "  أَنا      كَتَبتُ      (katabtu)    I wrote\n" +
            "  أَنْتَ      كَتَبتَ      (katabta)    you wrote (m)\n" +
            "  أَنْتِ      كَتَبتِ      (katabti)    you wrote (f)\n" +
            "  هُوَ      كَتَبَ      (kataba)     he wrote\n" +
            "  هِيَ      كَتَبَت     (katabat)    she wrote\n" +
            "  نَحْنُ     كَتَبنا     (katabnā)    we wrote\n" +
            "  أَنْتُم     كَتَبتُم    (katabtum)   you wrote (pl m)\n" +
            "  أَنْتُنَّ     كَتَبتُنَّ    (katabtunna) you wrote (pl f)\n" +
            "  هُم       كَتَبوا     (katabū)     they wrote (m)\n" +
            "  هُنَّ       كَتَبنَ     (katabna)    they wrote (f)\n" +
            "  هُما      كَتَبا      (katabā)     they two wrote (m)\n" +
            "  أَنْتُما     كَتَبتُما    (katabtumā)  you two wrote\n\n" +
            "Notice:\n" +
            "  • The HE-FORM (kataba) is the DICTIONARY CITATION form in classical dictionaries. It's the 'bare' past tense.\n" +
            "  • No prefixes in the past tense — just suffixes.\n" +
            "  • The suffixes echo Hebrew's patterns — same Semitic origin.",
        },
        {
          kind: "info",
          title: "Past tense for a handful of common verbs",
          body:
            "All built on the same suffix system — just swap the stem:\n\n" +
            "  دَرَسَ / درَستُ (darasa / darastu) — he studied / I studied\n" +
            "  ذَهَبَ / ذَهَبتُ (dhahaba / dhahabtu) — he went / I went\n" +
            "  شَرِبَ / شَرِبتُ (shariba / sharibtu) — he drank / I drank\n" +
            "  أَكَلَ / أَكَلتُ (akala / akaltu) — he ate / I ate\n" +
            "  قَرَأَ / قَرَأتُ (qaraʾa / qaraʾtu) — he read / I read\n" +
            "  سَمِعَ / سَمِعتُ (samiʿa / samiʿtu) — he heard / I heard\n" +
            "  عَرَفَ / عَرَفتُ (ʿarafa / ʿaraftu) — he knew / I knew\n" +
            "  كانَ / كُنتُ (kāna / kuntu) — he was / I was (irregular, covered below)\n\n" +
            "Stems with 'i' in the middle (shariba, samiʿa) behave slightly differently in the present tense (yashrabu, yasmaʿu — the 'i' becomes 'a' in the present). Don't worry about mastering this irregularity — just recognize it when you see it.",
          showcase: [
            { ar: "كَتَبتُ رِسالة", translit: "katabtu risāla", en: "I wrote a letter" },
            { ar: "ذَهَبت إلى السوق", translit: "dhahabtu ilā s-sūq", en: "I went to the market" },
            { ar: "هُوَ قَرَأَ كِتاباً", translit: "huwa qaraʾa kitāban", en: "he read a book" },
            { ar: "هُم أَكَلوا", translit: "hum akalū", en: "they ate" },
          ],
        },
        {
          kind: "info",
          title: "كانَ (kāna) — the verb 'to be' in the past",
          body:
            "Arabic has no PRESENT-tense 'to be' (the zero-copula rule from Level 5). But it has a PAST-tense 'to be':\n\n" +
            "  كانَ (kāna) — he was\n" +
            "  كانَت (kānat) — she was\n" +
            "  كُنتُ (kuntu) — I was\n" +
            "  كُنتَ (kunta) — you were (m)\n" +
            "  كُنتِ (kunti) — you were (f)\n" +
            "  كانوا (kānū) — they were (m)\n" +
            "  كُنّا (kunnā) — we were\n\n" +
            "This is a HOLLOW VERB (middle root letter is و / wāw — it drops or shifts depending on conjugation).\n\n" +
            "Usage:\n" +
            "  كُنتُ طالِباً. (kuntu ṭāliban) — I was a student.\n" +
            "  كانَ الطَّقس بارِداً. (kāna ṭ-ṭaqs bāridan) — the weather was cold.\n" +
            "  كانَت في البَيت. (kānat fī l-bayt) — she was at home.\n\n" +
            "Like لَيسَ (laysa) from Level 8, kāna puts the predicate in the ACCUSATIVE case (-an ending). These 'sister of kāna' verbs all do this — kāna, laysa, ṣāra (became), baqiya (remained), etc. Group them mentally.",
        },
        {
          kind: "mcq",
          question: "'I wrote a letter' in Arabic:",
          choices: [
            "aktubu risāla",
            "katabtu risāla",
            "kataba risāla",
            "naktubu risāla",
          ],
          correctIndex: 1,
          explain: "Past-tense first-person: katabtu. With object: katabtu risāla.",
        },
        {
          kind: "mcq",
          question: "'hum katabū' means:",
          choices: [
            "They write",
            "They wrote (masculine plural)",
            "They are writing (feminine plural)",
            "We wrote",
          ],
          correctIndex: 1,
          explain: "The -ū suffix = 'they wrote (m pl)'.",
        },
        {
          kind: "mcq",
          question: "'kāna' in the sentence 'kāna ṭ-ṭaqs bāridan' is:",
          choices: [
            "An adjective",
            "A past-tense form of 'to be' — 'was'",
            "A noun meaning 'weather'",
            "The word for 'cold'",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Why does 'bāridan' end in -an in 'kāna ṭ-ṭaqs bāridan'?",
          choices: [
            "It's indefinite accusative — kāna puts its predicate in accusative case",
            "It's plural",
            "It's feminine",
            "It's a grammatical error",
          ],
          correctIndex: 0,
          explain: "kāna and its 'sisters' (laysa, ṣāra, aṣbaḥa, etc.) require accusative predicate.",
        },
        {
          kind: "mcq",
          question: "The past tense in Arabic is formed with:",
          choices: [
            "Prefixes only",
            "Suffixes only",
            "Both prefixes and suffixes",
            "A prefix plus the past particle",
          ],
          correctIndex: 1,
          explain: "Past = suffixes. Present = prefixes (and some suffixes for duals/plurals).",
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ في القاهِرة. (I was in Cairo.)",
          blank: "كُنتُ (kuntu)",
          en: "I was",
          choices: ["كانَ", "كانَت", "كُنتُ", "كانوا"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "هِيَ ____ كِتاباً. (She read a book.)",
          blank: "قَرَأَت (qaraʾat)",
          en: "she read",
          choices: ["قَرَأَ", "قَرَأَت", "قَرَأوا", "قَرَأتُ"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match past-tense form to translation (root: d-r-s)",
          pairs: [
            { ar: "دَرَستُ", en: "I studied" },
            { ar: "دَرَسَ", en: "he studied" },
            { ar: "دَرَسَت", en: "she studied" },
            { ar: "دَرَسنا", en: "we studied" },
            { ar: "دَرَسوا", en: "they studied (m)" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'I was a student' (m) — kuntu ṭāliban (transliteration).",
          expected: "kuntu taliban",
          altAccepted: ["kuntu ṭāliban", "kuntu taaliban"],
        },
        {
          kind: "typing",
          prompt: "Type 'she went' (dhahabat) — transliteration.",
          expected: "dhahabat",
        },
      ],
    },

    {
      id: "L10.2",
      levelId: "L10",
      order: 2,
      title: "Prepositions & Conjunctions",
      subtitle: "The glue of Arabic sentences",
      theme: "grammar",
      estimatedMinutes: 35,
      xp: 90,
      prerequisites: ["L10.1"],
      summary: "Common prepositions + conjunctions — without these, you can't connect anything.",
      wrapUp: "With prepositions and conjunctions you can now build compound sentences. Sentence length doubles overnight.",
      activities: [
        {
          kind: "info",
          title: "Core prepositions",
          body:
            "  في (fī) — in\n" +
            "  عَلى (ʿalā) — on / upon\n" +
            "  إلى (ilā) — to / toward\n" +
            "  مِن (min) — from / of\n" +
            "  مَعَ (maʿa) — with (accompaniment)\n" +
            "  بِ (bi-) — with / by / in (attached prefix)\n" +
            "  لِ (li-) — for / to (attached prefix)\n" +
            "  عَن (ʿan) — about / from\n" +
            "  عِندَ (ʿinda) — at / with / have (for possession)\n" +
            "  تَحتَ (taḥta) — under\n" +
            "  فَوقَ (fawqa) — above\n" +
            "  أَمامَ (amāma) — in front of\n" +
            "  خَلفَ (khalfa) — behind\n" +
            "  بَعدَ (baʿda) — after\n" +
            "  قَبلَ (qabla) — before\n" +
            "  حَتّى (ḥattā) — until\n" +
            "  بِدون (bidūn) — without\n\n" +
            "Prepositions in Arabic typically put the NOUN FOLLOWING THEM in the GENITIVE CASE (vowel -i or -in ending). Most of the time this vowel is unwritten and unspoken, but in fully vocalized text you'll see it:\n\n" +
            "  فِي البَيتِ (fī l-bayti) — in the house\n" +
            "  مِن مِصرَ (min Miṣra) — from Egypt\n" +
            "  بِالسَّيّارةِ (bis-sayyārati) — by car\n\n" +
            "Attached prepositions لـ / بـ are written directly as prefixes on the following word. لِلمُدَرِّس = 'for the teacher'. بِالسَّيّارة = 'by the car'.",
          showcase: [
            { ar: "في البَيت", translit: "fī l-bayt", en: "in the house" },
            { ar: "على الطاوِلة", translit: "ʿalā ṭ-ṭāwila", en: "on the table" },
            { ar: "مَعَ أَبي", translit: "maʿa abī", en: "with my father" },
            { ar: "بَعدَ السّاعة", translit: "baʿda s-sāʿa", en: "after an hour" },
            { ar: "بِالسَّيّارة", translit: "bis-sayyāra", en: "by car" },
          ],
        },
        {
          kind: "info",
          title: "Conjunctions",
          body:
            "  وَ (wa-) — and (attached, written as prefix)\n" +
            "  ثُمَّ (thumma) — then / thereafter\n" +
            "  أَو (aw) — or\n" +
            "  لَكِنَّ (lākinna) — but\n" +
            "  لَكِن (lākin) — but (less formal)\n" +
            "  لِأَنَّ (liʾanna) — because\n" +
            "  إِذا (idhā) — if\n" +
            "  لَو (law) — if (hypothetical)\n" +
            "  حَتّى (ḥattā) — until / even / so that\n\n" +
            "وَ is attached directly to the next word:\n" +
            "  أَنا وَهُوَ — me and him\n" +
            "  الرَّجُلُ وَالمَرأَة — the man and the woman\n\n" +
            "Usage examples:\n" +
            "  أَنا طَالِب، وَأَخي مُدَرِّس. — I am a student, and my brother is a teacher.\n" +
            "  أَشرَبُ القَهوة أَو الشاي. — I drink coffee or tea.\n" +
            "  دَرَستُ كَثيراً، لَكِنّي لَم أَنجَح. — I studied a lot, but I didn't pass. (Note لَم + jussive — 'didn't'.)\n" +
            "  لا أَذهَبُ لِأَنَّني مَريض. — I'm not going because I'm sick.\n\n" +
            "لَكِنَّ / لِأَنَّ take an attached pronoun and put their subject in accusative case:\n" +
            "  لَكِنّني (lākinnanī) — but I…\n" +
            "  لَكِنَّهُ (lākinnahu) — but he…\n" +
            "  لِأَنَّها (liʾannahā) — because she…",
        },
        {
          kind: "mcq",
          question: "'fī al-bayt' means:",
          choices: ["at the house", "in the house", "by the house", "with the house"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'mʿ abī' — 'maʿa abī' — means:",
          choices: [
            "without my father",
            "by my father",
            "with my father",
            "from my father",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "In the sentence 'dhahabtu ilā s-sūq' ('I went to the market'), the preposition is:",
          choices: ["fī", "min", "ilā", "ʿalā"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'I studied, but I didn't pass' — the word translated 'but' is:",
          choices: ["wa", "aw", "lākin / lākinna", "thumma"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'lākinnahu' means:",
          choices: [
            "because of him",
            "but he",
            "with him",
            "from him",
          ],
          correctIndex: 1,
          explain: "lākinna + attached pronoun -hu = 'but he'. Note the shadda on ن (lākinn-) that signals a doubled sound.",
        },
        {
          kind: "fillblank",
          prompt: "أَذهَبُ ____ المَدرَسة كُلّ يَوم. (I go TO school every day.)",
          blank: "إلى (ilā)",
          en: "to",
          choices: ["في", "مَعَ", "إلى", "عَن"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "أَنا لا أَفهَم ____ مَريض. (I don't understand BECAUSE I'm sick.)",
          blank: "لِأَنَّني (liʾannanī)",
          en: "because I",
          choices: ["لَكِن", "لِأَنَّني", "إِذا", "لَو"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match preposition/conjunction to meaning",
          pairs: [
            { ar: "في", en: "in" },
            { ar: "إلى", en: "to / toward" },
            { ar: "مِن", en: "from" },
            { ar: "مَعَ", en: "with" },
            { ar: "بَعدَ", en: "after" },
            { ar: "قَبلَ", en: "before" },
            { ar: "وَ", en: "and" },
            { ar: "لَكِن", en: "but" },
            { ar: "أَو", en: "or" },
            { ar: "لِأَنَّ", en: "because" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'in front of the house' — amāma l-bayt (transliteration).",
          expected: "amama al-bayt",
          altAccepted: ["amāma l-bayt", "amama albayt", "amam al-bayt", "amam albayt"],
        },
      ],
    },

    {
      id: "L10.3",
      levelId: "L10",
      order: 3,
      title: "Your First Real Paragraph",
      subtitle: "Connected prose — read it like a native might",
      theme: "reading",
      estimatedMinutes: 35,
      xp: 120,
      prerequisites: ["L10.2"],
      summary: "A 4-sentence paragraph about Hanif. Read it, understand it, answer questions.",
      wrapUp: "You just read a paragraph of Arabic prose. Everything in it draws from what you've learned across 9+ levels.",
      activities: [
        {
          kind: "info",
          title: "A little preparation",
          body:
            "The passage below uses:\n" +
            "  • Nominal sentences (zero-copula) — Level 5\n" +
            "  • A past-tense verb (كُنتُ kuntu, 'I was') — Level 10.1\n" +
            "  • A present-tense verb (أَدرُس adrus, 'I study') — Level 8.2\n" +
            "  • Possessive suffixes — Level 7.2\n" +
            "  • Prepositions (فِي, مَعَ) — Level 10.2\n" +
            "  • A conjunction (لَكِن) — Level 10.2\n" +
            "  • An idāfa — Level 7.4\n\n" +
            "If anything looks unfamiliar, you have the tools to decode it. Read the Arabic first, then check your understanding against the translation.",
        },
        {
          kind: "reading",
          prompt: "Read the passage.",
          passageAr:
            "اِسمي حَنيف، وَأَنا مِنْ أَمريكا. كُنتُ طالِباً في جامِعة بوسطُن، وَالآن أَعمَل في مَدينَتي. أَدرُسُ اللُّغة العَرَبِيَّة في البَيت كُلّ يَوم لِأَنَّني أُحِبّ ثَقافَتَها. عِندي أَخ صَغير اسمُه عُمَر، وَأُختان، وَنَحنُ عائِلة صَغيرة لَكِن سَعيدة.",
          translation:
            "My name is Hanif, and I am from America. I was a student at Boston University, and now I work in my city. I study the Arabic language at home every day because I love its culture. I have a little brother named Omar, and two sisters, and we are a small but happy family.",
          question: "What did Hanif do in the past?",
          choices: [
            "He lived in Cairo.",
            "He was a student at Boston University.",
            "He taught at a school.",
            "He traveled the world.",
          ],
          correctIndex: 1,
        },
        {
          kind: "reading",
          prompt: "Same passage. Second question.",
          passageAr:
            "اِسمي حَنيف، وَأَنا مِنْ أَمريكا. كُنتُ طالِباً في جامِعة بوسطُن، وَالآن أَعمَل في مَدينَتي. أَدرُسُ اللُّغة العَرَبِيَّة في البَيت كُلّ يَوم لِأَنَّني أُحِبّ ثَقافَتَها. عِندي أَخ صَغير اسمُه عُمَر، وَأُختان، وَنَحنُ عائِلة صَغيرة لَكِن سَعيدة.",
          translation:
            "My name is Hanif, and I am from America. I was a student at Boston University, and now I work in my city. I study the Arabic language at home every day because I love its culture. I have a little brother named Omar, and two sisters, and we are a small but happy family.",
          question: "Why does Hanif study Arabic?",
          choices: [
            "For work",
            "Because his family requires it",
            "Because he loves its culture",
            "Because he has to pass an exam",
          ],
          correctIndex: 2,
          explain: "'liʾannanī uḥibb thaqāfatahā' — 'because I love its (language's) culture'. thaqāfa = culture; -hā refers back to al-lugha al-ʿarabiyya.",
        },
        {
          kind: "reading",
          prompt: "Third question.",
          passageAr:
            "اِسمي حَنيف، وَأَنا مِنْ أَمريكا. كُنتُ طالِباً في جامِعة بوسطُن، وَالآن أَعمَل في مَدينَتي. أَدرُسُ اللُّغة العَرَبِيَّة في البَيت كُلّ يَوم لِأَنَّني أُحِبّ ثَقافَتَها. عِندي أَخ صَغير اسمُه عُمَر، وَأُختان، وَنَحنُ عائِلة صَغيرة لَكِن سَعيدة.",
          translation:
            "My name is Hanif, and I am from America. I was a student at Boston University, and now I work in my city. I study the Arabic language at home every day because I love its culture. I have a little brother named Omar, and two sisters, and we are a small but happy family.",
          question: "How many siblings does Hanif have?",
          choices: ["1 — just Omar", "2 — Omar and one sister", "3 — Omar and two sisters", "4"],
          correctIndex: 2,
        },
        {
          kind: "info",
          title: "Passage breakdown — the interesting bits",
          body:
            "1. 'كُنتُ طالِباً' — 'I was a student'.\n" +
            "   • kuntu = past 'to be' (1st person).\n" +
            "   • ṭāliban ends in -an (tanwīn, accusative) because kāna's predicate must be accusative.\n\n" +
            "2. 'في جامِعة بوسطُن' — 'at Boston University'.\n" +
            "   • jāmiʿa (university) + Būsṭun (Boston) = idāfa. The ة of jāmiʿa becomes ت.\n\n" +
            "3. 'في مَدينَتي' — 'in my city'.\n" +
            "   • madīna + ī (my) → madīnatī (ة → ت, attached possessive -ī).\n\n" +
            "4. 'لِأَنَّني أُحِبّ ثَقافَتَها' — 'because I love its culture'.\n" +
            "   • liʾanna + -nī = 'because I'.\n" +
            "   • thaqāfa + -hā = 'its (f.) culture'. The -hā refers back to al-lugha (the language).\n\n" +
            "5. 'اسمُه عُمَر' — 'his name is Omar'.\n" +
            "   • ism + -hu (his) = ismuhu. The 'u' drops for syllable fit → ismuh in casual pronunciation.\n\n" +
            "6. 'عائِلة صَغيرة لَكِن سَعيدة' — 'a small but happy family'.\n" +
            "   • Adjectives agree: ʿāʾila is feminine → both adjectives take feminine ending (ṣaghīra, saʿīda).\n\n" +
            "That paragraph uses most of the grammar from the course. You parsed it using your own toolkit.",
        },
        {
          kind: "mcq",
          question: "In 'kuntu ṭāliban', why is ṭāliban in the accusative (-an ending)?",
          choices: [
            "It's plural",
            "Because kuntu (kāna) requires its predicate to be accusative",
            "It's feminine",
            "It's a typo",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'thaqāfatahā' ends in -hā referring to what?",
          choices: [
            "Hanif",
            "Hanif's sister",
            "Al-lugha al-ʿarabiyya (the Arabic language) — feminine",
            "The university",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "The word 'madīnatī' is built from:",
          choices: [
            "madīn + atī (random suffix)",
            "madīna (city, f) + -ī (my); ة becomes ت when suffix attaches",
            "madīn (city, m) + atī (my)",
            "A loanword with an Arabic suffix",
          ],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L10.4",
      levelId: "L10",
      order: 4,
      title: "Cultural Literacy & Common Expressions",
      subtitle: "Phrases with weight in everyday speech",
      theme: "culture",
      estimatedMinutes: 35,
      xp: 100,
      prerequisites: ["L10.3"],
      summary: "The religious / cultural expressions built into everyday Arabic — you'll hear all of these constantly.",
      wrapUp: "These phrases are not optional add-ons. They're how Arabic speech FLOWS. Learn them not as vocabulary but as reflexes.",
      activities: [
        {
          kind: "info",
          title: "Religious expressions in everyday speech",
          body:
            "Arabic is shot through with phrases invoking God — NOT because every speaker is devout, but because the linguistic culture is saturated with them. Christians, Muslims, and secular Arabs all use them.\n\n" +
            "  إِن شاءَ الله (in shāʾ Allāh) — 'if God wills' / 'God willing'.\n" +
            "    Used for ANY future plan. 'See you tomorrow, in shāʾ Allāh.' 'We'll arrive by 8, in shāʾ Allāh.' Equivalent in force to English 'hopefully' but constant. NOT used sarcastically in its native cultural setting — that's an Internet-era American reading.\n\n" +
            "  ما شاءَ الله (mā shāʾ Allāh) — 'what God has willed'.\n" +
            "    Said when admiring someone or something. Traditionally believed to ward off the evil eye — you praise the thing and THEN attribute the wonder to God's will, so no envy is implied. Use it when someone's child, success, or good fortune is worth noting.\n\n" +
            "  الحَمدُ لله (al-ḥamdu lillāh) — 'praise be to God'.\n" +
            "    Default response to 'how are you?' — even from non-religious speakers. Also said after good news, a sneeze, a meal.\n\n" +
            "  بِسمِ الله (bismi-llāh) — 'in the name of God'.\n" +
            "    Said before starting an action — eating, driving, entering a home. Abbreviation of the Qurʾān's opening 'bismi-llāhi r-raḥmāni r-raḥīm' ('in the name of God, the merciful, the compassionate').\n\n" +
            "  اللّه يَعطيك العافية (allāh yaʿṭīk al-ʿāfiya) — 'may God give you health'.\n" +
            "    Said to someone doing hard work — service workers, taxi drivers, anyone putting in effort. Not a hollow thanks; it's the warm version.\n\n" +
            "  بارَكَ اللَّهُ فيك (bāraka-llāhu fīka) — 'God bless you'.\n" +
            "    A stronger thanks, typically after a favor.\n\n" +
            "  اللّه أَعلَم (allāh aʿlam) — 'God knows [best]'.\n" +
            "    Honest admission of uncertainty. The Arabic equivalent of 'I'm not sure'.\n\n" +
            "  بِإِذن الله (bi-idhni-llāh) — 'by God's permission'. Similar to in shāʾ Allāh but slightly weightier.",
          showcase: [
            { ar: "إِن شاءَ الله", translit: "in shāʾ Allāh", en: "God willing" },
            { ar: "ما شاءَ الله", translit: "mā shāʾ Allāh", en: "how wonderful" },
            { ar: "الحَمدُ لله", translit: "al-ḥamdu lillāh", en: "praise God / I'm fine" },
            { ar: "بِسمِ الله", translit: "bismi-llāh", en: "in the name of God" },
            { ar: "اللّه يَعطيك العافية", translit: "allāh yaʿṭīk al-ʿāfiya", en: "may God grant you health" },
          ],
        },
        {
          kind: "info",
          title: "MSA vs dialects — what you're NOT learning here",
          body:
            "Modern Standard Arabic (فُصحى, fuṣḥā) — which this course teaches — is:\n" +
            "  • The official language of 22 countries\n" +
            "  • Used in all formal writing, news media, religious sermons, political speeches, academic publications\n" +
            "  • Understood (receptively) by educated speakers everywhere\n" +
            "  • What foreigners learn first — it's your universal passport\n\n" +
            "Arabic DIALECTS (عامِّيَّة, ʿāmmiyya) — which you're NOT learning here:\n" +
            "  • Egyptian (Maṣrī) — the most widely understood, due to Egyptian cinema and media dominance\n" +
            "  • Levantine (Shāmī) — Syria, Lebanon, Jordan, Palestine\n" +
            "  • Gulf (Khalījī) — Saudi, UAE, Kuwait, Qatar, Bahrain, Oman\n" +
            "  • Iraqi (ʿIrāqī)\n" +
            "  • Moroccan / Maghrebi (Dārija) — Morocco, Algeria, Tunisia, Libya (often mutually unintelligible with Gulf Arabic)\n\n" +
            "Differences: vocabulary (bread = khubz in MSA, but ʿaysh in Egypt, khubz in Levantine, furnī locally), pronunciation (q becomes glottal stop or g), and grammar (simplified conjugations, dropped case endings).\n\n" +
            "What MSA gets you:\n" +
            "  • Read any newspaper, book, or website\n" +
            "  • Understand news broadcasts, religious texts, literature\n" +
            "  • Speak understandably to any educated Arab speaker (though they may find it a bit formal)\n" +
            "  • Base to LAUNCH into a dialect later — far easier once MSA is solid\n\n" +
            "A learner who stops at MSA can travel anywhere and get by. A learner who ONLY learned Egyptian would struggle in Morocco. MSA is the investment.",
        },
        {
          kind: "info",
          title: "Literature, poetry, and the Qurʾān",
          body:
            "Arabic's literary tradition is one of the oldest continuously active in the world — about 1,500 years of poetry, essays, philosophy, theology, and fiction.\n\n" +
            "Key works you should know OF (not expected to read):\n\n" +
            "  • القُرآن الكَريم (al-Qurʾān al-karīm) — The Noble Qurʾān. 7th-century, roughly 80,000 words. The foundational text of Islam and the benchmark of classical Arabic. Every Muslim memorizes portions; some memorize all 114 sūras.\n\n" +
            "  • المُعَلَّقات (al-muʿallaqāt) — 'The Hanging Odes'. Seven pre-Islamic (6th century) odes considered the peak of pre-Islamic poetry, traditionally said to have been hung on the walls of the Kaʿba in Mecca.\n\n" +
            "  • أَلف لَيلة وَلَيلة (alf layla wa-layla) — 'One Thousand and One Nights'. Collected 9th–14th centuries. Source of Aladdin, Sinbad, Scheherazade.\n\n" +
            "  • Works of al-Mutanabbī (10th century), Ibn Khaldūn (14th century), Naguib Mahfouz (20th century, Nobel Prize 1988), Ghassan Kanafani, Nizar Qabbani, Mahmoud Darwish.\n\n" +
            "Modern Arabic literature is flourishing. Translations of Mahfouz, Darwish, and Adunis are widely available in English. The Arab Booker Prize (Prize for Arabic Fiction) tracks contemporary novels.\n\n" +
            "A note on the Qurʾān and Arabic: for Muslims, the Arabic Qurʾān is the LITERAL word of God. Translations are considered INTERPRETATIONS, not scripture. This is why Arabic has remained remarkably stable over 1,400 years — the Qurʾān anchors it.",
        },
        {
          kind: "info",
          title: "How to keep progressing past this course",
          body:
            "You've completed 10 levels. You have enough Arabic to read simple prose, hold basic conversations, and decode grammar from context.\n\n" +
            "To move toward fluency, three habits:\n\n" +
            "  1. READ every day. Start with children's books and graded readers (e.g., the 'We are learning Arabic' series by Abdur Rahim, or Fawzi Attieh's graded readers). Move to news sites (BBC Arabic, Al Jazeera Arabic) at around level 12–15 equivalent.\n\n" +
            "  2. LISTEN every day, even 15 minutes. News clips, short documentaries, Qurʾān recitation (excellent for hearing pristine Arabic), YouTube channels for learners (LearnArabicwith Maha, Arabic Fuṣḥā). Your ears need the MELODY — Arabic's rhythm is distinct and improves your spoken fluency.\n\n" +
            "  3. WRITE / SPEAK every day, even self-directed. Keep a tiny Arabic journal. Talk to yourself in Arabic about what you did today. Productive practice stabilizes vocabulary that passive reading leaves fragile.\n\n" +
            "Milestones:\n" +
            "  • 200 hours total — reliable basic conversation, simple reading\n" +
            "  • 500 hours — comfortable reading news, understanding most slow speech\n" +
            "  • 1000+ hours — functional work fluency\n" +
            "  • 2000+ hours — approaching native-level comprehension\n\n" +
            "You've invested maybe 20–40 hours in this course (10 levels × 2–4 hours each). You're 2–4% of the way to functional fluency. Don't let that discourage you — EVERY learner starts here. The work is linear; progress becomes visible around hour 100.",
        },
        {
          kind: "mcq",
          question: "The formal Arabic you've been learning is called:",
          choices: ["ʿāmmiyya (dialect)", "fuṣḥā (Modern Standard Arabic)", "Shāmī (Levantine)", "Maṣrī (Egyptian)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'in shāʾ Allāh' is used:",
          choices: [
            "To admire someone",
            "Only by religious Muslims",
            "Broadly, by religious and secular speakers, to frame any future plan",
            "To apologize",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'mā shāʾ Allāh' is traditionally said when:",
          choices: [
            "Something bad happens",
            "Admiring something/someone, believed to ward off the evil eye",
            "Thanking someone",
            "Greeting someone",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The most widely understood Arabic dialect, due to media dominance, is:",
          choices: ["Moroccan", "Iraqi", "Egyptian", "Gulf"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Why has Arabic remained remarkably stable for 1,400 years?",
          choices: [
            "Geographic isolation",
            "The Qurʾān acts as a linguistic anchor — for Muslims, it IS the Arabic language in classical form",
            "Government enforcement",
            "No contact with other languages",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The expression 'allāh yaʿṭīk al-ʿāfiya' is said to:",
          choices: [
            "Someone who is sick",
            "Someone doing hard work — it's a warm 'thanks for your effort'",
            "Someone who just married",
            "A child",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match expression to function",
          pairs: [
            { ar: "إِن شاءَ الله", en: "framing a future plan" },
            { ar: "ما شاءَ الله", en: "admiring something" },
            { ar: "الحَمدُ لله", en: "response to 'how are you'" },
            { ar: "بِسمِ الله", en: "before starting something" },
            { ar: "اللّه أَعلَم", en: "'I'm not sure'" },
            { ar: "بارَكَ اللَّهُ فيك", en: "strong thanks" },
          ],
        },
      ],
    },

    {
      id: "L10.5",
      levelId: "L10",
      order: 5,
      title: "Capstone — Comprehensive Review",
      subtitle: "The graduation exam",
      theme: "review",
      estimatedMinutes: 45,
      xp: 200,
      prerequisites: ["L10.4"],
      summary: "Random questions drawn from every level. Prove you own what you've learned.",
      wrapUp: "You finished. Whatever your score, remember — most people who start learning Arabic never reach Level 3, let alone Level 10. You've built a real foundation. Now go read something.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "ض",
          question: "Which letter, and which pair does it belong to?",
          choices: [
            "dāl, pairs with د",
            "dhāl, pairs with ذ",
            "ḍād (heavy d), pairs with د",
            "ẓāʾ, pairs with ذ",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ع",
          question: "Which letter, and what's its articulation?",
          choices: [
            "hamza — glottal stop",
            "ʿayn — voiced pharyngeal",
            "ghayn — voiced velar",
            "hāʾ — light h",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "بِنت",
          question: "Meaning?",
          choices: ["boy", "girl", "house", "book"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'as-salāmu ʿalaykum' is written with السّ at the start. In speech, it's pronounced:",
          choices: [
            "al-salāmu ʿalaykum (clearly)",
            "as-salāmu ʿalaykum (l assimilated — sun letter rule)",
            "'-salāmu ʿalaykum (l is completely dropped)",
            "ash-salāmu ʿalaykum (typo)",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which is a correctly agreed adjective phrase?",
          choices: [
            "al-bint al-jamīl (the beautiful girl)",
            "al-bint al-jamīla (the beautiful girl)",
            "al-bint jamīla (the girl is beautiful)",
            "Both (b) and (c) are correct — for different meanings",
          ],
          correctIndex: 3,
          explain: "(b) al-bint al-jamīla = 'the beautiful girl' (noun phrase, both definite). (c) al-bint jamīla = 'the girl is beautiful' (sentence, def. subject + indef. predicate).",
        },
        {
          kind: "mcq",
          question: "To say 'she is a doctor', the correct form is:",
          choices: [
            "huwa ṭabīb",
            "hiya ṭabīb",
            "hiya ṭabība",
            "hum ṭabīb",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "٥",
          question: "What number?",
          choices: ["3", "5", "6", "0"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'Five books' (kitāb, m., pl. kutub) is:",
          choices: [
            "khams kutub",
            "khamsa kutub",
            "khamsat kutub",
            "khamsūn kitāb",
          ],
          correctIndex: 2,
          explain: "Polarity: masculine counted noun → feminine-form number: khamsat.",
        },
        {
          kind: "mcq",
          question: "Friday in Arabic:",
          choices: ["al-aḥad", "al-jumuʿa", "as-sabt", "al-khamīs"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'I study Arabic' in MSA is most naturally:",
          choices: [
            "anā adrus al-ʿarabiyya",
            "adrus al-ʿarabiyya (pronoun implicit in prefix)",
            "anā yadrus al-ʿarabiyya",
            "Both (a) and (b) are correct",
          ],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "'I want coffee, please' is:",
          choices: [
            "anā urīd qahwa",
            "urīdu qahwa, min faḍlik",
            "yurīd qahwa min faḍlik",
            "aʿrif qahwa min faḍlik",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'kitāb al-mudarris' is an idāfa meaning:",
          choices: [
            "a book AND a teacher",
            "the teacher's book",
            "the book of teaching",
            "a book-teacher",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "To negate the nominal sentence 'al-bayt kabīr' (the house is big), you use:",
          choices: [
            "lā before kabīr",
            "mā before kabīr",
            "laysa before kabīr (with appropriate conjugation)",
            "You can't negate nominal sentences in Arabic",
          ],
          correctIndex: 2,
          explain: "Nominal sentence negation uses laysa. 'al-bayt laysa kabīran' = 'the house is not big'. Laysa puts its predicate in accusative.",
        },
        {
          kind: "mcq",
          question: "The past tense of 'I wrote' (root k-t-b):",
          choices: ["aktubu", "kataba", "katabtu", "yaktubu"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'hum katabū' means:",
          choices: ["he wrote", "they wrote (m)", "we wrote", "she wrote"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'in shāʾ Allāh' is most appropriately used when:",
          choices: [
            "Admiring someone's child",
            "Talking about a FUTURE plan",
            "Greeting a friend",
            "Thanking someone",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic's three 'weak letters' that double as long vowels are:",
          choices: ["ا و ي", "ب م ف", "ع ح غ", "ص ض ط"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "The Arabic root ك-ت-ب produces all of the following EXCEPT:",
          choices: [
            "kitāb (book)",
            "kātib (writer)",
            "maktab (office)",
            "ṭālib (student)",
          ],
          correctIndex: 3,
          explain: "ṭālib is from root ṭ-l-b ('seeking / demanding'). The others are all k-t-b.",
        },
        {
          kind: "match",
          prompt: "Final match — match each to its English",
          pairs: [
            { ar: "اِسمي", en: "my name" },
            { ar: "كَيفَ حالُك؟", en: "how are you?" },
            { ar: "الحَمدُ لله", en: "praise God / fine" },
            { ar: "مَعَ السَّلامَة", en: "goodbye" },
            { ar: "شُكراً", en: "thanks" },
            { ar: "مَكتَبة", en: "library" },
            { ar: "قَلب", en: "heart" },
            { ar: "اللُّغة العَرَبِيَّة", en: "the Arabic language" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'my name is Hanif' (ismī Ḥanīf) — transliteration.",
          expected: "ismi hanif",
          altAccepted: ["ismī Ḥanīf", "ismi Hanif", "ismī Hanif"],
        },
        {
          kind: "typing",
          prompt: "Type 'I am from America' (anā min Amrīkā) — transliteration.",
          expected: "ana min amrika",
          altAccepted: ["anā min Amrīkā", "ana min amerika", "ana min amreeka"],
        },
        {
          kind: "typing",
          prompt: "Type 'I don't know' (lā aʿrif) — transliteration.",
          expected: "la arif",
          altAccepted: ["lā aʿrif", "la a'rif", "laa aarif"],
        },
        {
          kind: "fillblank",
          prompt: "The ____ rule causes 'al-' to be pronounced 'ash-' before certain letters.",
          blank: "sun-letters",
          en: "sun-letters (ḥurūf shamsiyya)",
          choices: [
            "moon-letters",
            "sun-letters",
            "emphatic",
            "nisba",
          ],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "The Arabic past-tense suffix for 'I' is ____.",
          blank: "-tu",
          en: "-tu",
          choices: ["-a", "-tu", "-ī", "-nā"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
