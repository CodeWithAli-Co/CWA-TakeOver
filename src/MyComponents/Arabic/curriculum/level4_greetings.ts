// ============================================================================
// LEVEL 4 — Greetings, introductions, social exchange
//
// Depth focus: greeting registers, gendered forms (anta/anti), response
// protocols, cultural norms around salutations, and the common religious
// expressions embedded in everyday speech.
// ============================================================================

import type { Level } from "../types";

export const level4: Level = {
  id: "L4",
  order: 4,
  title: "Greetings & Introductions",
  subtitle: "Socially functional Arabic",
  theme: "greetings",
  goal: "Greet, reply, introduce yourself, ask and answer origin questions, and navigate the gender distinction in second-person address.",
  lessons: [
    {
      id: "L4.1",
      levelId: "L4",
      order: 1,
      title: "Salām, Marḥaban, Ahlan — Three Registers",
      subtitle: "Greetings ranked by formality",
      theme: "greetings",
      estimatedMinutes: 30,
      xp: 65,
      prerequisites: ["L3.7"],
      summary: "The three most common Arabic greetings — and when each fits.",
      wrapUp: "You now have three greetings for three registers: religious-formal (salām), neutral-formal (marḥaban), informal (ahlan). A good Arabic speaker shifts between them fluidly.",
      activities: [
        {
          kind: "info",
          title: "السَّلامُ عَلَيكُم — the traditional greeting",
          body:
            "السَّلامُ عَلَيكُم (as-salāmu ʿalaykum) — literally 'THE peace [be] upon you (pl.)'.\n\n" +
            "Notes on the structure:\n" +
            "  • السَّلام (as-salām) — 'the peace', definite. Sun-letter rule: 'l' assimilates into ص... actually س, so → 'as-'.\n" +
            "  • ـُ at the end of السَّلامُ — a ḍamma marking nominative case ('the peace' is the subject of an implicit 'be').\n" +
            "  • عَلَى (ʿalā) — 'upon' / 'on'.\n" +
            "  • ـكُم (-kum) — attached pronoun, 'you (plural)'. You greet as if addressing a group — a linguistic politeness that extends to individuals.\n\n" +
            "Response: وَعَلَيكُمُ السَّلام (wa-ʿalaykumu s-salām) — 'and upon you [be] peace'. The response flips the phrase around.\n\n" +
            "Extended formal versions:\n" +
            "  السَّلامُ عَلَيكُم وَرَحمَةُ الله (as-salāmu ʿalaykum wa-raḥmatu-llāh)\n" +
            "    — '… and the mercy of God'\n" +
            "  السَّلامُ عَلَيكُم وَرَحمَةُ الله وَبَرَكاتُه (… wa-barakātuh)\n" +
            "    — '… and the mercy of God and his blessings'\n\n" +
            "The response gets correspondingly extended:\n" +
            "  وَعَلَيكُمُ السَّلامُ وَرَحمَةُ الله وَبَرَكاتُه\n\n" +
            "Register: used throughout the Muslim world, across dialects, in person and in writing. It's the default in religious or formal settings, and among Muslims casually too. Non-Muslims may use it when addressing Muslims as a gesture of respect; it's not exclusive but the association is strong.",
          showcase: [
            { ar: "السَّلامُ عَلَيكُم", translit: "as-salāmu ʿalaykum", en: "peace be upon you" },
            { ar: "وَعَلَيكُمُ السَّلام", translit: "wa-ʿalaykumu s-salām", en: "and upon you peace" },
            { ar: "وَرَحمَةُ الله", translit: "wa-raḥmatu-llāh", en: "…and God's mercy" },
          ],
        },
        {
          kind: "info",
          title: "مَرْحَباً and أَهلاً — the secular greetings",
          body:
            "مَرْحَباً (marḥaban) — 'hello'. From the root r-ḥ-b meaning 'wide / spacious'. The greeting literally means 'spaciously!' — come in, there's room for you. Widely used across the Arab world, by anyone of any background. Neutral-formal register.\n\n" +
            "  Response: مَرْحَباً بِك (marḥaban bik) — 'hello to you' (m.)  /  مَرْحَباً بِكِ (marḥaban biki) — (f.)\n\n" +
            "أَهلاً (ahlan) — literally 'family' (ahl). Used as 'hi / welcome'. Informal but widely used.\n\n" +
            "  Response: أَهلاً وَسَهلاً (ahlan wa sahlan) — 'family and ease'. The full phrase is poetic: 'may you find family here, may you find ease'. In practice, shortened to ahlan in quick exchanges.\n\n" +
            "Both مَرْحَباً and أَهلاً end in fatḥatān (tanwīn) — they function adverbially ('in welcome', 'in family-spirit').\n\n" +
            "You can STACK them: 'مَرحَباً! أَهلاً وَسَهلاً!' ('Hello! Welcome welcome!'). In hospitality-oriented Arab culture, a warm greeting is rarely thought overdone.",
          showcase: [
            { ar: "مَرْحَباً", translit: "marḥaban", en: "hello" },
            { ar: "مَرْحَباً بِك", translit: "marḥaban bik", en: "hello to you (m)" },
            { ar: "أَهلاً", translit: "ahlan", en: "hi / welcome" },
            { ar: "أَهلاً وَسَهلاً", translit: "ahlan wa sahlan", en: "warm welcome" },
          ],
        },
        {
          kind: "info",
          title: "Which one to use when",
          body:
            "Rough guide:\n\n" +
            "  • First meeting, elders, formal settings: السَّلامُ عَلَيكُم (if culturally appropriate) or مَرْحَباً\n" +
            "  • Colleagues, peers, shopkeepers: مَرْحَباً\n" +
            "  • Friends, casual: أَهلاً (or anything)\n" +
            "  • Religious / traditional contexts: السَّلامُ عَلَيكُم (with the full response)\n\n" +
            "Never wrong to err formal. If someone greets you with السَّلامُ عَلَيكُم, the CORRECT response is وَعَلَيكُمُ السَّلام — respond in kind. Responding 'marḥaban' to 'as-salāmu ʿalaykum' is not wrong but registers as mismatched.",
        },
        {
          kind: "mcq",
          question: "Someone says 'as-salāmu ʿalaykum'. The standard response is:",
          choices: [
            "marḥaban",
            "wa-ʿalaykumu s-salām",
            "ahlan wa sahlan",
            "maʿa s-salāma",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "مَرْحَباً",
          question: "This word means:",
          choices: ["goodbye", "please", "hello (from root 'spacious')", "thank you"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'ahlan wa sahlan' literally means:",
          choices: [
            "peace and mercy",
            "family and ease",
            "please and thanks",
            "welcome to the home",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The extended response to a full 'as-salāmu ʿalaykum wa-raḥmatu-llāhi wa-barakātuh' begins with:",
          choices: [
            "marḥaban bik",
            "wa-ʿalaykumu s-salām wa-raḥmatu-llāhi wa-barakātuh",
            "ahlan wa sahlan",
            "maʿa s-salāma",
          ],
          correctIndex: 1,
          explain: "You mirror the greeting back — flipping 'upon you peace' and keeping every appended phrase.",
        },
        {
          kind: "mcq",
          question: "The literal meaning of السَّلام is:",
          choices: ["the friendship", "the peace", "the greeting", "the honor"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match greeting to its register",
          pairs: [
            { ar: "السَّلامُ عَلَيكُم", en: "formal / religious" },
            { ar: "مَرْحَباً", en: "neutral / polite" },
            { ar: "أَهلاً", en: "informal" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَرْحَباً.",
          expected: "marhaban",
          altAccepted: ["marḥaban", "marhaba"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of the response to 'as-salāmu ʿalaykum'.",
          expected: "wa-alaykumu s-salam",
          altAccepted: [
            "wa-ʿalaykumu s-salām",
            "wa alaykumu assalam",
            "waalaykum salam",
            "waalaykumu salam",
          ],
        },
      ],
    },

    {
      id: "L4.2",
      levelId: "L4",
      order: 2,
      title: "Time-of-Day Greetings & Farewells",
      subtitle: "Good morning, good evening, goodbye",
      theme: "greetings",
      estimatedMinutes: 30,
      xp: 65,
      prerequisites: ["L4.1"],
      summary: "The poetic structure of Arabic time greetings and farewells.",
      wrapUp: "Arabic greetings are structurally poetic: 'morning of goodness' answered with 'morning of light'. This isn't decoration — it's the cultural norm.",
      activities: [
        {
          kind: "info",
          title: "Good morning / good evening",
          body:
            "صَباحُ الخَيْر (ṣabāḥ al-khayr) — literally 'morning of goodness'. Used from morning through midday.\n\n" +
            "Standard reply: صَباحُ النُّور (ṣabāḥ an-nūr) — 'morning of light'. The reply ONE-UPS the greeter's wish. This 'outdo the greeting' pattern is a hallmark of Arabic politeness.\n\n" +
            "Alternative replies:\n" +
            "  صَباحُ الوَرد (ṣabāḥ al-ward) — 'morning of roses'\n" +
            "  صَباحُ الفُلّ (ṣabāḥ al-full) — 'morning of jasmine'\n" +
            "(These are more used in Levantine / Egyptian dialects in everyday speech; they all communicate warmth.)\n\n" +
            "مَساءُ الخَيْر (masāʾ al-khayr) — 'evening of goodness'. Used from afternoon through night.\n\n" +
            "Standard reply: مَساءُ النُّور (masāʾ an-nūr) — 'evening of light'.\n\n" +
            "Note the grammar — both phrases are IDĀFA constructions (a noun+noun genitive chain, covered in Level 10): 'morning OF goodness'. The structure is identical to English 'Son of David' or 'Morning of Glory'.",
          showcase: [
            { ar: "صَباحُ الخَيْر", translit: "ṣabāḥ al-khayr", en: "good morning" },
            { ar: "صَباحُ النُّور", translit: "ṣabāḥ an-nūr", en: "good morning (reply)" },
            { ar: "مَساءُ الخَيْر", translit: "masāʾ al-khayr", en: "good evening" },
            { ar: "مَساءُ النُّور", translit: "masāʾ an-nūr", en: "good evening (reply)" },
          ],
        },
        {
          kind: "info",
          title: "Good night / goodbye",
          body:
            "تُصبِح عَلى خَير (tuṣbiḥ ʿalā khayr) — 'may you wake to goodness' = good night (to a man).\n" +
            "تُصبِحين عَلى خَير (tuṣbiḥīn ʿalā khayr) — same, to a woman (note the feminine verb ending -īn).\n\n" +
            "Response: وَأَنتَ مِن أَهلِه (wa-anta min ahlih) — 'and you [are] among its [the goodness's] people'. In practice often shortened to وَأَنتَ مِن أَهلِه or just 'you too'.\n\n" +
            "FAREWELLS:\n" +
            "  مَعَ السَّلامَة (maʿa s-salāma) — 'with peace / safety' = goodbye. Wishes safe travel.\n" +
            "  إلى اللِّقاء (ilā l-liqāʾ) — 'until the meeting' = see you later.\n" +
            "  في أَمانِ الله (fī amāni-llāh) — 'in God's protection' = may God protect you (more religious register).\n\n" +
            "Response to maʿa s-salāma: اللّه مَعَك (allāh maʿak) — 'God be with you', or just مَعَ السَّلامَة echoed back.",
          showcase: [
            { ar: "تُصبِح عَلى خَير", translit: "tuṣbiḥ ʿalā khayr", en: "good night" },
            { ar: "مَعَ السَّلامَة", translit: "maʿa s-salāma", en: "goodbye" },
            { ar: "إلى اللِّقاء", translit: "ilā l-liqāʾ", en: "see you later" },
            { ar: "في أَمانِ الله", translit: "fī amāni-llāh", en: "may God protect you" },
          ],
        },
        {
          kind: "mcq",
          question: "Someone says ṣabāḥ al-khayr. The best reply is:",
          choices: [
            "masāʾ al-khayr",
            "ṣabāḥ an-nūr",
            "maʿa s-salāma",
            "shukran",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'maʿa s-salāma' literally means:",
          choices: [
            "'peace be upon you'",
            "'with peace / safety'",
            "'thank you for the peace'",
            "'until we meet again'",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which phrase means 'see you later'?",
          choices: [
            "maʿa s-salāma",
            "ilā l-liqāʾ",
            "ahlan wa sahlan",
            "ṣabāḥ an-nūr",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The reply pattern 'ṣabāḥ al-khayr' → 'ṣabāḥ an-nūr' exemplifies:",
          choices: [
            "Arabic grammatical case",
            "The custom of ONE-UPPING the greeter's blessing",
            "A regional Levantine quirk",
            "A religious formula",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match phrase to meaning",
          pairs: [
            { ar: "صَباحُ الخَيْر", en: "good morning" },
            { ar: "مَساءُ الخَيْر", en: "good evening" },
            { ar: "مَعَ السَّلامَة", en: "goodbye" },
            { ar: "إلى اللِّقاء", en: "see you later" },
            { ar: "تُصبِح عَلى خَير", en: "good night" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of 'good morning' (using 'khayr' not 'al-khayr').",
          expected: "sabah al-khayr",
          altAccepted: ["ṣabāḥ al-khayr", "sabah al-kheir", "sabahal khayr"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of 'goodbye'.",
          expected: "maa as-salama",
          altAccepted: ["maʿa s-salāma", "maʿa as-salāma", "maa assalama", "ma'a al-salama"],
        },
        {
          kind: "fillblank",
          prompt: "The reply 'ṣabāḥ ____' ('morning of light') outdoes the greeting 'ṣabāḥ al-khayr' ('morning of goodness').",
          blank: "an-nūr",
          en: "an-nūr",
          choices: ["al-khayr", "an-nūr", "al-ward", "as-salām"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L4.3",
      levelId: "L4",
      order: 3,
      title: "How Are You? — with Gender Distinction",
      subtitle: "Anta vs anti; ḥāluk vs ḥāluki",
      theme: "greetings",
      estimatedMinutes: 35,
      xp: 75,
      prerequisites: ["L4.2"],
      summary: "Arabic marks gender in second-person address. 'How are you' has two forms.",
      wrapUp: "You've now met your first major gender-marking feature. It appears throughout the language — in verbs, in pronouns, in adjectives. Pay attention to every ـكَ vs ـكِ ending from here on.",
      activities: [
        {
          kind: "info",
          title: "Asking after someone's condition",
          body:
            "كَيفَ حالُك؟ (kayfa ḥāluk?) — 'how is your condition?' = how are you?\n\n" +
            "Structure:\n" +
            "  كَيفَ (kayfa) — 'how'\n" +
            "  حال (ḥāl) — 'condition / state'\n" +
            "  ـُك (-uk) — attached possessive 'your'\n\n" +
            "The -uk suffix has a gendered form — crucial to get right:\n\n" +
            "  كَيفَ حالُكَ؟ (kayfa ḥāluka?) — to a MAN (-ka with fatḥa)\n" +
            "  كَيفَ حالُكِ؟ (kayfa ḥāluki?) — to a WOMAN (-ki with kasra)\n\n" +
            "In casual speech, the final vowel is often dropped: 'kayfa ḥālak?' / 'kayfa ḥālik?'. In very formal contexts, the vowel is pronounced.\n\n" +
            "Alternatives you'll hear:\n" +
            "  كَيفَ حالُكُم؟ (kayfa ḥālukum?) — plural, or formal singular (like French 'vous')\n" +
            "  كَيفَ الحال؟ (kayfa l-ḥāl?) — neutral, no pronoun suffix — 'how's things'\n\n" +
            "In dialects:\n" +
            "  كِيفَك؟ (kīfak?) — Levantine\n" +
            "  إِزَّيَّك؟ (izzayyak?) — Egyptian\n" +
            "  شلُونَك؟ (shlōnak?) — Iraqi / Gulf\n" +
            "All MSA = kayfa ḥāluk.",
          showcase: [
            { ar: "كَيفَ حالُكَ؟", translit: "kayfa ḥāluka?", en: "how are you? (m)" },
            { ar: "كَيفَ حالُكِ؟", translit: "kayfa ḥāluki?", en: "how are you? (f)" },
            { ar: "كَيفَ حالُكُم؟", translit: "kayfa ḥālukum?", en: "how are you? (pl/formal)" },
          ],
        },
        {
          kind: "info",
          title: "Responses",
          body:
            "Standard responses, roughly from most to least religious register:\n\n" +
            "  الحَمدُ لله (al-ḥamdu lillāh) — 'praise be to God'.\n" +
            "    The DEFAULT answer. Functions as 'I'm fine', 'good', even 'I'm alive and well'. Used by Muslims and non-Muslims in Arabic-speaking societies — deeply culturally embedded, not exclusively religious.\n\n" +
            "  بِخَير، الحَمدُ لله (bi-khayr, al-ḥamdu lillāh) — 'well, praise God'. More explicit.\n\n" +
            "  تَمام (tamām) — 'complete / perfect' → 'great'. Neutral, very common.\n\n" +
            "  بِخَير (bi-khayr) — 'well'. Just the core word.\n\n" +
            "  ليس سَيِّئاً (laysa sayyiʾan) — 'not bad'. Honest, neutral.\n\n" +
            "Whatever the answer, the typical follow-up is TO RETURN the question: وَأَنْتَ / وَأَنْتِ (wa-anta / wa-anti) — 'and you?'\n\n" +
            "Note on al-ḥamdu lillāh: even a Christian Arab, when asked how they are, often answers with this. It's the linguistic default — not a religious statement in every context.",
          showcase: [
            { ar: "الحَمدُ لله", translit: "al-ḥamdu lillāh", en: "praise be to God / I'm fine" },
            { ar: "بِخَير", translit: "bi-khayr", en: "well" },
            { ar: "تَمام", translit: "tamām", en: "great" },
            { ar: "وَأَنْتَ؟", translit: "wa-anta?", en: "and you? (m)" },
            { ar: "وَأَنْتِ؟", translit: "wa-anti?", en: "and you? (f)" },
          ],
        },
        {
          kind: "info",
          title: "My name is… / What's your name?",
          body:
            "اِسم (ism) — 'name'.\n\n" +
            "Attached possessive endings (same as with ḥāl):\n" +
            "  اِسمي (ismī) — 'my name'\n" +
            "  اِسمُكَ (ismuka) — 'your name' (m)\n" +
            "  اِسمُكِ (ismuki) — 'your name' (f)\n" +
            "  اِسمُهُ (ismuhu) — 'his name'\n" +
            "  اِسمُها (ismuhā) — 'her name'\n\n" +
            "Question: ما اسْمُكَ؟ / ما اسْمُكِ؟ (mā smuka? / mā smuki?) — 'what is your name?'\n" +
            "  (In full: ما اسْمُكَ = mā ism-u-ka. The 'i' drops in fluent speech.)\n\n" +
            "Statement: اِسمي حَنيف (ismī Ḥanīf) — 'my name is Hanif'.\n\n" +
            "Nice to meet you: تَشَرَّفنا (tasharrafnā) — literally 'we have been honored'. The Arabic idiom uses 'we' (the plural of modesty / formality). Another common option: فُرصة سَعيدة (furṣa saʿīda) — 'happy occasion'.",
          showcase: [
            { ar: "اِسمي حَنيف", translit: "ismī Ḥanīf", en: "my name is Hanif" },
            { ar: "ما اسْمُكَ؟", translit: "mā smuka?", en: "what's your name? (m)" },
            { ar: "ما اسْمُكِ؟", translit: "mā smuki?", en: "what's your name? (f)" },
            { ar: "تَشَرَّفنا", translit: "tasharrafnā", en: "pleased to meet you" },
            { ar: "فُرصة سَعيدة", translit: "furṣa saʿīda", en: "happy occasion / nice to meet you" },
          ],
        },
        {
          kind: "mcq",
          question: "Which is correct when asking a WOMAN how she is?",
          choices: [
            "kayfa ḥāluka?",
            "kayfa ḥāluki?",
            "kayfa ḥāluhu?",
            "kayfa ḥālī?",
          ],
          correctIndex: 1,
          explain: "-ki (kasra) is the feminine second-person possessive. Masculine is -ka (fatḥa).",
        },
        {
          kind: "mcq",
          question: "'al-ḥamdu lillāh' literally means:",
          choices: [
            "God is great",
            "Praise be to God",
            "God willing",
            "In the name of God",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In Arabic, the idiom for 'nice to meet you' uses which pronoun?",
          choices: [
            "'I' — tasharrafṭu",
            "'We' — tasharrafnā ('we have been honored')",
            "'You' — tasharrafta",
            "'They' — tasharrafū",
          ],
          correctIndex: 1,
          explain: "Arabic uses 'we' for modesty/plural-of-majesty in many formal expressions. The speaker doesn't elevate themselves by claiming individual honor.",
        },
        {
          kind: "mcq",
          question: "To say 'his name is Hanif':",
          choices: [
            "ismī Ḥanīf",
            "ismuka Ḥanīf",
            "ismuhu Ḥanīf",
            "ismuhā Ḥanīf",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "When greeting a WOMAN, use: kayfa ḥāl____?",
          blank: "ki",
          en: "-ki (feminine 2nd-person possessive)",
          choices: ["ka", "ki", "hu", "hā"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "To say 'my name is…', use ____ + your name.",
          blank: "ismī",
          en: "ismī",
          choices: ["ismuka", "ismī", "ismuhu", "ismuhā"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match the Arabic phrase to its English meaning",
          pairs: [
            { ar: "كَيفَ حالُك؟", en: "how are you?" },
            { ar: "الحَمدُ لله", en: "praise God / I'm fine" },
            { ar: "وَأَنْتَ؟", en: "and you? (m)" },
            { ar: "اِسمي حَنيف", en: "my name is Hanif" },
            { ar: "تَشَرَّفنا", en: "nice to meet you" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'My name is Hanif' in transliteration.",
          expected: "ismi hanif",
          altAccepted: ["ismī ḥanīf", "ismi Hanif", "ismī Hanif"],
        },
        {
          kind: "typing",
          prompt: "Type 'How are you?' to a man (transliteration).",
          expected: "kayfa haluk",
          altAccepted: ["kayfa ḥāluk", "kayfa haluka", "kayfa ḥāluka"],
        },
      ],
    },

    {
      id: "L4.4",
      levelId: "L4",
      order: 4,
      title: "Where Are You From?",
      subtitle: "Nationalities, countries, and the nisba suffix",
      theme: "greetings",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L4.3"],
      summary: "Origin questions, country names, and the ـِيّ ending that makes an adjective from a country.",
      wrapUp: "You've met the nisba ending (ـِيّ / ـِيّة). It's the single most productive way Arabic forms adjectives of origin — we'll use it constantly.",
      activities: [
        {
          kind: "info",
          title: "The question",
          body:
            "مِنْ أَيْنَ أَنْتَ؟ (min ayna anta?) — 'from where [are] you?' (to a man)\n" +
            "مِنْ أَيْنَ أَنْتِ؟ (min ayna anti?) — (to a woman)\n\n" +
            "Structure:\n" +
            "  مِنْ (min) — 'from'\n" +
            "  أَيْنَ (ayna) — 'where'\n" +
            "  أَنْتَ/أَنْتِ — 'you' (m/f)\n\n" +
            "Word order: in Arabic, questions with 'where', 'who', 'what' usually put the question word FIRST. No 'do' or 'did' auxiliary — the interrogative is built in.\n\n" +
            "Reply template:\n" +
            "  أَنا مِن + [country] (anā min + [country])\n" +
            "  أَنا مِن أَمريكا (anā min Amrīkā) — I am from America.\n" +
            "  أَنا مِن كَنَدا (anā min Kanadā) — I am from Canada.",
        },
        {
          kind: "info",
          title: "Country names — transliterated and native",
          body:
            "Transliterated names (adopted from European):\n" +
            "  أَمريكا (Amrīkā) — America\n" +
            "  كَنَدا (Kanadā) — Canada\n" +
            "  إنجِلترا (Ingiltirā) — England\n" +
            "  فَرَنسا (Faransā) — France\n" +
            "  أَلمانيا (Almānyā) — Germany\n" +
            "  إيطاليا (Īṭāliyā) — Italy\n" +
            "  الصِّين (aṣ-Ṣīn) — China\n" +
            "  اليابان (al-Yābān) — Japan\n\n" +
            "Native Arabic names:\n" +
            "  مِصر (Miṣr) — Egypt\n" +
            "  السُّعودِيَّة (as-Suʿūdiyya) — Saudi Arabia\n" +
            "  الإِمارات (al-Imārāt) — the Emirates (UAE)\n" +
            "  لُبنان (Lubnān) — Lebanon\n" +
            "  سوريا (Sūriyā) — Syria\n" +
            "  الأُردُن (al-Urdunn) — Jordan\n" +
            "  العِراق (al-ʿIrāq) — Iraq\n" +
            "  فِلَسطين (Filasṭīn) — Palestine\n" +
            "  المَغرِب (al-Maghrib) — Morocco (literally 'the West')\n" +
            "  الجَزائِر (al-Jazāʾir) — Algeria (literally 'the islands')\n" +
            "  اليَمَن (al-Yaman) — Yemen\n\n" +
            "Some country names carry the definite article by convention (al-Yaman, aṣ-Ṣīn, al-ʿIrāq, al-Maghrib). Some don't (Miṣr, Lubnān). There's no clean rule — you learn them individually.",
          showcase: [
            { ar: "أَنا مِن أَمريكا", translit: "anā min Amrīkā", en: "I am from America" },
            { ar: "أَنا مِن مِصر", translit: "anā min Miṣr", en: "I am from Egypt" },
            { ar: "أَنا مِن السُّعودِيَّة", translit: "anā min as-Suʿūdiyya", en: "I am from Saudi Arabia" },
            { ar: "أَنا مِن لُبنان", translit: "anā min Lubnān", en: "I am from Lebanon" },
            { ar: "أَنا مِن المَغرِب", translit: "anā min al-Maghrib", en: "I am from Morocco" },
          ],
        },
        {
          kind: "info",
          title: "The nisba — making nationality adjectives",
          body:
            "Arabic forms an ADJECTIVE OF ORIGIN by adding ـِيّ (-iyy, pronounced '-ī') for masculine, or ـِيَّة (-iyya) for feminine, to the country name.\n\n" +
            "  مِصر → مِصرِيّ (Miṣrī) / مِصرِيَّة (Miṣriyya) — Egyptian man / woman\n" +
            "  لُبنان → لُبنانِيّ (Lubnānī) / لُبنانِيَّة — Lebanese\n" +
            "  أَمريكا → أَمريكِيّ (Amrīkī) / أَمريكِيَّة — American\n" +
            "  العَرَب → عَرَبِيّ (ʿarabī) / عَرَبِيَّة — Arab / Arabic\n\n" +
            "This is called the NISBA ('attribution') suffix. It's one of Arabic's most productive suffixes — you can nisbify almost any noun to make it into a 'pertaining-to' adjective:\n\n" +
            "  كَنيسة (kanīsa, church) → كَنَسِيّ (kanasī, ecclesiastical)\n" +
            "  شَرق (sharq, east) → شَرقِيّ (sharqī, eastern)\n" +
            "  تاريخ (tārīkh, history) → تاريخِيّ (tārīkhī, historical)\n\n" +
            "Usage:\n" +
            "  أَنا أَمريكِيّ (anā amrīkī) — I am American (masculine speaker)\n" +
            "  أَنا أَمريكِيَّة (anā amrīkiyya) — I am American (feminine speaker)\n" +
            "  هو مِصرِيّ (huwa Miṣrī) — he is Egyptian\n" +
            "  هِيَ مِصرِيَّة (hiya Miṣriyya) — she is Egyptian",
          showcase: [
            { ar: "أَمريكِيّ", translit: "amrīkī", en: "American (m)" },
            { ar: "أَمريكِيَّة", translit: "amrīkiyya", en: "American (f)" },
            { ar: "مِصرِيّ", translit: "Miṣrī", en: "Egyptian (m)" },
            { ar: "عَرَبِيّ", translit: "ʿarabī", en: "Arab / Arabic" },
            { ar: "اللُّغة العَرَبِيَّة", translit: "al-lugha al-ʿarabiyya", en: "the Arabic language" },
          ],
        },
        {
          kind: "mcq",
          question: "'min ayna anta?' means:",
          choices: [
            "Who are you?",
            "Where are you going?",
            "Where are you from?",
            "How are you?",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "A man from Egypt introduces himself: 'anā ____'.",
          choices: ["Miṣr", "Miṣrī", "Miṣriyya", "Masr"],
          correctIndex: 1,
          explain: "Nisba suffix -ī for a masculine speaker: Miṣrī. A woman would say Miṣriyya.",
        },
        {
          kind: "mcq",
          question: "'al-lugha al-ʿarabiyya' means:",
          choices: [
            "the Arab people",
            "the Arabic language",
            "the land of Arabia",
            "the Middle East",
          ],
          correctIndex: 1,
          explain: "lugha = language; ʿarabiyya = Arabic (feminine nisba, because lugha is feminine).",
        },
        {
          kind: "mcq",
          question: "The nisba suffix ـِيَّة (-iyya) is used:",
          choices: [
            "Only for country adjectives",
            "To form a feminine 'pertaining to X' adjective from almost any noun",
            "To mark plural",
            "To turn adjectives into verbs",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match country to its Arabic name",
          pairs: [
            { ar: "مِصر", en: "Egypt" },
            { ar: "السُّعودِيَّة", en: "Saudi Arabia" },
            { ar: "لُبنان", en: "Lebanon" },
            { ar: "المَغرِب", en: "Morocco" },
            { ar: "الأُردُن", en: "Jordan" },
            { ar: "أَمريكا", en: "America" },
            { ar: "فَرَنسا", en: "France" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "أَنا ____ أَمريكا. (I am from America.)",
          blank: "min",
          en: "from",
          choices: ["min", "fī", "ilā", "maʿa"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "A man from Lebanon says: 'anā ____'.",
          blank: "Lubnānī",
          en: "Lebanese (m)",
          choices: ["Lubnān", "Lubnānī", "Lubnāniyya", "al-Lubnān"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'I am from Egypt' (transliteration).",
          expected: "ana min misr",
          altAccepted: ["anā min Miṣr", "ana min misr", "anā min misr"],
        },
      ],
    },

    {
      id: "L4.5",
      levelId: "L4",
      order: 5,
      title: "A Full Introduction Dialogue",
      subtitle: "Everything together in real conversation",
      theme: "greetings",
      estimatedMinutes: 30,
      xp: 95,
      prerequisites: ["L4.4"],
      summary: "A complete first-meeting conversation you can now read and understand.",
      wrapUp: "Level 4 complete. You've got a functional intro-conversation toolkit. Level 5 gives you the pronoun system so you can talk about people other than yourself.",
      activities: [
        {
          kind: "info",
          title: "Typical first-meeting arc",
          body:
            "An Arabic first-meeting conversation tends to follow this arc — often longer than the English equivalent:\n\n" +
            "  1. GREETING (often religious: as-salāmu ʿalaykum / wa-ʿalaykumu s-salām)\n" +
            "  2. TIME-OF-DAY greeting (ṣabāḥ al-khayr / ṣabāḥ an-nūr)\n" +
            "  3. HOW-ARE-YOU EXCHANGE (kayfa ḥāluk / al-ḥamdu lillāh / wa-anta?)\n" +
            "  4. NAME EXCHANGE (mā smuk / ismī…)\n" +
            "  5. ORIGIN EXCHANGE (min ayna / anā min…)\n" +
            "  6. PLEASED-TO-MEET (tasharrafnā / al-sharafu lī)\n" +
            "  7. CLOSING (maʿa s-salāma / fī amāni-llāh)\n\n" +
            "Skipping steps reads as cold. In most Arab-speaking cultures, this is social water — not wasted time.",
        },
        {
          kind: "dialogue",
          prompt: "Read carefully — you understand every word.",
          lines: [
            { speaker: "A", ar: "السَّلامُ عَلَيكُم", translit: "as-salāmu ʿalaykum", en: "Peace be upon you." },
            { speaker: "B", ar: "وَعَلَيكُمُ السَّلام وَرَحمَةُ الله", translit: "wa-ʿalaykumu s-salām wa-raḥmatu-llāh", en: "And upon you be peace, and God's mercy." },
            { speaker: "A", ar: "صَباحُ الخَير", translit: "ṣabāḥ al-khayr", en: "Good morning." },
            { speaker: "B", ar: "صَباحُ النُّور", translit: "ṣabāḥ an-nūr", en: "Good morning (lit. of light)." },
            { speaker: "A", ar: "كَيفَ حالُكَ؟", translit: "kayfa ḥāluka?", en: "How are you?" },
            { speaker: "B", ar: "بِخَير، الحَمدُ لله. وَأَنْتَ؟", translit: "bi-khayr, al-ḥamdu lillāh. wa-anta?", en: "Fine, praise God. And you?" },
            { speaker: "A", ar: "تَمام. ما اسْمُكَ؟", translit: "tamām. mā smuka?", en: "Great. What's your name?" },
            { speaker: "B", ar: "اِسمي حَنيف. وَأَنْتَ؟", translit: "ismī Ḥanīf. wa-anta?", en: "My name is Hanif. And you?" },
            { speaker: "A", ar: "اِسمي عَلي. مِنْ أَينَ أَنْتَ يا حَنيف؟", translit: "ismī ʿAlī. min ayna anta yā Ḥanīf?", en: "My name is Ali. Where are you from, Hanif?" },
            { speaker: "B", ar: "أَنا أَمريكِيّ. وَأَنْتَ؟", translit: "anā amrīkī. wa-anta?", en: "I am American. And you?" },
            { speaker: "A", ar: "أَنا مِن مِصر. تَشَرَّفنا!", translit: "anā min Miṣr. tasharrafnā!", en: "I'm from Egypt. Pleased to meet you!" },
            { speaker: "B", ar: "الشَّرَفُ لي. إِلى اللِّقاء.", translit: "ash-sharafu lī. ilā l-liqāʾ.", en: "The honor is mine. See you later." },
            { speaker: "A", ar: "مَعَ السَّلامَة.", translit: "maʿa s-salāma.", en: "Goodbye." },
          ],
          question: "What is person A's name, and where is he from?",
          choices: [
            "Hanif, from America",
            "Ali, from Egypt",
            "Ali, from Lebanon",
            "Hanif, from Egypt",
          ],
          correctIndex: 1,
        },
        {
          kind: "info",
          title: "Vocative يا — addressing someone directly",
          body:
            "يا (yā) — the vocative particle. Placed BEFORE a name or title to address someone directly.\n\n" +
            "  يا حَنيف — 'O Hanif' / 'Hanif,'\n" +
            "  يا أَحمَد — 'Ahmad,'\n" +
            "  يا أُستاذ — 'Professor,' / 'Sir,'\n" +
            "  يا أُمّي — 'Mother,'\n\n" +
            "In English 'O Hanif' sounds archaic; in Arabic يا is perfectly normal in both writing and speech. Skipping it can sound abrupt. When calling someone's attention in a crowd, shout يا + name.\n\n" +
            "In traditional Arabic poetry and the Qurʾān, يا introduces direct address to Allāh, to the beloved, to the wind. It's ordinary linguistic equipment with deep literary history.",
        },
        {
          kind: "mcq",
          question: "In the dialogue, person A greets with 'as-salāmu ʿalaykum'. Person B's reply includes an extension. Which one?",
          choices: [
            "'wa-barakātuh' — and his blessings",
            "'wa-raḥmatu-llāh' — and God's mercy",
            "'wa-jamīl' — and a beautiful day",
            "No extension",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which phrase in the dialogue means 'the honor is mine'?",
          choices: [
            "maʿa s-salāma",
            "tasharrafnā",
            "ash-sharafu lī",
            "ismī ʿAlī",
          ],
          correctIndex: 2,
          explain: "ash-sharafu lī — 'the honor [is] for me / mine'. A standard reply to tasharrafnā.",
        },
        {
          kind: "mcq",
          question: "يا (yā) before a name functions as:",
          choices: [
            "An interjection of surprise",
            "A vocative — 'O [name]' / direct address marker",
            "A polite 'please'",
            "A diminutive",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "From the dialogue, Hanif says 'anā amrīkī'. If a FEMALE from America were introducing herself, she'd say:",
          choices: [
            "anā amrīkī",
            "anā amrīka",
            "anā amrīkiyya",
            "anā min amrīkī",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "To call out to Hanif — 'Hey, Hanif!' — you'd say: ____ Ḥanīf!",
          blank: "yā",
          en: "yā (vocative)",
          choices: ["yā", "bi", "ilā", "min"],
          correctIndex: 0,
        },
        {
          kind: "typing",
          prompt: "Type the phrase 'my name is ʿAlī' (ismī ʿAlī) — transliteration.",
          expected: "ismi ali",
          altAccepted: ["ismī ʿAlī", "ismi 'Ali", "ismī Alī"],
        },
        {
          kind: "typing",
          prompt: "Type the phrase 'pleased to meet you' — tasharrafnā.",
          expected: "tasharrafna",
          altAccepted: ["tasharrafnā", "tasharafna"],
        },
      ],
    },
  ],
};
