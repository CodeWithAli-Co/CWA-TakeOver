// ============================================================================
// LEVEL 7 — Family, possessives, and description
//
// Depth focus: full family vocabulary, the attached-pronoun system on nouns,
// the IDĀFA construction, and adjective agreement (gender + number + def.).
// ============================================================================

import type { Level } from "../types";

export const level7: Level = {
  id: "L7",
  order: 7,
  title: "Family, Possessives & Description",
  subtitle: "Talk about people in your life",
  theme: "family",
  goal: "Name family members, attach possessive suffixes to nouns, describe people with adjectives that agree properly, and form simple idāfa constructions.",
  lessons: [
    {
      id: "L7.1",
      levelId: "L7",
      order: 1,
      title: "Immediate Family & Gender Pairs",
      subtitle: "Every role has a masculine and feminine form",
      theme: "family",
      estimatedMinutes: 35,
      xp: 80,
      prerequisites: ["L6.6"],
      summary: "Arabic family vocabulary is paired: father/mother, son/daughter, brother/sister, husband/wife.",
      wrapUp: "Family words form a closed system you'll use daily. Note how some pairs share a root (walad/bint share nothing; akh/ukht share none either) while others do (zawj/zawja do).",
      activities: [
        {
          kind: "info",
          title: "Parents, children, siblings",
          body:
            "  أَب (ab) — father\n" +
            "  أُمّ (umm) — mother\n" +
            "  اِبن (ibn) — son\n" +
            "  بِنت (bint) / اِبنة (ibna) — daughter\n" +
            "  أَخ (akh) — brother\n" +
            "  أُخت (ukht) — sister\n\n" +
            "A few grammatical notes:\n\n" +
            "  • أَب (father) has an unusual possessive form. 'My father' isn't 'ab-ī' but أَبي (abī) — the short a drops and lengthens. Same with أَخ → أَخي (akhī, my brother).\n" +
            "  • بِنت (bint) means both 'girl' and 'daughter'. Context distinguishes.\n" +
            "  • اِبن (ibn) — when preceded by another name, the alif drops in writing: e.g., 'Hassan son of Ali' = حَسَن بن عَلي (Ḥasan bin ʿAlī). The 'bin/ibn' is the Arabic equivalent of Hebrew 'ben'.\n\n" +
            "In Arabic genealogical speech, strings of 'bin' / 'ibn' are common: 'Muhammad ibn Abdullah ibn Abd al-Muṭṭalib…' means 'M. son of A. son of A.-M.…'.",
          showcase: [
            { ar: "أَب", translit: "ab", en: "father" },
            { ar: "أُمّ", translit: "umm", en: "mother" },
            { ar: "اِبن", translit: "ibn", en: "son" },
            { ar: "بِنت", translit: "bint", en: "daughter / girl" },
            { ar: "أَخ", translit: "akh", en: "brother" },
            { ar: "أُخت", translit: "ukht", en: "sister" },
          ],
        },
        {
          kind: "info",
          title: "Marriage & spouse",
          body:
            "  زَوج (zawj) — husband\n" +
            "  زَوجة (zawja) — wife\n" +
            "  عَروس (ʿarūs) — bride\n" +
            "  عَريس (ʿarīs) — groom\n" +
            "  زَواج (zawāj) — marriage\n" +
            "  طَلاق (ṭalāq) — divorce\n\n" +
            "Note zawj / zawja — same root (z-w-j, 'pair'), masculine / feminine forms. The same root gives:\n" +
            "  زَوج (zawj) — pair\n" +
            "  مُتَزَوِّج (mutazawwij) — married (m)\n" +
            "  مُتَزَوِّجة (mutazawwija) — married (f)\n\n" +
            "Arabic distinguishes married state lexically:\n" +
            "  أَعزَب (aʿzab) — unmarried / single (m)\n" +
            "  عَزباء (ʿazbāʾ) — unmarried / single (f)",
        },
        {
          kind: "info",
          title: "Extended family",
          body:
            "Uncles / aunts (Arabic distinguishes PATERNAL from MATERNAL):\n\n" +
            "  عَمّ (ʿamm) — paternal uncle (father's brother)\n" +
            "  عَمّة (ʿamma) — paternal aunt\n" +
            "  خال (khāl) — maternal uncle (mother's brother)\n" +
            "  خالة (khāla) — maternal aunt\n\n" +
            "Cousins:\n" +
            "  اِبن العَمّ (ibn al-ʿamm) — paternal uncle's son\n" +
            "  بِنت العَمّ (bint al-ʿamm) — paternal uncle's daughter\n" +
            "  اِبن الخال (ibn al-khāl) — maternal uncle's son\n" +
            "  … and so on for aunts.\n\n" +
            "This is more specific than English. There's no generic 'cousin' — you have to specify which side of the family and which sex of parent's sibling. You will be asked.\n\n" +
            "Grandparents:\n" +
            "  جَدّ (jadd) — grandfather\n" +
            "  جَدّة (jadda) — grandmother\n\n" +
            "Grandchildren:\n" +
            "  حَفيد (ḥafīd) — grandson\n" +
            "  حَفيدة (ḥafīda) — granddaughter",
          showcase: [
            { ar: "عَمّ", translit: "ʿamm", en: "paternal uncle" },
            { ar: "خال", translit: "khāl", en: "maternal uncle" },
            { ar: "جَدّ", translit: "jadd", en: "grandfather" },
            { ar: "جَدّة", translit: "jadda", en: "grandmother" },
            { ar: "حَفيد", translit: "ḥafīd", en: "grandson" },
          ],
        },
        {
          kind: "mcq",
          question: "'akh' means:",
          choices: ["father", "brother", "son", "friend"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'umm' means:",
          choices: ["mother", "aunt", "sister", "daughter"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "Arabic distinguishes which family relationship that English doesn't?",
          choices: [
            "Son vs daughter",
            "Paternal uncle vs maternal uncle",
            "Husband vs wife",
            "Grandfather vs grandmother",
          ],
          correctIndex: 1,
          explain: "Arabic has ʿamm (paternal uncle) vs khāl (maternal uncle) — two different words for what English lumps as 'uncle'.",
        },
        {
          kind: "mcq",
          question: "Your father's sister is your:",
          choices: ["ʿamm", "ʿamma", "khāl", "khāla"],
          correctIndex: 1,
          explain: "ʿamma = paternal aunt. khāla = maternal aunt.",
        },
        {
          kind: "mcq",
          question: "'aʿzab' means:",
          choices: ["married (m)", "single / unmarried (m)", "widowed (m)", "engaged (m)"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match family word to meaning",
          pairs: [
            { ar: "أَب", en: "father" },
            { ar: "أُمّ", en: "mother" },
            { ar: "أَخ", en: "brother" },
            { ar: "أُخت", en: "sister" },
            { ar: "اِبن", en: "son" },
            { ar: "بِنت", en: "daughter / girl" },
            { ar: "زَوج", en: "husband" },
            { ar: "زَوجة", en: "wife" },
            { ar: "جَدّ", en: "grandfather" },
            { ar: "عَمّ", en: "paternal uncle" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'mother' (transliteration).",
          expected: "umm",
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'brother' (transliteration).",
          expected: "akh",
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'grandmother'.",
          expected: "jadda",
        },
      ],
    },

    {
      id: "L7.2",
      levelId: "L7",
      order: 2,
      title: "Attached Possessive Pronouns",
      subtitle: "Glue a pronoun onto a noun — 'my', 'your', 'his', 'her'",
      theme: "grammar",
      estimatedMinutes: 40,
      xp: 90,
      prerequisites: ["L7.1"],
      summary: "Arabic has no separate word for 'my'. The pronoun attaches directly to the noun.",
      wrapUp: "Attached pronouns are one of the most productive features of Arabic. Every noun, every verb, every preposition can take them. This lesson is foundation.",
      activities: [
        {
          kind: "info",
          title: "The suffix system — nouns",
          body:
            "Instead of English 'my book', Arabic attaches the possessor as a SUFFIX to the noun:\n\n" +
            "                     Suffix     Example (kitāb, book)\n" +
            "  my                  ـي         كِتابي (kitābī) — my book\n" +
            "  your (m)             ـكَ        كِتابُكَ (kitābuka) — your book (m)\n" +
            "  your (f)             ـكِ        كِتابُكِ (kitābuki) — your book (f)\n" +
            "  his                  ـهُ        كِتابُهُ (kitābuhu) — his book\n" +
            "  her                  ـها        كِتابُها (kitābuhā) — her book\n" +
            "  our                  ـنا        كِتابُنا (kitābunā) — our book\n" +
            "  your (pl m)          ـكُم       كِتابُكُم (kitābukum) — your book (pl m)\n" +
            "  your (pl f)          ـكُنَّ       كِتابُكُنَّ (kitābukunna) — your book (pl f)\n" +
            "  their (m)            ـهُم       كِتابُهُم (kitābuhum) — their book (m)\n" +
            "  their (f)            ـهُنَّ       كِتابُهُنَّ (kitābuhunna) — their book (f)\n" +
            "  your (dual)          ـكُما      كِتابُكُما (kitābukumā) — your two books (dual)\n" +
            "  their (dual)         ـهُما      كِتابُهُما (kitābuhumā) — their two books\n\n" +
            "Rules of use:\n" +
            "  • Attached to the END of the noun.\n" +
            "  • The noun's last vowel is typically short (default ḍamma -u in isolation) unless grammar demands otherwise.\n" +
            "  • In speech, the trailing short vowels are often dropped: 'kitābak' for 'kitābuka' is perfectly natural.\n\n" +
            "Note that in all the examples above, the noun has NO definite article ('al-'). The possessive suffix itself makes the noun DEFINITE. You can't say 'my the-book' — kitābī IS already 'my book' = 'the book that belongs to me'.",
          showcase: [
            { ar: "كِتابي", translit: "kitābī", en: "my book" },
            { ar: "كِتابُكَ", translit: "kitābuka", en: "your book (m)" },
            { ar: "كِتابُها", translit: "kitābuhā", en: "her book" },
            { ar: "كِتابُنا", translit: "kitābunā", en: "our book" },
          ],
        },
        {
          kind: "info",
          title: "Family words with suffixes",
          body:
            "Special forms for 'father' and 'brother' — they become أَبو / أَخو when followed by a possessive suffix (EXCEPT for 'my', where they become أَبي / أَخي):\n\n" +
            "  أَبي (abī) — my father\n" +
            "  أَبوكَ (abūka) — your father (m)\n" +
            "  أَبوها (abūhā) — her father\n" +
            "  أَخي (akhī) — my brother\n" +
            "  أَخوها (akhūhā) — her brother\n\n" +
            "Everything else follows the regular pattern:\n\n" +
            "  أُمّي (ummī) — my mother\n" +
            "  أُمُّكَ (ummuka) — your mother (m)\n" +
            "  أُمُّهُ (ummuhu) — his mother\n" +
            "  اِبني (ibnī) — my son\n" +
            "  اِبنُهُ (ibnuhu) — his son\n" +
            "  بِنتي (bintī) — my daughter\n" +
            "  بِنتُها (bintuhā) — her daughter\n\n" +
            "Feminine nouns ending in ة drop the ة and become 'ت' before a suffix (the original 't' resurfaces):\n\n" +
            "  زَوجة (zawja) + ī → زَوجَتي (zawjatī) — my wife\n" +
            "  أُستاذة (ustādha) + hā → أُستاذَتُها (ustādhatuhā) — her female professor\n" +
            "  مَدينة (madīna) + unā → مَدينَتُنا (madīnatunā) — our city\n\n" +
            "This is why ة is called 'tāʾ marbūṭa' ('tied tāʾ') — it's a t that's BOUND silently at the end but UNTIES when something connects.",
          showcase: [
            { ar: "أَبي", translit: "abī", en: "my father" },
            { ar: "أُمّي", translit: "ummī", en: "my mother" },
            { ar: "أَخي", translit: "akhī", en: "my brother" },
            { ar: "أُختي", translit: "ukhtī", en: "my sister" },
            { ar: "زَوجَتي", translit: "zawjatī", en: "my wife" },
            { ar: "اِبنُهُ", translit: "ibnuhu", en: "his son" },
          ],
        },
        {
          kind: "info",
          title: "Attached possessives on prepositions",
          body:
            "The same suffixes attach to PREPOSITIONS too. Critical because many verbs take prepositions:\n\n" +
            "  مَعَ (maʿa, with) → مَعي (maʿī, with me) / مَعَكَ (maʿaka, with you m)\n" +
            "  عِند (ʿind, 'at / with / have') → عِندي (ʿindī, I have) / عِندَها (ʿindahā, she has)\n" +
            "  ل (li, 'for / to') → لي (lī, for me) / لَكَ (laka, for you m)\n" +
            "  مِن (min, from) → مِنّي (minnī, from me) / مِنكَ (minka, from you m)\n\n" +
            "Important idiomatic structure: Arabic has NO 'to have' verb. 'I have a book' is expressed with عِندي كِتاب (ʿindī kitāb, 'at-me a book').\n\n" +
            "  عِندي أَخ — I have a brother\n" +
            "  عِندَها سَيّارة — she has a car\n" +
            "  عِندَهُم كَلب — they have a dog\n\n" +
            "Also لَدَيَّ (ladayya, 'with me / I have') — more formal. And لي (lī, 'for me / I have') for abstract possession.",
          showcase: [
            { ar: "عِندي أَخ", translit: "ʿindī akh", en: "I have a brother" },
            { ar: "عِندَها سَيّارة", translit: "ʿindahā sayyāra", en: "she has a car" },
            { ar: "مَعي كِتاب", translit: "maʿī kitāb", en: "I have a book (with me)" },
            { ar: "لي صَديق", translit: "lī ṣadīq", en: "I have a friend" },
          ],
        },
        {
          kind: "mcq",
          question: "'kitābī' means:",
          choices: ["your book", "his book", "my book", "her book"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To say 'her son', attach which suffix to ibn?",
          choices: ["ī", "ka", "hu", "hā"],
          correctIndex: 3,
          explain: "ـها (-hā) = her. So ibnuhā = her son.",
        },
        {
          kind: "mcq",
          question: "'my father' in Arabic is:",
          choices: ["abī", "ab-ī", "abuhu", "abiya"],
          correctIndex: 0,
          explain: "أَبي — special irregular possessive form.",
        },
        {
          kind: "mcq",
          question: "'her wife' doesn't make sense in Arabic, but: 'my wife' is:",
          choices: ["zawjī", "zawjatī", "zawjī ṭālib", "zawjatuhu"],
          correctIndex: 1,
          explain: "The ة in zawja resurfaces as ت when a suffix is attached: zawjatī.",
        },
        {
          kind: "mcq",
          question: "Arabic expresses 'I have a brother' by saying:",
          choices: [
            "anā ibn akh",
            "anā ʿindī akh",
            "ʿindī akh",
            "akhī ʿindī",
          ],
          correctIndex: 2,
          explain: "Arabic has no 'to have' verb. ʿindī akh literally = 'at-me a brother' = 'I have a brother'.",
        },
        {
          kind: "mcq",
          question: "'She has a car' in Arabic:",
          choices: [
            "hiya ʿindī sayyāra",
            "ʿindī sayyāra",
            "ʿindahā sayyāra",
            "lahā sayyārat",
          ],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "اِسمُ ____ حَنيف. (His name is Hanif.)",
          blank: "hu",
          en: "his",
          choices: ["ī", "ka", "hu", "hā"],
          correctIndex: 2,
        },
        {
          kind: "fillblank",
          prompt: "____ كَبيرة. (Our city is big — madīna is feminine.)",
          blank: "مَدينَتُنا (madīnatunā)",
          en: "madīnatunā",
          choices: [
            "مَدينةُنا (madīnatunā — wrong form)",
            "مَدينَتُنا (madīnatunā)",
            "مَدينٌنا (madīnunnā)",
            "مَدينة نا",
          ],
          correctIndex: 1,
          explain: "ة turns into ت before a suffix → madīnatunā.",
        },
        {
          kind: "match",
          prompt: "Match Arabic phrase to English meaning",
          pairs: [
            { ar: "أَبي", en: "my father" },
            { ar: "أُمّي", en: "my mother" },
            { ar: "أَخي", en: "my brother" },
            { ar: "زَوجَتي", en: "my wife" },
            { ar: "عِندي أَخ", en: "I have a brother" },
            { ar: "عِندَها سَيّارة", en: "she has a car" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'my mother' (transliteration).",
          expected: "ummi",
          altAccepted: ["ummī"],
        },
        {
          kind: "typing",
          prompt: "Type 'I have a sister' (transliteration, using ʿind-).",
          expected: "indi ukht",
          altAccepted: ["ʿindī ukht", "indee ukht", "indi okht"],
        },
      ],
    },

    {
      id: "L7.3",
      levelId: "L7",
      order: 3,
      title: "Adjectives & Agreement",
      subtitle: "Describing people, places, things",
      theme: "family",
      estimatedMinutes: 40,
      xp: 90,
      prerequisites: ["L7.2"],
      summary: "Adjectives follow the noun and must agree in gender, number, AND definiteness.",
      wrapUp: "The 'triple agreement' rule (gender + number + definiteness) governs every adjective in Arabic. It's the single most impactful rule you'll drill.",
      activities: [
        {
          kind: "info",
          title: "Core descriptive adjectives",
          body:
            "  كَبير / كَبيرة (kabīr / kabīra) — big, old\n" +
            "  صَغير / صَغيرة (ṣaghīr / ṣaghīra) — small, young\n" +
            "  طَويل / طَويلة (ṭawīl / ṭawīla) — tall, long\n" +
            "  قَصير / قَصيرة (qaṣīr / qaṣīra) — short\n" +
            "  جَميل / جَميلة (jamīl / jamīla) — beautiful, handsome\n" +
            "  قَبيح / قَبيحة (qabīḥ / qabīḥa) — ugly\n" +
            "  طَيِّب / طَيِّبة (ṭayyib / ṭayyiba) — kind, good\n" +
            "  جَديد / جَديدة (jadīd / jadīda) — new\n" +
            "  قَديم / قَديمة (qadīm / qadīma) — old (of things)\n" +
            "  ذَكِيّ / ذَكِيَّة (dhakī / dhakiyya) — smart\n" +
            "  سَعيد / سَعيدة (saʿīd / saʿīda) — happy\n" +
            "  مَشغول / مَشغولة (mashghūl / mashghūla) — busy\n" +
            "  مُتعَب / مُتعَبة (mutʿab / mutʿaba) — tired\n" +
            "  غَنِيّ / غَنِيَّة (ghanī / ghaniyya) — rich\n" +
            "  فَقير / فَقيرة (faqīr / faqīra) — poor\n" +
            "  سَريع / سَريعة (sarīʿ / sarīʿa) — fast\n" +
            "  بَطيء / بَطيئة (baṭīʾ / baṭīʾa) — slow",
          showcase: [
            { ar: "كَبير", translit: "kabīr", en: "big (m)" },
            { ar: "صَغير", translit: "ṣaghīr", en: "small (m)" },
            { ar: "جَميل", translit: "jamīl", en: "beautiful (m)" },
            { ar: "ذَكِيّ", translit: "dhakī", en: "smart (m)" },
          ],
        },
        {
          kind: "info",
          title: "The triple agreement rule",
          body:
            "An adjective must agree with its noun in THREE dimensions:\n\n" +
            "  1. GENDER — m with m, f with f.\n" +
            "  2. NUMBER — singular with singular, dual with dual, plural with plural.\n" +
            "  3. DEFINITENESS — definite noun (with 'al-') takes a definite adjective too.\n\n" +
            "The adjective COMES AFTER the noun.\n\n" +
            "Examples:\n\n" +
            "  بَيت كَبير (bayt kabīr) — a big house\n" +
            "  البَيت الكَبير (al-bayt al-kabīr) — the big house\n" +
            "  مَدينة كَبيرة (madīna kabīra) — a big city (feminine agreement)\n" +
            "  المَدينة الكَبيرة (al-madīna al-kabīra) — the big city\n" +
            "  وَلَد ذَكِيّ (walad dhakī) — a smart boy\n" +
            "  بِنت ذَكِيَّة (bint dhakiyya) — a smart girl\n\n" +
            "Predicative position (in a nominal sentence like 'the house IS big'):\n" +
            "  البَيت كَبير (al-bayt kabīr) — the house [is] big\n" +
            "  Note: definite subject, INDEFINITE predicate. Adjective is in feminine (if needed) but NOT definite.\n\n" +
            "Contrast:\n" +
            "  البَيت الكَبير — 'the big house' (noun phrase, both definite)\n" +
            "  البَيت كَبير — 'the house IS big' (sentence, subject definite + predicate indefinite)\n\n" +
            "The DEFINITENESS difference turns a noun phrase into a sentence. This is the zero-copula rule you saw in L5, refined.",
        },
        {
          kind: "info",
          title: "Plural agreement for non-human nouns — the famous quirk",
          body:
            "When a PLURAL noun refers to non-human things (books, cars, ideas), the adjective takes the FEMININE SINGULAR form.\n\n" +
            "  كُتُب (kutub) — books (m plural by origin)\n" +
            "  كُتُب جَديدة (kutub jadīda) — new books (not 'jadīdūn'!)\n\n" +
            "  سَيّارات (sayyārāt) — cars (f plural)\n" +
            "  سَيّارات سَريعة (sayyārāt sarīʿa) — fast cars (already feminine-singular)\n\n" +
            "For HUMAN plurals, use the regular masculine or feminine plural adjective:\n\n" +
            "  مُدَرِّسون (mudarrisūn) — male teachers (regular m plural)\n" +
            "  مُدَرِّسون ذَكِيّون (mudarrisūn dhakiyyūn) — smart male teachers\n\n" +
            "  مُدَرِّسات (mudarrisāt) — female teachers\n" +
            "  مُدَرِّسات ذَكِيّات (mudarrisāt dhakiyyāt) — smart female teachers\n\n" +
            "Rule summary:\n" +
            "  • Human plural → plural adjective (m/f match)\n" +
            "  • Non-human plural → feminine singular adjective\n\n" +
            "This is one of those rules that seems arbitrary but is universal across classical and modern Arabic. Absorb it by exposure.",
          showcase: [
            { ar: "كُتُب جَديدة", translit: "kutub jadīda", en: "new books (non-human plural → f.sg. agreement)" },
            { ar: "سَيّارات سَريعة", translit: "sayyārāt sarīʿa", en: "fast cars" },
            { ar: "مُدَرِّسون ذَكِيّون", translit: "mudarrisūn dhakiyyūn", en: "smart male teachers (human pl.)" },
            { ar: "بُيوت كَبيرة", translit: "buyūt kabīra", en: "big houses (non-human plural)" },
          ],
        },
        {
          kind: "mcq",
          question: "'kabīra' is used to describe:",
          choices: ["a boy", "a girl", "two men", "three men (human pl)"],
          correctIndex: 1,
          explain: "The ة ending = feminine singular. Used for feminine-singular nouns like bint, madīna, etc.",
        },
        {
          kind: "mcq",
          question: "Which means 'the beautiful city'?",
          choices: [
            "madīna jamīla",
            "al-madīna jamīla",
            "al-madīna al-jamīla",
            "jamīla al-madīna",
          ],
          correctIndex: 2,
          explain: "Both noun and adjective must be definite. Adjective comes after noun. Both are feminine.",
        },
        {
          kind: "mcq",
          question: "Which means 'the city IS beautiful' (a sentence)?",
          choices: [
            "al-madīna al-jamīla",
            "al-madīna jamīla",
            "madīna al-jamīla",
            "madīna jamīla",
          ],
          correctIndex: 1,
          explain: "Definite subject + indefinite predicate = zero-copula sentence. Without 'al-' on the adjective, it's not describing 'the city' — it's PREDICATING 'is beautiful'.",
        },
        {
          kind: "mcq",
          question: "'new books' (kutub is non-human plural) is:",
          choices: [
            "kutub jadīd",
            "kutub jadīda",
            "kutub jadīdūn",
            "kutub jadīdāt",
          ],
          correctIndex: 1,
          explain: "Non-human plural → feminine singular agreement: jadīda.",
        },
        {
          kind: "mcq",
          question: "'smart male teachers' (human plural):",
          choices: [
            "mudarrisūn dhakī",
            "mudarrisūn dhakiyya",
            "mudarrisūn dhakiyyūn",
            "mudarrisāt dhakī",
          ],
          correctIndex: 2,
          explain: "Human plural → plural adjective. mudarrisūn (m.pl) + dhakiyyūn (m.pl).",
        },
        {
          kind: "fillblank",
          prompt: "بَيت ____. (a new house — bayt is masculine)",
          blank: "jadīd",
          en: "new (m)",
          choices: ["jadīd", "jadīda", "kabīr", "qadīm"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "سَيّارة ____. (a beautiful car — sayyāra is feminine)",
          blank: "jamīla",
          en: "beautiful (f)",
          choices: ["jamīl", "jamīla", "ṣaghīr", "ṭawīl"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match adjective pair to meaning",
          pairs: [
            { ar: "كَبير / كَبيرة", en: "big" },
            { ar: "صَغير / صَغيرة", en: "small" },
            { ar: "جَديد / جَديدة", en: "new" },
            { ar: "قَديم / قَديمة", en: "old" },
            { ar: "جَميل / جَميلة", en: "beautiful" },
            { ar: "سَريع / سَريعة", en: "fast" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'a tall boy' — walad ṭawīl (transliteration).",
          expected: "walad tawil",
          altAccepted: ["walad ṭawīl", "walad taweel"],
        },
        {
          kind: "typing",
          prompt: "Type 'a beautiful girl' — bint jamīla (transliteration).",
          expected: "bint jamila",
          altAccepted: ["bint jamīla", "bint jameela"],
        },
      ],
    },

    {
      id: "L7.4",
      levelId: "L7",
      order: 4,
      title: "Idāfa — Noun-Noun Constructions",
      subtitle: "How Arabic says 'the teacher's book' without any preposition",
      theme: "grammar",
      estimatedMinutes: 35,
      xp: 90,
      prerequisites: ["L7.3"],
      summary: "The idāfa chain — Arabic's fundamental way of linking two nouns into a possessive or descriptive relationship.",
      wrapUp: "Idāfa is 30%+ of Arabic noun phrases. You'll see it in every paragraph. 'Qurʾān reader' = qāriʾ al-Qurʾān. 'CIA director' = mudīr al-mukhābarāt. 'Morning of goodness' = ṣabāḥ al-khayr. All idāfa.",
      activities: [
        {
          kind: "info",
          title: "The structure",
          body:
            "IDĀFA (إِضافة, literally 'addition') is a CHAIN of two or more nouns in a genitive relationship. Typically:\n\n" +
            "  [noun A] + [noun B]\n" +
            "  meaning: 'A of B' / 'B's A'\n\n" +
            "Key rules:\n\n" +
            "  1. The FIRST noun (the 'possessed') DROPS its definite article 'al-' if any, AND drops any tanwīn. It's definite BY VIRTUE of being part of the idāfa — you don't mark it separately.\n\n" +
            "  2. The SECOND noun (the 'possessor') takes its usual form — usually DEFINITE (with 'al-'), though it can be indefinite if you mean 'a …of…'.\n\n" +
            "  3. Nothing comes BETWEEN the two nouns. No preposition. No adjective. The adjective comes AFTER the entire idāfa chain.\n\n" +
            "Examples:\n\n" +
            "  كِتابُ المُدَرِّس (kitāb al-mudarris) — the teacher's book\n" +
            "    كِتاب drops 'al-' even though 'the book' is the meaning.\n\n" +
            "  بابُ البَيت (bāb al-bayt) — the house's door / the door of the house\n\n" +
            "  سَيّارةُ الشُّرطة (sayyārat ash-shurṭa) — the police car\n" +
            "    sayyāra → sayyārat (ة becomes ت before the next word).\n\n" +
            "  اِبنُ عَمّ (ibn ʿamm) — a cousin (a son of a paternal uncle) — both indefinite\n" +
            "  اِبنُ العَمّ (ibn al-ʿamm) — the cousin (the son of the paternal uncle)\n\n" +
            "The first noun in an idāfa is in NOMINATIVE case when it's the subject (-u, or dropped -u), but in ACCUSATIVE or GENITIVE when required by context. This doesn't change the structure — just the vowel on the first noun.",
        },
        {
          kind: "info",
          title: "Chains of three or more",
          body:
            "You can chain more than two nouns:\n\n" +
            "  بابُ بَيتِ المُدَرِّس (bāb bayt al-mudarris) — the teacher's house's door = the door of the teacher's house\n\n" +
            "Reading direction: you unpack RIGHT-TO-LEFT.\n" +
            "  'door' of 'house' of 'the teacher'.\n\n" +
            "Another classic:\n" +
            "  رَئيسُ الوُزَراء (raʾīs al-wuzarāʾ) — the prime minister (lit. 'head of the ministers')\n" +
            "  مُدَرِّسُ اللُّغةِ العَرَبِيَّة (mudarris al-lugha al-ʿarabiyya) — the Arabic-language teacher\n\n" +
            "Idāfa in place names and titles:\n" +
            "  مَدينةُ نيويورك (madīnat nyū yūrk) — the city of New York\n" +
            "  جامِعة دِمَشق (jāmiʿat Dimashq) — the University of Damascus\n" +
            "  وَزيرُ الدَّفاع (wazīr ad-difāʿ) — Minister of Defense\n\n" +
            "When an adjective qualifies something in an idāfa, it goes at the VERY END and agrees with the noun it describes:\n\n" +
            "  كِتابُ المُدَرِّسِ الجَديد — 'the teacher's new book' OR 'the new teacher's book'\n" +
            "  The ambiguity is real. Context usually disambiguates. Agreement (gender, def.) can sometimes disambiguate too.",
          showcase: [
            { ar: "كِتابُ المُدَرِّس", translit: "kitāb al-mudarris", en: "the teacher's book" },
            { ar: "بابُ البَيت", translit: "bāb al-bayt", en: "the door of the house" },
            { ar: "سَيّارةُ الشُّرطة", translit: "sayyārat ash-shurṭa", en: "the police car" },
            { ar: "رَئيسُ الوُزَراء", translit: "raʾīs al-wuzarāʾ", en: "prime minister" },
            { ar: "جامِعة القاهِرة", translit: "jāmiʿat al-Qāhira", en: "Cairo University" },
          ],
        },
        {
          kind: "info",
          title: "Idāfa with attached possessive pronouns",
          body:
            "When the 'possessor' of an idāfa is a PRONOUN, use an attached possessive suffix (Level 7.2) instead of two separate nouns:\n\n" +
            "  • Two nouns: 'my father's book' → كِتابُ أَبي (kitāb abī)\n" +
            "  • Pronoun: 'my book' → كِتابي (kitābī)\n" +
            "  • Pronoun: 'his book' → كِتابُهُ (kitābuhu)\n\n" +
            "These attached-pronoun nouns ARE idāfa — the pronoun is the 'second noun' of the chain. That's why they also drop 'al-' and become automatically definite.\n\n" +
            "Stacked:\n" +
            "  اِسمُ أَبي (ism abī) — my father's name\n" +
            "  بَيتُ جَدّي (bayt jaddī) — my grandfather's house",
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
          choices: [
            "Takes 'al-' to mark definiteness",
            "Drops 'al-' (becomes definite by context)",
            "Must always be indefinite",
            "Disappears",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'The door of my house' in Arabic:",
          choices: [
            "bāb al-bayt",
            "bāb bayt",
            "bāb baytī",
            "al-bāb baytī",
          ],
          correctIndex: 2,
          explain: "Idāfa with attached-pronoun possessor: bāb (drops al-) + baytī (my house).",
        },
        {
          kind: "mcq",
          question: "Why is 'sayyārat ash-shurṭa' written with 'sayyārat' (ت) instead of 'sayyāra' (ة)?",
          choices: [
            "Spelling error",
            "ة always becomes ت before a suffix or in idāfa",
            "Regional variation",
            "Historical accident",
          ],
          correctIndex: 1,
          explain: "The tāʾ marbūṭa 'unties' — the silent ending t becomes pronounced ت because it's now in the MIDDLE of a phrase.",
        },
        {
          kind: "mcq",
          question: "'Cairo University' in Arabic uses:",
          choices: [
            "A preposition: jāmiʿa fī Qāhira",
            "An adjective: jāmiʿa Qāhira",
            "An idāfa: jāmiʿat al-Qāhira",
            "Two sentences",
          ],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match Arabic idāfa to English meaning",
          pairs: [
            { ar: "كِتابُ المُدَرِّس", en: "the teacher's book" },
            { ar: "بابُ البَيت", en: "the door of the house" },
            { ar: "سَيّارةُ الشُّرطة", en: "the police car" },
            { ar: "رَئيسُ الوُزَراء", en: "prime minister" },
            { ar: "جامِعة القاهِرة", en: "Cairo University" },
            { ar: "اِسمُ أَبي", en: "my father's name" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "To say 'the name of the city' in idāfa: ____ al-madīna.",
          blank: "ism",
          en: "ism (drops al-, stays definite by context)",
          choices: ["al-ism", "ism", "ismu", "smī"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'the teacher's book' (kitāb al-mudarris) — transliteration.",
          expected: "kitab al-mudarris",
          altAccepted: ["kitāb al-mudarris", "kitab almudarris", "kitab al mudarris"],
        },
      ],
    },

    {
      id: "L7.5",
      levelId: "L7",
      order: 5,
      title: "Dialogue + Comprehensive Review",
      subtitle: "A family conversation using everything from Level 7",
      theme: "review",
      estimatedMinutes: 35,
      xp: 120,
      prerequisites: ["L7.4"],
      summary: "A realistic conversation where you must use family vocabulary, possessive suffixes, and idāfa all together.",
      wrapUp: "Level 7 complete. You can now describe your family, possess things, and chain nouns. Level 8 adds verbs — and suddenly you can say 'I DO things' instead of only 'I AM things'.",
      activities: [
        {
          kind: "dialogue",
          prompt: "Two colleagues are getting to know each other. Read carefully.",
          lines: [
            { speaker: "A", ar: "هَل لَدَيكَ إِخوة، يا حَنيف؟", translit: "hal ladayka ikhwa, yā Ḥanīf?", en: "Do you have siblings, Hanif?" },
            { speaker: "B", ar: "نَعَم، لَدَيَّ أَخ صَغير وَأُختان.", translit: "naʿam, ladayya akh ṣaghīr wa-ukhtān.", en: "Yes, I have a little brother and two sisters." },
            { speaker: "A", ar: "ما اسْمُ أَخيكَ الصَّغير؟", translit: "mā smu akhīka aṣ-ṣaghīr?", en: "What's your little brother's name?" },
            { speaker: "B", ar: "اِسمُهُ عُمَر. عُمرُهُ سَبع سَنَوات.", translit: "ismuhu ʿUmar. ʿumruhu sabʿ sanawāt.", en: "His name is Omar. He's seven years old." },
            { speaker: "A", ar: "ما شاءَ الله! هَل هو طالِب؟", translit: "mā shāʾ Allāh! hal huwa ṭālib?", en: "How wonderful! Is he a student?" },
            { speaker: "B", ar: "نَعَم، في المَدرَسة الاِبتِدائِيَّة.", translit: "naʿam, fī l-madrasa l-ibtidāʾiyya.", en: "Yes, in elementary school." },
            { speaker: "A", ar: "وَأَخَواتُكَ؟", translit: "wa-akhawātuka?", en: "And your sisters?" },
            { speaker: "B", ar: "الكَبيرة مُدَرِّسة في جامِعة بوسطُن. وَالصَّغيرة في الثَّانَوِيَّة.", translit: "al-kabīra mudarrisa fī jāmiʿat Būsṭun. wa-ṣ-ṣaghīra fī th-thānawiyya.", en: "The older [one] is a teacher at Boston University. And the younger is in high school." },
            { speaker: "A", ar: "عائِلة رائِعة. بارَكَ اللَّهُ فيكَ.", translit: "ʿāʾila rāʾiʿa. bāraka-llāhu fīka.", en: "A wonderful family. May God bless you." },
          ],
          question: "How many siblings does Hanif have in total?",
          choices: ["2", "3", "4", "1"],
          correctIndex: 1,
          explain: "One little brother + two sisters = 3 siblings.",
        },
        {
          kind: "mcq",
          question: "In the dialogue, what does Hanif's older sister do?",
          choices: [
            "She's a student",
            "She's a teacher at Boston University",
            "She's a doctor",
            "She's in elementary school",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'jāmiʿat Būsṭun' is an example of:",
          choices: [
            "A pronoun chain",
            "An idāfa (noun-noun construction)",
            "An adjective phrase",
            "A relative clause",
          ],
          correctIndex: 1,
          explain: "Noun + noun without a preposition = idāfa. jāmiʿat (with ت from ة) + Būsṭun.",
        },
        {
          kind: "mcq",
          question: "'mā shāʾ Allāh' literally means:",
          choices: [
            "Praise be to God",
            "What God has willed",
            "God forbid",
            "In the name of God",
          ],
          correctIndex: 1,
          explain: "Said when admiring someone (to ward off the evil eye / jealousy). Literally 'what God has willed'.",
        },
        {
          kind: "mcq",
          question: "'bāraka-llāhu fīka' is:",
          choices: [
            "A blessing: 'may God bless you (m)'",
            "A curse",
            "A question",
            "A greeting",
          ],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'the younger sister' in the dialogue — how is it expressed?",
          choices: [
            "ṣaghīra al-ukht",
            "aṣ-ṣaghīra (implying 'the younger [one]' with ukht implied)",
            "ukht aṣ-ṣaghīra",
            "ukht ṣaghīrat",
          ],
          correctIndex: 1,
          explain: "Arabic commonly elides the noun when context makes it clear. 'The younger' = 'the younger one' = the younger sister.",
        },
        {
          kind: "mcq",
          question: "Hanif's little brother's age:",
          choices: ["5", "6", "7", "8"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "ʿumruhu literally means:",
          choices: [
            "His age is",
            "His time",
            "His year",
            "His umbrella",
          ],
          correctIndex: 0,
          explain: "ʿumr = lifespan/age. ʿumruhu = 'his age [is]'. Arabic uses this construction for ages: ʿumrī khamsa = 'I am five [years old]'.",
        },
        {
          kind: "match",
          prompt: "Match vocabulary (from the dialogue and level)",
          pairs: [
            { ar: "أَخ", en: "brother" },
            { ar: "أُخت", en: "sister" },
            { ar: "إِخوة", en: "siblings (pl)" },
            { ar: "ما شاءَ الله", en: "how wonderful" },
            { ar: "عائِلة", en: "family" },
            { ar: "مَدرَسة", en: "school" },
            { ar: "جامِعة", en: "university" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'my family' — ʿāʾilatī (transliteration).",
          expected: "ailati",
          altAccepted: ["ʿāʾilatī", "aailati", "'ailati", "aa'ilati"],
        },
        {
          kind: "typing",
          prompt: "Type 'I have a brother' (transliteration, using ʿind).",
          expected: "indi akh",
          altAccepted: ["ʿindī akh", "indee akh"],
        },
        {
          kind: "fillblank",
          prompt: "اِسمُ ____ عُمَر. (The name of MY brother is Omar.)",
          blank: "أَخي (akhī)",
          en: "my brother",
          choices: ["أَبي (abī)", "أَخي (akhī)", "اِبني (ibnī)", "جَدّي (jaddī)"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
