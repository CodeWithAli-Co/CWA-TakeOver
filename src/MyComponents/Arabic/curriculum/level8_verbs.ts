// ============================================================================
// LEVEL 8 — Verbs, the root system, and simple sentences
//
// Depth focus: the 3-letter root and pattern system — the foundation of Arabic
// morphology — plus present tense conjugation and the verbal sentence.
// ============================================================================

import type { Level } from "../types";

export const level8: Level = {
  id: "L8",
  order: 8,
  title: "Verbs, Roots & Simple Sentences",
  subtitle: "Arabic's generative engine",
  theme: "verbs",
  goal: "Understand the root-and-pattern system, conjugate regular verbs in the present tense, form verbal sentences, and negate them.",
  lessons: [
    {
      id: "L8.1",
      levelId: "L8",
      order: 1,
      title: "The Root System — Arabic's Generative Engine",
      subtitle: "How three letters make twelve words",
      theme: "grammar",
      estimatedMinutes: 40,
      xp: 100,
      prerequisites: ["L7.5"],
      summary: "Most Arabic vocabulary is built by slotting 3-letter ROOTS into fixed PATTERNS. Learn this once and you unlock the whole dictionary.",
      wrapUp: "The root system is what makes Arabic radically different from English. Once you see it, you'll never unsee it — and every new word becomes partially transparent.",
      activities: [
        {
          kind: "info",
          title: "What a root is",
          body:
            "In Arabic, most vocabulary is not a random string of letters — it's a THREE-LETTER CONSONANTAL ROOT with a core meaning, slotted into various VOWEL PATTERNS to make related words.\n\n" +
            "Roots are written with their three consonants separated by dashes in linguistic notation:\n\n" +
            "  Root ك-ت-ب (k-t-b) → meaning: WRITING\n" +
            "  Root د-ر-س (d-r-s) → meaning: STUDYING\n" +
            "  Root ك-ل-م (k-l-m) → meaning: SPEECH\n" +
            "  Root ع-ل-م (ʿ-l-m) → meaning: KNOWING\n" +
            "  Root س-ل-م (s-l-m) → meaning: PEACE / WHOLENESS\n\n" +
            "A handful of SHAPES (patterns) then slot the root's three consonants into a mold to make a word:\n\n" +
            "  Pattern    Meaning              From k-t-b\n" +
            "  فَعَلَ        he did               كَتَبَ (kataba) — he wrote\n" +
            "  يَفْعُلُ       he does              يَكتُبُ (yaktubu) — he writes\n" +
            "  فاعِل       doer                  كاتِب (kātib) — writer\n" +
            "  مَفْعول     done thing            مَكتوب (maktūb) — written / fated\n" +
            "  مَفْعَل      place of doing        مَكتَب (maktab) — office / desk\n" +
            "  مَفْعَلة     place of doing (fem)  مَكتَبة (maktaba) — library\n" +
            "  فِعال       the act itself        كِتاب (kitāb) — book (that which is written)\n\n" +
            "Every three-letter root can be plugged into ALL these patterns. The meaning is mostly predictable from [root] + [pattern].\n\n" +
            "In the patterns above, linguists use فعل (f-ʿ-l, 'doing') as a STAND-IN for 'any root'. So فاعِل means 'the doer-pattern' — plug in k-t-b, and you get kātib.",
        },
        {
          kind: "info",
          title: "A family of words — root ك-ت-ب",
          body:
            "Watch how the same three letters (ك ت ب) reshape:\n\n" +
            "  كَتَبَ (kataba) — he wrote\n" +
            "  يَكتُبُ (yaktubu) — he writes\n" +
            "  اُكتُب (uktub) — write! (imperative)\n" +
            "  مَكتوب (maktūb) — written / destined\n" +
            "  كاتِب (kātib) — writer / author\n" +
            "  كَتَبة (kataba) — scribes (plural of kātib in one pattern)\n" +
            "  كُتَّاب (kuttāb) — writers (different plural)\n" +
            "  كِتاب (kitāb) — book\n" +
            "  كُتُب (kutub) — books\n" +
            "  كَتيبة (katība) — squadron / battalion (what's 'written down' as a group)\n" +
            "  كِتابة (kitāba) — the act of writing; a piece of writing\n" +
            "  مَكتَب (maktab) — office / desk\n" +
            "  مَكتَبة (maktaba) — library / bookstore\n" +
            "  مَكاتِب (makātib) — offices (plural of maktab)\n" +
            "  مُكاتَبة (mukātaba) — correspondence\n\n" +
            "15+ words from three consonants. Learn k-t-b once, and every word in the family is partially decoded.",
          showcase: [
            { ar: "كَتَبَ", translit: "kataba", en: "he wrote" },
            { ar: "يَكتُبُ", translit: "yaktubu", en: "he writes" },
            { ar: "كاتِب", translit: "kātib", en: "writer" },
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "مَكتَبة", translit: "maktaba", en: "library" },
            { ar: "مَكتوب", translit: "maktūb", en: "written / destined" },
          ],
        },
        {
          kind: "info",
          title: "Another root — د-ر-س",
          body:
            "Root د-ر-س carries 'studying / learning':\n\n" +
            "  دَرَسَ (darasa) — he studied\n" +
            "  يَدرُسُ (yadrusu) — he studies\n" +
            "  دَرَّسَ (darrasa) — he taught (form II — see L8.3)\n" +
            "  يُدَرِّسُ (yudarrisu) — he teaches\n" +
            "  دَرس (dars) — a lesson\n" +
            "  دُروس (durūs) — lessons\n" +
            "  دِراسة (dirāsa) — the act of studying / a study\n" +
            "  مَدرَسة (madrasa) — school (place of studying)\n" +
            "  مُدَرِّس (mudarris) — teacher (the one who teaches)\n" +
            "  مُدَرِّسة (mudarrisa) — female teacher\n\n" +
            "Notice the PATTERN GAMES in this family:\n" +
            "  • مَفْعَلة → مَدرَسة (place of studying)\n" +
            "  • مُفَعِّل → مُدَرِّس (one who causes studying = teacher)\n\n" +
            "If you know these patterns, you can decode unfamiliar words. Encounter مَلعَب (malʿab)? That's MAFʿAL pattern (place of) + l-ʿ-b (playing) → 'playground / stadium'. You never studied the word, but you can derive it.",
        },
        {
          kind: "info",
          title: "The ten verb forms — a peek ahead",
          body:
            "Arabic has TEN verb forms that can be derived from one root. Each form tweaks the core meaning:\n\n" +
            "  Form I     — basic action             kataba (he wrote)\n" +
            "  Form II    — causative / intensive    darrasa (he taught = caused to study)\n" +
            "  Form III   — reciprocal / attempted   kātaba (he corresponded WITH someone)\n" +
            "  Form IV    — causative (different)    aktaba (he dictated = made someone write)\n" +
            "  Form V     — reflexive of II         takarrama (he was gracious)\n" +
            "  Form VI    — mutual reciprocal        takātaba (they corresponded with each other)\n" +
            "  Form VII   — passive / intransitive   inkataba (it was written)\n" +
            "  Form VIII  — reflexive / self-benef.  iktataba (he subscribed)\n" +
            "  Form IX    — color / defect           iḥmarra (he/it became red)\n" +
            "  Form X     — request / estimation     istaktaba (he asked to be written for)\n\n" +
            "You won't learn all ten in this course. You'll primarily deal with Form I (basic) and some Form II (causative). But recognize that when you see a verb with a prefix like مُـ / إِسْـ / اِسْتَـ, it's a DERIVED form of a more basic root — and the prefix tells you HOW the meaning was modified.\n\n" +
            "This system is ANCIENT — preserved from Proto-Semitic, shared in principle with Hebrew (which has 7 main forms called binyanim). It's what makes Arabic so efficient at generating vocabulary: you don't invent new words, you PATTERN them.",
        },
        {
          kind: "mcq",
          question: "Which word is NOT from the root k-t-b?",
          choices: [
            "kitāb (book)",
            "maktab (office)",
            "kātib (writer)",
            "qalam (pen)",
          ],
          correctIndex: 3,
          explain: "qalam is from root q-l-m (trimming/writing), a different root. The others are all k-t-b.",
        },
        {
          kind: "mcq",
          question: "'maktaba' and 'madrasa' share which morphological pattern?",
          choices: [
            "Both are verbs",
            "Both are masculine plurals",
            "Both are 'place of [root]' — pattern mafʿala",
            "Both are feminine adjectives",
          ],
          correctIndex: 2,
          explain: "The MaFʿaLa pattern makes feminine 'place of' nouns. Maktaba = place of k-t-b = library. Madrasa = place of d-r-s = school. Same template, different roots.",
        },
        {
          kind: "mcq",
          question: "If you encounter a new word مَلعَب (malʿab), what's your best guess?",
          choices: [
            "A person who plays",
            "The game (abstract)",
            "A place of playing (playground / stadium)",
            "An act of playing",
          ],
          correctIndex: 2,
          explain: "Pattern MaFʿaL = 'place of [root]'. Root l-ʿ-b = playing. So malʿab = playground/stadium.",
        },
        {
          kind: "mcq",
          question: "'mudarris' and 'kātib' both follow a pattern meaning:",
          choices: [
            "The done thing",
            "The doer / agent",
            "The place of the action",
            "The tool used",
          ],
          correctIndex: 1,
          explain: "Pattern fāʿil (or its derived variant mufaʿʿil for Form II verbs) = 'the one who does [root]'. Kātib = writer. Mudarris = teacher (lit. 'one who causes studying').",
        },
        {
          kind: "mcq",
          question: "Arabic has how many standard VERB FORMS that derive from a single root?",
          choices: ["3", "5", "7", "10"],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "The root system of Arabic is preserved from:",
          choices: [
            "Classical Greek",
            "Proto-Semitic — shared with Hebrew, Aramaic, Amharic",
            "Persian",
            "Old Egyptian",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match each word to its root's core meaning",
          pairs: [
            { ar: "كِتاب (kitāb)", en: "writing" },
            { ar: "مَدرَسة (madrasa)", en: "studying" },
            { ar: "عِلم (ʿilm)", en: "knowing" },
            { ar: "سَلام (salām)", en: "peace / wholeness" },
            { ar: "كَلام (kalām)", en: "speech" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic root (3 consonants, no dashes) for 'writing' — same root as kitāb.",
          expected: "ktb",
          altAccepted: ["k-t-b"],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic root (3 consonants) for 'studying' — same root as madrasa.",
          expected: "drs",
          altAccepted: ["d-r-s"],
        },
      ],
    },

    {
      id: "L8.2",
      levelId: "L8",
      order: 2,
      title: "Present Tense Conjugation",
      subtitle: "One pattern of prefixes and suffixes — every verb follows it",
      theme: "verbs",
      estimatedMinutes: 45,
      xp: 110,
      prerequisites: ["L8.1"],
      summary: "The present-tense Arabic verb conjugates through 13 forms. But the system is highly regular.",
      wrapUp: "Regular present-tense conjugation is formulaic. Learn the prefix/suffix table and every regular verb is yours.",
      activities: [
        {
          kind: "info",
          title: "How the present tense is built",
          body:
            "The Arabic PRESENT TENSE (المُضارِع, al-muḍāriʿ) is built by:\n\n" +
            "  PREFIX + STEM + SUFFIX\n\n" +
            "The STEM is fixed per root (with some variations across verb forms — we'll stick to Form I verbs in this course). For the verb 'to study' (root d-r-s, Form I), the present stem is -drus-:\n\n" +
            "  Prefix:         أَ (a-) — I / self\n" +
            "                   تَ (ta-) — you (m/f) / she / dual m\n" +
            "                   يَ (ya-) — he / they (m) / dual f\n" +
            "                   نَ (na-) — we\n\n" +
            "  Suffix:         varies by person/gender/number\n\n" +
            "Full table for 'to study':\n\n" +
            "  أَنا       أَدْرُسُ       (adrusu)       I study\n" +
            "  أَنْتَ       تَدْرُسُ       (tadrusu)     you study (m)\n" +
            "  أَنْتِ       تَدْرُسِينَ     (tadrusīna)   you study (f)\n" +
            "  هُوَ       يَدْرُسُ       (yadrusu)     he studies\n" +
            "  هِيَ       تَدْرُسُ       (tadrusu)     she studies\n" +
            "  نَحْنُ      نَدْرُسُ       (nadrusu)     we study\n" +
            "  أَنْتُم      تَدْرُسُونَ     (tadrusūna)   you study (pl m)\n" +
            "  أَنْتُنَّ      تَدْرُسْنَ      (tadrusna)    you study (pl f)\n" +
            "  هُم        يَدْرُسُونَ     (yadrusūna)   they study (m)\n" +
            "  هُنَّ        يَدْرُسْنَ      (yadrusna)    they study (f)\n" +
            "  هُما       يَدْرُسانِ      (yadrusāni)   they two study (m dual)\n" +
            "  هُما       تَدْرُسانِ      (tadrusāni)   they two study (f dual)\n" +
            "  أَنْتُما     تَدْرُسانِ      (tadrusāni)   you two study\n\n" +
            "Key observations:\n" +
            "  • أ (a-) only for 'I'.\n" +
            "  • ن (na-) only for 'we'.\n" +
            "  • ت (ta-) = second-person AND third-person feminine singular. (yes, context decides.)\n" +
            "  • ي (ya-) = third-person masculine and plurals beginning with 'they (m)'.\n\n" +
            "The final vowels (-u, -a, -na, -ni) are MOOD markers — they indicate indicative (default), subjunctive, or jussive. In casual speech, these are often dropped. For now: use -u for plain present.",
        },
        {
          kind: "info",
          title: "Three more verbs with the same skeleton",
          body:
            "Same conjugation pattern, three high-frequency verbs:\n\n" +
            "  To WRITE — root k-t-b — present stem -ktub-:\n" +
            "    أَكتُبُ (aktubu) — I write\n" +
            "    تَكتُبُ (taktubu) — you write (m)\n" +
            "    يَكتُبُ (yaktubu) — he writes\n" +
            "    نَكتُبُ (naktubu) — we write\n\n" +
            "  To EAT — root ʾ-k-l — present stem -ʾkul-:\n" +
            "    آكُلُ (ākulu) — I eat (alif-madda because of the ʾ)\n" +
            "    تَأكُلُ (taʾkulu) — you eat\n" +
            "    يَأكُلُ (yaʾkulu) — he eats\n" +
            "    نَأكُلُ (naʾkulu) — we eat\n\n" +
            "  To DRINK — root sh-r-b — present stem -shrab-:\n" +
            "    أَشرَبُ (ashrabu) — I drink\n" +
            "    تَشرَبُ (tashrabu) — you drink\n" +
            "    يَشرَبُ (yashrabu) — he drinks\n" +
            "    نَشرَبُ (nashrabu) — we drink\n\n" +
            "The stem VOWEL varies between roots — some Form I verbs have stem vowel 'u' (yaktubu, yadrusu), others 'a' (yashrabu, yaʿmalu), others 'i' (yajlisu, he sits). The dictionary lists the stem vowel; over time you absorb them.",
          showcase: [
            { ar: "أَدرُسُ العَرَبِيَّة", translit: "adrusu l-ʿarabiyya", en: "I study Arabic" },
            { ar: "يَكتُبُ رِسالة", translit: "yaktubu risāla", en: "he writes a letter" },
            { ar: "نَشرَبُ الماء", translit: "nashrabu l-māʾ", en: "we drink the water" },
            { ar: "تَأكُلين فاكِهة", translit: "taʾkulīna fākiha", en: "you (f) eat fruit" },
          ],
        },
        {
          kind: "info",
          title: "Word order: verbal sentences",
          body:
            "Arabic has TWO sentence types:\n\n" +
            "  1. Nominal sentence (jumla ismiyya) — starts with a noun or pronoun (Level 5 stuff).\n" +
            "  2. Verbal sentence (jumla fiʿliyya) — starts with the VERB.\n\n" +
            "Classical order for a verbal sentence: VERB + SUBJECT + OBJECT.\n\n" +
            "  كَتَبَ الوَلَدُ رِسالةً. (kataba l-waladu risālatan) — 'Wrote the boy a letter' = 'The boy wrote a letter.'\n\n" +
            "Key oddity: in a verbal sentence, the verb stays MASCULINE SINGULAR (he-form) even when the subject is plural. Only when the subject comes BEFORE the verb (i.e., in a nominal sentence) does full agreement kick in.\n\n" +
            "  كَتَبَ الطُّلّاب → 'the students wrote' (verb first, singular agreement)\n" +
            "  الطُّلّاب كَتَبوا → 'the students wrote' (subject first, plural agreement: katabū with -ū suffix)\n\n" +
            "In modern written Arabic (newspapers, novels), subject-first order (SVO, like English) has become more common. But traditional fuṣḥā still prefers VSO.\n\n" +
            "With a pronoun subject, the pronoun is usually OMITTED because the verb ending already marks the person:\n" +
            "  أَدرُسُ العَرَبِيَّة (adrusu l-ʿarabiyya) — 'I study Arabic' (ana is implicit in the prefix أ)\n" +
            "  يَشرَبُ الماء (yashrabu l-māʾ) — 'he drinks the water' (huwa implicit in ي)\n\n" +
            "Include the pronoun only for emphasis: أَنا أَدرُسُ (anā adrusu) — 'I [am the one who] study[s]'.",
        },
        {
          kind: "mcq",
          question: "'nadrusu l-ʿarabiyya' means:",
          choices: [
            "I study Arabic",
            "She studies Arabic",
            "We study Arabic",
            "They study Arabic",
          ],
          correctIndex: 2,
          explain: "Prefix نـ (na-) = 'we'.",
        },
        {
          kind: "mcq",
          question: "From the root k-t-b, how do you say 'he writes'?",
          choices: ["aktubu", "taktubu", "yaktubu", "naktubu"],
          correctIndex: 2,
          explain: "Prefix ي (ya-) for 'he'. Stem -ktub-. → yaktubu.",
        },
        {
          kind: "mcq",
          question: "The prefix ت (ta-) is used for:",
          choices: [
            "Only 'you' (singular)",
            "You (m/f singular), SHE, and some duals",
            "Only 'she'",
            "All persons",
          ],
          correctIndex: 1,
          explain: "ت covers you-m, you-f, you-pl-m, you-pl-f, she, and some duals. Context (plus any suffix) disambiguates.",
        },
        {
          kind: "mcq",
          question: "In Classical Arabic, a verbal sentence has which word order?",
          choices: ["Subject-Verb-Object", "Verb-Subject-Object", "Object-Verb-Subject", "Subject-Object-Verb"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Why is 'anā adrusu' somewhat redundant?",
          choices: [
            "It's grammatically incorrect",
            "The prefix أ already marks 'I'; the pronoun is implicit",
            "The verb is feminine but the pronoun is masculine",
            "It's only used in poetry",
          ],
          correctIndex: 1,
          explain: "Arabic verbs encode the subject in the prefix/suffix. Pronouns are optional and typically used for emphasis or contrast.",
        },
        {
          kind: "fillblank",
          prompt: "نَحنُ ____ العَرَبِيَّة. (We study Arabic.)",
          blank: "نَدرُسُ (nadrusu)",
          en: "we study",
          choices: ["أَدرُسُ", "تَدرُسُ", "يَدرُسُ", "نَدرُسُ"],
          correctIndex: 3,
        },
        {
          kind: "fillblank",
          prompt: "هُوَ ____ رِسالة. (He writes a letter.)",
          blank: "يَكتُبُ (yaktubu)",
          en: "he writes",
          choices: ["أَكتُبُ", "تَكتُبُ", "يَكتُبُ", "نَكتُبُ"],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match conjugation to subject (root: d-r-s)",
          pairs: [
            { ar: "أَدرُسُ", en: "I study" },
            { ar: "تَدرُسُ", en: "you study (m) / she studies" },
            { ar: "يَدرُسُ", en: "he studies" },
            { ar: "نَدرُسُ", en: "we study" },
            { ar: "يَدرُسونَ", en: "they study (m pl)" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'I write' (root k-t-b, Form I present) — transliteration.",
          expected: "aktubu",
          altAccepted: ["aktub"],
        },
        {
          kind: "typing",
          prompt: "Type 'we drink' (root sh-r-b) — transliteration.",
          expected: "nashrabu",
          altAccepted: ["nashrab"],
        },
      ],
    },

    {
      id: "L8.3",
      levelId: "L8",
      order: 3,
      title: "High-Frequency Verbs",
      subtitle: "A starter pack that covers 80% of daily speech",
      theme: "verbs",
      estimatedMinutes: 35,
      xp: 85,
      prerequisites: ["L8.2"],
      summary: "Memorize ~15 verbs and you can say a huge range of things.",
      wrapUp: "You now have the core verb vocabulary. The next lesson shows you how to say the OPPOSITE of these — negation.",
      activities: [
        {
          kind: "info",
          title: "Starter pack",
          body:
            "All verbs below are given in the HE-form present tense (يَفعَل / yafʿal), which is the dictionary-citation form in most modern Arabic dictionaries. Conjugate them using the pattern from L8.2.\n\n" +
            "  يَأكُل (yaʾkul) — eats\n" +
            "  يَشرَب (yashrab) — drinks\n" +
            "  يَنام (yanām) — sleeps (irregular / hollow verb, stem vowel shifts)\n" +
            "  يَذهَب (yadhhab) — goes\n" +
            "  يَأتي (yaʾtī) — comes (weak final verb)\n" +
            "  يَجلِس (yajlis) — sits\n" +
            "  يَقِف (yaqif) — stands (irregular)\n" +
            "  يَعمَل (yaʿmal) — works / does\n" +
            "  يَقرَأ (yaqraʾ) — reads\n" +
            "  يَكتُب (yaktub) — writes\n" +
            "  يَدرُس (yadrus) — studies\n" +
            "  يَتَكَلَّم (yatakallam) — speaks (Form V — reflexive pattern)\n" +
            "  يَفهَم (yafham) — understands\n" +
            "  يَعرِف (yaʿrif) — knows\n" +
            "  يُحِبّ (yuḥibb) — loves / likes (Form IV — doubled root)\n" +
            "  يُريد (yurīd) — wants (Form IV)\n" +
            "  يَقول (yaqūl) — says (irregular)\n" +
            "  يَسمَع (yasmaʿ) — hears\n" +
            "  يَرى (yarā) — sees (very irregular)\n\n" +
            "Notes:\n" +
            "  • Some of these are 'weak' (contain و or ي in the root) — they conjugate irregularly. You'll learn the patterns over time.\n" +
            "  • The Form V يَتَكَلَّم (yatakallam) has a ت prefix as part of the pattern, plus the regular conjugation prefix. In 'I speak' it becomes أَتَكَلَّم (atakallam).\n" +
            "  • 'yuḥibb' has a doubled middle letter (shadda) — note the يُـ (yu-) instead of يَـ (ya-) for Form IV.",
          showcase: [
            { ar: "أَشرَبُ ماء", translit: "ashrabu māʾ", en: "I drink water" },
            { ar: "يَأكُلُ وَلَدٌ", translit: "yaʾkulu waladun", en: "a boy eats" },
            { ar: "نَتَكَلَّمُ العَرَبِيَّة", translit: "natakallamu l-ʿarabiyya", en: "we speak Arabic" },
            { ar: "أُريدُ قَهوة", translit: "urīdu qahwa", en: "I want coffee" },
            { ar: "هِيَ تَقرَأ الكِتاب", translit: "hiya taqraʾu l-kitāb", en: "she reads the book" },
            { ar: "يَعرِفُ الجَواب", translit: "yaʿrifu l-jawāb", en: "he knows the answer" },
          ],
        },
        {
          kind: "info",
          title: "Objects and definite/indefinite",
          body:
            "In a verbal sentence, the direct object (what's acted on) follows the subject:\n\n" +
            "  أَكتُبُ رِسالةً. (aktubu risālatan) — I write A letter. (indef. object with tanwīn)\n" +
            "  أَكتُبُ الرِّسالةَ. (aktubu r-risālata) — I write THE letter. (def. object with fatḥa, no tanwīn)\n\n" +
            "Notice how the object takes ـًا (tanwīn -an) when indefinite and ـَ (just fatḥa) when definite. Both endings mark ACCUSATIVE case — the 'object-of-the-verb' case. In speech, these vowels are usually dropped. In writing, they appear in fully vocalized text.\n\n" +
            "Common object types you'll see:\n" +
            "  أَشرَبُ ماءً / الماءَ — I drink water / the water\n" +
            "  أُحِبُّ القَهوة — I love coffee\n" +
            "  نَدرُسُ اللُّغة العَرَبِيَّة — we study the Arabic language",
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
          kind: "mcq",
          question: "To say 'I want coffee', you'd say:",
          choices: [
            "yurīd qahwa",
            "anā urīd qahwa",
            "naḥnu urīd qahwa",
            "urīd qahwa (no pronoun needed, implicit in the verb)",
          ],
          correctIndex: 3,
          explain: "The أ prefix in أُريد already encodes 'I'. Including anā is optional (for emphasis).",
        },
        {
          kind: "mcq",
          question: "'yuḥibb' begins with 'yu-' instead of 'ya-'. This is because:",
          choices: [
            "Regional dialect",
            "Typo convention",
            "It's a Form IV verb — Forms II, III, IV take 'yu-' instead of 'ya-'",
            "It's a past tense",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ قَهوة. (I want coffee.)",
          blank: "أُريدُ (urīdu)",
          en: "I want",
          choices: ["يُريدُ", "تُريدُ", "أُريدُ", "نُريدُ"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "هُم ____ العَرَبِيَّة. (They speak Arabic.)",
          blank: "يَتَكَلَّمون (yatakallamūn)",
          en: "they speak",
          choices: ["أَتَكَلَّمُ", "تَتَكَلَّمُ", "يَتَكَلَّمُ", "يَتَكَلَّمون"],
          correctIndex: 3,
        },
        {
          kind: "match",
          prompt: "Match verb (he-form) to meaning",
          pairs: [
            { ar: "يَأكُل", en: "eats" },
            { ar: "يَشرَب", en: "drinks" },
            { ar: "يَذهَب", en: "goes" },
            { ar: "يَقرَأ", en: "reads" },
            { ar: "يَعرِف", en: "knows" },
            { ar: "يُحِبّ", en: "loves" },
            { ar: "يَتَكَلَّم", en: "speaks" },
            { ar: "يُريد", en: "wants" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'I eat' (ākul / ākulu) — transliteration.",
          expected: "akul",
          altAccepted: ["ākul", "aakul", "ākulu", "akulu"],
        },
        {
          kind: "typing",
          prompt: "Type 'she reads' (taqraʾ) — transliteration.",
          expected: "taqra",
          altAccepted: ["taqraʾ", "taqra'", "taqra'u", "taqrau"],
        },
      ],
    },

    {
      id: "L8.4",
      levelId: "L8",
      order: 4,
      title: "Negation — Lā, Mā, Laysa",
      subtitle: "Three ways to say 'not', depending on what you're negating",
      theme: "grammar",
      estimatedMinutes: 35,
      xp: 85,
      prerequisites: ["L8.3"],
      summary: "Arabic uses different negation words for different sentence types. Know which goes where.",
      wrapUp: "You've got the three most common negators. With these you can deny anything in present tense.",
      activities: [
        {
          kind: "info",
          title: "لا (lā) — negating the present verb",
          body:
            "لا (lā) is placed BEFORE a present-tense verb to mean 'does/do not'.\n\n" +
            "  أَنا لا أَشرَبُ القَهوة. (anā lā ashrabu l-qahwa) — I don't drink coffee.\n" +
            "  هُوَ لا يَعرِف. (huwa lā yaʿrif) — he doesn't know.\n" +
            "  نَحنُ لا نَتَكَلَّمُ الفَرَنسيَّة. (naḥnu lā natakallamu l-faransiyya) — we don't speak French.\n\n" +
            "لا is also the standalone word for 'no' as an answer.\n\n" +
            "  هَل تُحِبُّ الشاي؟ — Do you like tea?\n" +
            "  لا، شُكراً. — No, thanks.",
        },
        {
          kind: "info",
          title: "ما (mā) — negating the past tense (and some other cases)",
          body:
            "ما (mā) is traditionally used to negate a PAST-TENSE verb. We haven't formally introduced the past yet, but you'll want to recognize this.\n\n" +
            "  ما ذَهَبتُ. (mā dhahabtu) — I didn't go.\n" +
            "  ما كَتَبَ الرِّسالة. (mā kataba r-risāla) — he didn't write the letter.\n\n" +
            "In Modern Standard Arabic, ما is also sometimes used with the present, especially in older literary register:\n" +
            "  ما أَعرِف — I don't know (literary / dialect-influenced)\n\n" +
            "For the present in standard fuṣḥā, prefer لا.\n\n" +
            "ما is ALSO the word for 'what':\n" +
            "  ما اِسمُكَ؟ — What is your name?\n" +
            "  ما هذا؟ — What is this?\n\n" +
            "Context (and the presence or absence of a question mark / interrogative framing) disambiguates.",
        },
        {
          kind: "info",
          title: "لَيسَ (laysa) — negating nominal sentences",
          body:
            "When you want to negate a NOMINAL sentence (the 'X is Y' zero-copula type from Level 5), you need لَيسَ (laysa) — 'is not'.\n\n" +
            "Simple use:\n" +
            "  هُوَ مُدَرِّس. (huwa mudarris) — He is a teacher.\n" +
            "  هُوَ لَيسَ مُدَرِّسًا. (huwa laysa mudarrisan) — He is NOT a teacher.\n\n" +
            "Note what happened to 'mudarris':\n" +
            "  • In the positive sentence, it's nominative: mudarris.\n" +
            "  • In the negative sentence, laysa puts it in ACCUSATIVE: mudarrisan (tanwīn -an).\n\n" +
            "This is a case-shift triggered by laysa. In casual speech, the ending is often dropped, but in writing it's standard.\n\n" +
            "لَيسَ CONJUGATES like a verb — it takes different forms for different subjects:\n\n" +
            "  لَستُ (lastu) — I am not\n" +
            "  لَستَ (lasta) — you are not (m)\n" +
            "  لَستِ (lasti) — you are not (f)\n" +
            "  لَيسَ (laysa) — he is not\n" +
            "  لَيسَت (laysat) — she is not\n" +
            "  لَسنا (lasnā) — we are not\n" +
            "  لَستُم (lastum) — you are not (pl m)\n" +
            "  لَيسوا (laysū) — they are not (m)\n\n" +
            "Examples:\n" +
            "  أَنا لَستُ مُدَرِّسًا. — I am not a teacher.\n" +
            "  هِيَ لَيسَت سَعيدة. — She is not happy.\n" +
            "  نَحنُ لَسنا مِن مِصر. — We are not from Egypt.",
          showcase: [
            { ar: "هُوَ لَيسَ طالِبًا", translit: "huwa laysa ṭāliban", en: "he is not a student" },
            { ar: "أَنا لَستُ مِن مِصر", translit: "anā lastu min Miṣr", en: "I am not from Egypt" },
            { ar: "هِيَ لَيسَت هُنا", translit: "hiya laysat hunā", en: "she is not here" },
          ],
        },
        {
          kind: "info",
          title: "Summary — which negator goes where?",
          body:
            "Decision tree:\n\n" +
            "  IS IT A VERB?\n" +
            "    • Present tense → لا (lā) before the verb\n" +
            "    • Past tense → ما (mā) before the verb [or لَم + present-jussive, covered later]\n" +
            "    • Future tense → لَن (lan) [covered later]\n\n" +
            "  IS IT A NOMINAL SENTENCE (no verb, 'X is Y')?\n" +
            "    • Use لَيسَ (laysa) — conjugates, makes the predicate ACCUSATIVE.\n\n" +
            "  IS IT A COMMAND (don't do X)?\n" +
            "    • Use لا + jussive-mood verb (covered later).\n\n" +
            "For now, the two you'll use most: لا for present verbs, لَيسَ for nominal sentences.",
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
          kind: "mcq",
          question: "'huwa laysa ṭāliban' means:",
          choices: [
            "He is a student",
            "He is not a student",
            "He doesn't study",
            "He was a student",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'She is not here' — hiya ____ hunā. The blank is:",
          choices: ["lā", "mā", "laysat", "laysa"],
          correctIndex: 2,
          explain: "Nominal sentence → laysa. 'She' → feminine form → laysat.",
        },
        {
          kind: "mcq",
          question: "To negate 'he drinks tea' (huwa yashrabu sh-shāy), you say:",
          choices: [
            "huwa mā yashrabu sh-shāy",
            "huwa lā yashrabu sh-shāy",
            "huwa laysa yashrabu sh-shāy",
            "lā yashrabu sh-shāy",
          ],
          correctIndex: 1,
          explain: "Present-tense verb → negate with لا. 'huwa' is optional.",
        },
        {
          kind: "mcq",
          question: "'laysa' changes form based on:",
          choices: [
            "The tense",
            "The subject (person, gender, number)",
            "The object",
            "The register (formal/informal)",
          ],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "هِيَ ____ تَتَكَلَّمُ العَرَبِيَّة. (She doesn't speak Arabic.)",
          blank: "لا (lā)",
          en: "lā (negates present verb)",
          choices: ["لا", "ما", "لَيسَ", "لَيسَت"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ مُدَرِّسًا. (I am not a teacher.)",
          blank: "لَستُ (lastu)",
          en: "I am not",
          choices: ["لَستُ", "لَيسَ", "لا", "ما"],
          correctIndex: 0,
          explain: "Nominal sentence + first-person subject → lastu (I am not).",
        },
        {
          kind: "match",
          prompt: "Match negator to its use",
          pairs: [
            { ar: "لا", en: "negates present-tense verb" },
            { ar: "ما", en: "negates past-tense verb" },
            { ar: "لَيسَ", en: "negates nominal sentence (is not — masc)" },
            { ar: "لَيسَت", en: "is not (feminine)" },
            { ar: "لَستُ", en: "I am not" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'I am not a student' (m) — anā lastu ṭāliban (transliteration).",
          expected: "ana lastu taliban",
          altAccepted: ["anā lastu ṭāliban", "ana lastu taaliban"],
        },
      ],
    },

    {
      id: "L8.5",
      levelId: "L8",
      order: 5,
      title: "Level 8 Review — Build Real Sentences",
      subtitle: "Produce verbal and nominal sentences you can use tomorrow",
      theme: "review",
      estimatedMinutes: 35,
      xp: 130,
      prerequisites: ["L8.4"],
      summary: "Thorough review of roots, present conjugation, common verbs, and negation.",
      wrapUp: "Level 8 is a major milestone. From here, you're not parsing letters — you're doing linguistics. The next two levels layer on context: daily life (food, ordering) and finally reading connected prose.",
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
          kind: "mcq",
          question: "Which form of يَدرُس (yadrus) conjugates as 'I study'?",
          choices: ["yadrusu", "tadrusu", "adrusu", "nadrusu"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To negate 'hiya ṭabība' (she is a doctor), you say:",
          choices: [
            "hiya lā ṭabība",
            "hiya mā ṭabība",
            "hiya laysat ṭabība(tan)",
            "hiya laysa ṭabība",
          ],
          correctIndex: 2,
          explain: "Nominal sentence + feminine subject → laysat. Predicate becomes accusative: ṭabībatan.",
        },
        {
          kind: "mcq",
          question: "The relationship between kitāb, kātib, and maktaba is:",
          choices: [
            "They are unrelated words",
            "They all come from the same 3-letter root (k-t-b) in different patterns",
            "They are synonyms",
            "They are conjugations of one verb",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Pattern مَفْعَل / mafʿal typically means:",
          choices: [
            "The doer",
            "The action itself",
            "The place of the action",
            "The past tense",
          ],
          correctIndex: 2,
          explain: "maktab (office, k-t-b root), malʿab (playground, l-ʿ-b), madkhal (entrance, d-kh-l), maṭbakh (kitchen, ṭ-b-kh). All are 'place of [doing]'.",
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ القَهوة. (I drink coffee.)",
          blank: "أَشرَبُ (ashrabu)",
          en: "I drink",
          choices: ["يَشرَبُ", "تَشرَبُ", "أَشرَبُ", "نَشرَبُ"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "هِيَ ____ العَرَبِيَّة. (She speaks Arabic.)",
          blank: "تَتَكَلَّمُ (tatakallamu)",
          en: "she speaks",
          choices: ["أَتَكَلَّمُ", "تَتَكَلَّمُ", "يَتَكَلَّمُ", "نَتَكَلَّمُ"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "To negate 'I want coffee' — anā ____ urīd al-qahwa.",
          blank: "لا",
          en: "lā",
          choices: ["لا", "ما", "لَيسَ", "لَستُ"],
          correctIndex: 0,
        },
        {
          kind: "dialogue",
          prompt: "Read and answer.",
          lines: [
            { speaker: "A", ar: "ماذا تَدرُس؟", translit: "mādhā tadrus?", en: "What do you study?" },
            { speaker: "B", ar: "أَدرُس اللُّغة العَرَبِيَّة.", translit: "adrus al-lugha al-ʿarabiyya.", en: "I study the Arabic language." },
            { speaker: "A", ar: "أَين تَدرُس؟", translit: "ayna tadrus?", en: "Where do you study?" },
            { speaker: "B", ar: "في البَيت. أُدَرِّس نَفسي.", translit: "fī l-bayt. udarris nafsī.", en: "At home. I teach myself." },
            { speaker: "A", ar: "ما شاءَ الله. هَل تَعرِف كَثيراً؟", translit: "mā shāʾ Allāh. hal taʿrif kathīran?", en: "Wonderful. Do you know a lot?" },
            { speaker: "B", ar: "لا، لا أَعرِف كَثيراً — لَكِنَّني أَتَعَلَّم كُلَّ يَوم.", translit: "lā, lā aʿrif kathīran — lākinnanī ataʿallam kulla yawm.", en: "No, I don't know a lot — but I learn every day." },
          ],
          question: "Where does person B study Arabic?",
          choices: ["at school", "at a university", "at home", "at a library"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "In the dialogue, person B says 'udarris nafsī'. Breakdown: udarris = I teach (Form II). What does nafsī mean?",
          choices: [
            "A student",
            "Myself (my self)",
            "A subject",
            "A teacher",
          ],
          correctIndex: 1,
          explain: "nafs = 'self / soul'. nafsī = 'myself'. 'I teach myself' is the Arabic way to say 'I self-teach / I'm self-taught'.",
        },
        {
          kind: "typing",
          prompt: "Type 'I don't know' (lā aʿrif) — transliteration.",
          expected: "la arif",
          altAccepted: ["lā aʿrif", "la a'rif", "laa a'rif", "laa aarif"],
        },
        {
          kind: "typing",
          prompt: "Type 'we study Arabic' (naḥnu nadrus al-ʿarabiyya) — transliteration.",
          expected: "nahnu nadrus al-arabiyya",
          altAccepted: [
            "naḥnu nadrus al-ʿarabiyya",
            "nahnu nadrus alarabiyya",
            "nadrus al-arabiyya",
          ],
        },
      ],
    },
  ],
};
