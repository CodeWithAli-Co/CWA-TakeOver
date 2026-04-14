// ============================================================================
// LEVEL 6 — Numbers, days, and time
//
// Depth focus: both digit systems (Hindi-Arabic and Western-Arabic), counted
// noun agreement (one of Arabic's trickier rules), calendar structure,
// and time expressions.
// ============================================================================

import type { Level } from "../types";

export const level6: Level = {
  id: "L6",
  order: 6,
  title: "Numbers, Calendar, and Time",
  subtitle: "Quantify, schedule, and orient",
  theme: "numbers",
  goal: "Count to 1000, use both Arabic digit systems, name the days of the week, and tell time.",
  lessons: [
    {
      id: "L6.1",
      levelId: "L6",
      order: 1,
      title: "Numbers 1–10 & the Two Digit Systems",
      subtitle: "And why the digits you call 'Arabic' aren't the ones Arabs use",
      theme: "numbers",
      estimatedMinutes: 35,
      xp: 75,
      prerequisites: ["L5.5"],
      summary: "The cardinal numbers — written in words and in the two Arabic digit systems.",
      wrapUp: "You can now count to ten in Arabic and read either digit system. Most modern Arab usage is mixed: Western digits on receipts and computers, Hindi-Arabic in traditional publishing and handwriting.",
      activities: [
        {
          kind: "info",
          title: "Two systems, one origin",
          body:
            "The digit system used in most of the world today (0, 1, 2, 3, …) is called ARABIC NUMERALS in English because Europe learned it from Arab mathematicians (primarily via al-Khwārizmī's 9th-century treatise, translated into Latin in the 12th century).\n\n" +
            "But Arabs don't actually use those shapes as their PRIMARY numerals. They use a related but different set called HINDI-ARABIC NUMERALS (also called 'Indian numerals' in Arabic, أَرقام هِندِيّة):\n\n" +
            "  ٠ — 0\n" +
            "  ١ — 1\n" +
            "  ٢ — 2\n" +
            "  ٣ — 3\n" +
            "  ٤ — 4\n" +
            "  ٥ — 5\n" +
            "  ٦ — 6\n" +
            "  ٧ — 7\n" +
            "  ٨ — 8\n" +
            "  ٩ — 9\n\n" +
            "Both systems came originally from India in the 6th century. One set spread west to Europe via North Africa (called 'Western Arabic digits' or 'Maghrebi' in scholarship — these became the modern 'Arabic numerals' globally). The other set spread east through the Middle East (Hindi-Arabic digits).\n\n" +
            "DIRECTION: numbers are written LEFT TO RIGHT even in Arabic text. If you see ١٢٣ in a sentence, it's 'one hundred twenty-three' — read LTR, from the 1.\n\n" +
            "Watch out for visual confusions:\n" +
            "  ٥ looks like Western '0'. It's FIVE.\n" +
            "  ٦ looks like Western '7'. It's SIX.\n" +
            "  ٧ looks like Western 'V'. It's SEVEN.\n" +
            "  ٠ is a dot. It's ZERO.",
        },
        {
          kind: "info",
          title: "1 through 10 — spoken form",
          body:
            "  ١  واحِد   (wāḥid) — 1    [masculine form]\n" +
            "  ٢  اِثنان  (ithnān) — 2\n" +
            "  ٣  ثَلاثة (thalātha) — 3\n" +
            "  ٤  أَربَعة (arbaʿa) — 4\n" +
            "  ٥  خَمسة (khamsa) — 5\n" +
            "  ٦  سِتّة (sitta) — 6\n" +
            "  ٧  سَبعة (sabʿa) — 7\n" +
            "  ٨  ثَمانية (thamāniya) — 8\n" +
            "  ٩  تِسعة (tisʿa) — 9\n" +
            "  ١٠ عَشَرة (ʿashara) — 10\n\n" +
            "Notes:\n" +
            "  • 'One' and 'two' have a MASCULINE and FEMININE form: wāḥid/wāḥida, ithnān/ithnatān. They agree with the noun they count.\n" +
            "  • 3-10 REVERSE gender: if the counted noun is masculine, the number takes a ة (feminine ending). If feminine, the number is unadorned. This is called 'polarity agreement' — it's a Semitic peculiarity. (Detailed examples in L6.3.)\n" +
            "  • Etymology to notice: arbaʿa (4) → rabʿ (quarter), ʿashara (10) → ʿashr (tenth). Arabic uses these constantly.",
          showcase: [
            { ar: "١", translit: "wāḥid", en: "1" },
            { ar: "٢", translit: "ithnān", en: "2" },
            { ar: "٣", translit: "thalātha", en: "3" },
            { ar: "٥", translit: "khamsa", en: "5" },
            { ar: "٧", translit: "sabʿa", en: "7" },
            { ar: "١٠", translit: "ʿashara", en: "10" },
          ],
        },
        {
          kind: "flashcard",
          prompt: "Drill — the ten digits in Hindi-Arabic form",
          cards: [
            { ar: "٠", translit: "ṣifr", en: "0" },
            { ar: "١", translit: "wāḥid", en: "1" },
            { ar: "٢", translit: "ithnān", en: "2" },
            { ar: "٣", translit: "thalātha", en: "3" },
            { ar: "٤", translit: "arbaʿa", en: "4" },
            { ar: "٥", translit: "khamsa", en: "5" },
            { ar: "٦", translit: "sitta", en: "6" },
            { ar: "٧", translit: "sabʿa", en: "7" },
            { ar: "٨", translit: "thamāniya", en: "8" },
            { ar: "٩", translit: "tisʿa", en: "9" },
            { ar: "١٠", translit: "ʿashara", en: "10" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "٥",
          question: "What number is this?",
          choices: ["3", "4", "5", "6"],
          correctIndex: 2,
          explain: "٥ is FIVE. Visually it looks like a Western 0 — don't confuse them.",
        },
        {
          kind: "mcq",
          arabicPrompt: "٨",
          question: "What number?",
          choices: ["6", "7", "8", "9"],
          correctIndex: 2,
          explain: "٨ = 8. Note it does NOT look like Western 8.",
        },
        {
          kind: "mcq",
          arabicPrompt: "٦",
          question: "What number?",
          choices: ["6", "7", "0", "9"],
          correctIndex: 0,
          explain: "٦ = 6 (despite looking like a Western 7).",
        },
        {
          kind: "mcq",
          arabicPrompt: "٧",
          question: "What number?",
          choices: ["6", "7", "8", "V"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabs typically refer to Western 0–9 digits as:",
          choices: [
            "Arabic numerals",
            "Indian numerals (أَرقام هِندِيّة)",
            "Western numerals (أَرقام غَربِيّة)",
            "European numerals",
          ],
          correctIndex: 2,
          explain: "In Arabic, the Western 0-9 are usually called 'أَرقام غَربِيّة' (Western digits), while the ٠-٩ set is called 'Indian digits' (their origin). 'Arabic numerals' is an English framing.",
        },
        {
          kind: "mcq",
          question: "Which Arabic number word is 'seven'?",
          choices: ["sitta", "sabʿa", "thamāniya", "tisʿa"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which Arabic number word is 'nine'?",
          choices: ["sabʿa", "thamāniya", "tisʿa", "ʿashara"],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match Arabic word to digit",
          pairs: [
            { ar: "واحِد", en: "1" },
            { ar: "ثَلاثة", en: "3" },
            { ar: "خَمسة", en: "5" },
            { ar: "سَبعة", en: "7" },
            { ar: "ثَمانية", en: "8" },
            { ar: "عَشَرة", en: "10" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for '2' (masculine form, transliteration).",
          expected: "ithnan",
          altAccepted: ["ithnān", "ithnaan", "ithneen"],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for '6' (transliteration).",
          expected: "sitta",
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for '0'.",
          expected: "sifr",
          altAccepted: ["ṣifr"],
        },
      ],
    },

    {
      id: "L6.2",
      levelId: "L6",
      order: 2,
      title: "Numbers 11–99",
      subtitle: "Teens, tens, and compound numbers",
      theme: "numbers",
      estimatedMinutes: 35,
      xp: 75,
      prerequisites: ["L6.1"],
      summary: "The patterns that build every two-digit number in Arabic.",
      wrapUp: "Two-digit numbers follow consistent patterns. Once you know the teens pattern and the 'ones + AND + tens' pattern, you can produce all of them.",
      activities: [
        {
          kind: "info",
          title: "11–19 — the teens",
          body:
            "  ١١ أَحَدَ عَشَر (aḥada ʿashar) — 11\n" +
            "  ١٢ اِثنا عَشَر (ithnā ʿashar) — 12\n" +
            "  ١٣ ثَلاثةَ عَشَر (thalāthata ʿashar) — 13\n" +
            "  ١٤ أَربَعةَ عَشَر (arbaʿata ʿashar) — 14\n" +
            "  ١٥ خَمسةَ عَشَر (khamsata ʿashar) — 15\n" +
            "  ١٦ سِتّةَ عَشَر (sittata ʿashar) — 16\n" +
            "  ١٧ سَبعةَ عَشَر (sabʿata ʿashar) — 17\n" +
            "  ١٨ ثَمانيةَ عَشَر (thamāniyata ʿashar) — 18\n" +
            "  ١٩ تِسعةَ عَشَر (tisʿata ʿashar) — 19\n\n" +
            "Pattern: [ones] + [عَشَر ʿashar].\n\n" +
            "Etymology: this is literally '[number]-ten'. 'Thirteen' is 'three-ten'. English does the same thing (thir-TEEN = three-ten), but Arabic keeps the structure transparent.\n\n" +
            "11 and 12 are slightly special — 11 uses aḥad (not wāḥid), and 12 uses ithnā (dual form without the final -n).",
        },
        {
          kind: "info",
          title: "Tens: 20, 30, 40…",
          body:
            "The tens use a plural-like ending:\n" +
            "  ٢٠ عِشرون (ʿishrūn) — 20\n" +
            "  ٣٠ ثَلاثون (thalāthūn) — 30\n" +
            "  ٤٠ أَربَعون (arbaʿūn) — 40\n" +
            "  ٥٠ خَمسون (khamsūn) — 50\n" +
            "  ٦٠ سِتّون (sittūn) — 60\n" +
            "  ٧٠ سَبعون (sabʿūn) — 70\n" +
            "  ٨٠ ثَمانون (thamānūn) — 80\n" +
            "  ٩٠ تِسعون (tisʿūn) — 90\n\n" +
            "Pattern: the tens all use the -ūn suffix. In accusative/genitive case (after certain prepositions and in many positions) this becomes -īn: ʿishrīn, thalāthīn, etc. For speaking: use whichever you hear most; both are understood.\n\n" +
            "Odd note: 20 is ʿishrūn, but the root is عَشَر (ʿ-sh-r, 'ten'). Etymologically, 20 = 'the tens [of the dual]'.",
        },
        {
          kind: "info",
          title: "21–99 — compound numbers",
          body:
            "Pattern: [ONES] + وَ (wa, 'and') + [TENS]\n\n" +
            "  ٢١ واحِد وَعِشرون (wāḥid wa-ʿishrūn) — 21 ('one and twenty')\n" +
            "  ٢٢ اِثنان وَعِشرون (ithnān wa-ʿishrūn) — 22\n" +
            "  ٢٥ خَمسة وَعِشرون (khamsa wa-ʿishrūn) — 25\n" +
            "  ٣٥ خَمسة وَثَلاثون (khamsa wa-thalāthūn) — 35\n" +
            "  ٩٩ تِسعة وَتِسعون (tisʿa wa-tisʿūn) — 99\n\n" +
            "In Arabic you say the ONES before the TENS. In English, it's the opposite (twenty-five, not five-and-twenty). Interestingly, German (fünfundzwanzig) and older English ('five-and-twenty') share the Arabic order.\n\n" +
            "When writing numbers in Arabic digits: LEFT-TO-RIGHT, same as English.\n" +
            "  25 = ٢٥ — tens on the left, ones on the right, same as Western digits.",
          showcase: [
            { ar: "٢١", translit: "wāḥid wa-ʿishrūn", en: "21 ('one and twenty')" },
            { ar: "٣٥", translit: "khamsa wa-thalāthūn", en: "35" },
            { ar: "٩٩", translit: "tisʿa wa-tisʿūn", en: "99" },
          ],
        },
        {
          kind: "mcq",
          question: "How do you say 15?",
          choices: [
            "khamsa ʿashara",
            "khamsata ʿashar",
            "ʿashara khamsa",
            "khams wa-ʿashara",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "What number is 'khamsa wa-thalāthūn'?",
          choices: ["15", "25", "35", "53"],
          correctIndex: 2,
          explain: "'Five and thirty' = 35. Arabic puts ones FIRST.",
        },
        {
          kind: "mcq",
          arabicPrompt: "٢٠",
          question: "What number, and how is it pronounced?",
          choices: ["2, ithnān", "20, ʿishrūn", "12, ithnā ʿashar", "200, miʾatān"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'arbaʿa wa-sabʿūn' is:",
          choices: ["47", "74", "14", "40"],
          correctIndex: 1,
          explain: "'Four and seventy' = 74.",
        },
        {
          kind: "mcq",
          question: "Arabic arranges compound numbers (21+) with:",
          choices: [
            "TENS before ONES (like English)",
            "ONES before TENS, joined by 'wa-' (like older English 'five-and-twenty')",
            "Only in digits, not words",
            "Random order",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match number to word",
          pairs: [
            { ar: "عِشرون", en: "20" },
            { ar: "ثَلاثون", en: "30" },
            { ar: "أَربَعون", en: "40" },
            { ar: "خَمسون", en: "50" },
            { ar: "تِسعون", en: "90" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for '40' (transliteration).",
          expected: "arbaun",
          altAccepted: ["arbaʿūn", "arbaeen", "arbain"],
        },
        {
          kind: "typing",
          prompt: "Type '25' in Arabic words (transliteration).",
          expected: "khamsa wa-ishrun",
          altAccepted: [
            "khamsa wa-ʿishrūn",
            "khamsa wa ishrun",
            "khamsa waishrun",
            "khamsa waashreen",
            "khamsa wa-ishreen",
          ],
        },
      ],
    },

    {
      id: "L6.3",
      levelId: "L6",
      order: 3,
      title: "Hundreds, Thousands, and Counted Nouns",
      subtitle: "Big numbers + the 'polarity' rule for 3–10",
      theme: "numbers",
      estimatedMinutes: 30,
      xp: 75,
      prerequisites: ["L6.2"],
      summary: "How to count up to a thousand, and the agreement rule every learner stumbles on.",
      wrapUp: "'Polarity agreement' (the 3–10 reversal) is the most characteristically Semitic thing you'll encounter in Level 6. It feels weird for weeks. Then it becomes automatic.",
      activities: [
        {
          kind: "info",
          title: "Hundred, thousand, million",
          body:
            "  ١٠٠   مِئة (miʾa) — 100\n" +
            "  ٢٠٠   مِئَتان (miʾatān) — 200 (dual!)\n" +
            "  ٣٠٠   ثَلاث مِئة (thalāth miʾa) — 300\n" +
            "  ٥٠٠   خَمس مِئة (khams miʾa) — 500\n" +
            "  ١٠٠٠  أَلف (alf) — 1,000\n" +
            "  ٢٠٠٠  أَلفان (alfān) — 2,000 (dual)\n" +
            "  ٣٠٠٠  ثَلاثة آلاف (thalāthat ālāf) — 3,000\n" +
            "  ١٠٠٠٠٠٠ مَليون (malyūn) — 1,000,000\n\n" +
            "Notice how DUAL appears for '200' and '2000' — not 'two hundreds' but a dualized 'hundred'. This is the dual number from Level 5 at work.\n\n" +
            "For compound large numbers, the order is: [thousands] وَ [hundreds] وَ [ones] وَ [tens]\n\n" +
            "Example: 1,437 = أَلف وَأَربَع مِئة وَسَبعة وَثَلاثون (alf wa-arbaʿ miʾa wa-sabʿa wa-thalāthūn)\n" +
            "  'thousand + four hundreds + seven + thirty'",
          showcase: [
            { ar: "مِئة", translit: "miʾa", en: "100" },
            { ar: "أَلف", translit: "alf", en: "1,000" },
            { ar: "مَليون", translit: "malyūn", en: "1,000,000" },
            { ar: "مِلْيار", translit: "milyār", en: "1,000,000,000 (billion)" },
          ],
        },
        {
          kind: "info",
          title: "The polarity rule — numbers 3–10",
          body:
            "For numbers 1 and 2: agreement is NORMAL. The number matches the gender of the counted noun.\n" +
            "  kitāb wāḥid (one book, m) → wāḥid in masculine form\n" +
            "  sayyāra wāḥida (one car, f) → wāḥida in feminine form\n\n" +
            "For numbers 3 through 10: REVERSE POLARITY. The number takes the OPPOSITE gender of the counted noun:\n\n" +
            "  • Masculine counted noun → feminine-looking number (with ة)\n" +
            "  • Feminine counted noun → masculine-looking number (no ة)\n\n" +
            "Examples:\n" +
            "  ثَلاثة كُتُب (thalāthat kutub) — three BOOKS (kutub is masc plural → thalāthat has ة)\n" +
            "  ثَلاث سَيّارات (thalāth sayyārāt) — three CARS (sayyārāt is fem → thalāth has NO ة)\n\n" +
            "Additionally, the counted noun for 3–10 is in PLURAL (genitive case).\n\n" +
            "For numbers 11+: the counted noun returns to SINGULAR (accusative case), and agreement gets more complex.\n\n" +
            "Why this happens: historical linguistic quirk preserved from Proto-Semitic. You don't have to love it — you just have to recognize and use it. Native speakers sometimes get it wrong in casual speech, but formal Arabic (what you're learning) enforces it.",
        },
        {
          kind: "info",
          title: "Ordinal numbers — 'first', 'second', 'third'",
          body:
            "Ordinals are separate words, not made from cardinals:\n\n" +
            "  أَوَّل (awwal) — first (m) / أُولى (ūlā) — first (f)\n" +
            "  ثاني (thānī) — second (m) / ثانِية (thāniya) — second (f)\n" +
            "  ثالِث (thālith) — third (m) / ثالِثة (thālitha) — third (f)\n" +
            "  رابِع (rābiʿ) — fourth\n" +
            "  خامِس (khāmis) — fifth\n" +
            "  سادِس (sādis) — sixth\n" +
            "  سابِع (sābiʿ) — seventh\n" +
            "  ثامِن (thāmin) — eighth\n" +
            "  تاسِع (tāsiʿ) — ninth\n" +
            "  عاشِر (ʿāshir) — tenth\n\n" +
            "Usage: like adjectives, they follow the noun and agree in gender/definiteness.\n" +
            "  الطّابَق الثّاني (aṭ-ṭābaq ath-thānī) — the second floor\n" +
            "  المَرَّة الأُولى (al-marra al-ūlā) — the first time",
        },
        {
          kind: "mcq",
          question: "'miʾa' means:",
          choices: ["10", "50", "100", "1,000"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To say 'three books' (kitāb is masculine, plural kutub):",
          choices: [
            "thalāth kutub",
            "thalātha kutub",
            "thalāthat kutub",
            "thalāthūn kutub",
          ],
          correctIndex: 2,
          explain: "Polarity: masculine noun → feminine-looking number (thalāthat, with ة).",
        },
        {
          kind: "mcq",
          question: "To say 'three cars' (sayyāra is feminine, pl sayyārāt):",
          choices: [
            "thalāth sayyārāt",
            "thalātha sayyārāt",
            "thalāthat sayyārāt",
            "thalāth ʿashar sayyārāt",
          ],
          correctIndex: 0,
          explain: "Polarity: feminine noun → masculine-looking number (thalāth, no ة).",
        },
        {
          kind: "mcq",
          question: "Arabic has a dual form for '200' — mīʾatān. This is because:",
          choices: [
            "200 is considered 'two hundreds' using the dual number",
            "It's a historical accident",
            "200 is a loanword",
            "Arabic lacks the number 200",
          ],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'the second floor' in Arabic is:",
          choices: [
            "ithnān ṭābaq",
            "aṭ-ṭābaq ath-thānī",
            "aṭ-ṭābaq thāniya",
            "ath-thānī aṭ-ṭābaq",
          ],
          correctIndex: 1,
          explain: "Ordinals follow the noun as adjectives, both definite: aṭ-ṭābaq (the floor) ath-thānī (the second).",
        },
        {
          kind: "match",
          prompt: "Match ordinal to English",
          pairs: [
            { ar: "أَوَّل", en: "first (m)" },
            { ar: "ثاني", en: "second (m)" },
            { ar: "ثالِث", en: "third (m)" },
            { ar: "خامِس", en: "fifth (m)" },
            { ar: "عاشِر", en: "tenth (m)" },
          ],
        },
        {
          kind: "match",
          prompt: "Match large-number word to digit",
          pairs: [
            { ar: "مِئة", en: "100" },
            { ar: "أَلف", en: "1,000" },
            { ar: "مَليون", en: "1,000,000" },
            { ar: "مِلْيار", en: "1,000,000,000" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type '1,000' in Arabic (transliteration).",
          expected: "alf",
        },
        {
          kind: "typing",
          prompt: "Type 'the first time' — al-marra al-ūlā (transliteration).",
          expected: "al-marra al-ula",
          altAccepted: ["al-marra al-ūlā", "almarra alula", "al marra al ula"],
        },
        {
          kind: "fillblank",
          prompt: "To say 'five students' (ṭullāb, m plural), use: khams____ ṭullāb.",
          blank: "at",
          en: "-at (feminine ending because the counted noun is masculine — polarity rule)",
          choices: ["", "at", "ūn", "īn"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L6.4",
      levelId: "L6",
      order: 4,
      title: "Days of the Week",
      subtitle: "Almost every day name is a number in disguise",
      theme: "time",
      estimatedMinutes: 30,
      xp: 70,
      prerequisites: ["L6.3"],
      summary: "The seven-day week in Arabic — and why the week starts on Sunday.",
      wrapUp: "Five of the seven days are literally numbered. Friday is 'the gathering' (religious day). Saturday is 'the sabbath'.",
      activities: [
        {
          kind: "info",
          title: "The seven days",
          body:
            "Arabic week starts on SUNDAY. This is rooted in the Islamic calendar and Semitic tradition (also Hebrew — Sunday is 'yom rishon', 'first day').\n\n" +
            "  يَوم الأَحَد (yawm al-aḥad) — Sunday ('day of the ONE')\n" +
            "  يَوم الاِثنَين (yawm al-ithnayn) — Monday ('day of the TWO')\n" +
            "  يَوم الثُّلاثاء (yawm ath-thulāthāʾ) — Tuesday ('day of the THREE')\n" +
            "  يَوم الأَربِعاء (yawm al-arbiʿāʾ) — Wednesday ('day of the FOUR')\n" +
            "  يَوم الخَميس (yawm al-khamīs) — Thursday ('day of the FIVE')\n" +
            "  يَوم الجُمُعة (yawm al-jumuʿa) — Friday ('day of GATHERING')\n" +
            "  يَوم السَّبت (yawm as-sabt) — Saturday ('day of REST / sabbath')\n\n" +
            "In casual speech, 'yawm' is often dropped: just 'al-ithnayn' for 'Monday'.\n\n" +
            "Friday (al-jumuʿa) is the day of the congregational Friday prayer (ṣalāt al-jumuʿa). In most Arab countries, the weekend is FRIDAY–SATURDAY (not Sat–Sun as in the West). Government, schools, and many businesses close.",
          showcase: [
            { ar: "الأَحَد", translit: "al-aḥad", en: "Sunday (the one)" },
            { ar: "الاِثنَين", translit: "al-ithnayn", en: "Monday (the two)" },
            { ar: "الثُّلاثاء", translit: "ath-thulāthāʾ", en: "Tuesday (the three)" },
            { ar: "الأَربِعاء", translit: "al-arbiʿāʾ", en: "Wednesday (the four)" },
            { ar: "الخَميس", translit: "al-khamīs", en: "Thursday (the five)" },
            { ar: "الجُمُعة", translit: "al-jumuʿa", en: "Friday (gathering)" },
            { ar: "السَّبت", translit: "as-sabt", en: "Saturday (sabbath)" },
          ],
        },
        {
          kind: "info",
          title: "Calendars: Gregorian vs Hijri",
          body:
            "Arab countries use TWO calendars in parallel:\n\n" +
            "  1. GREGORIAN (التَّقويم المِيلادي, at-taqwīm al-mīlādī) — the standard Western calendar, used for business, travel, international dealings. Year numbering = CE/BCE.\n\n" +
            "  2. HIJRI (التَّقويم الهِجري, at-taqwīm al-hijrī) — the Islamic lunar calendar. Year 1 = 622 CE (the year of Prophet Muhammad's hijra from Mecca to Medina). 12 lunar months, ~354 days per year — so the Islamic year is ~11 days shorter than the solar year.\n\n" +
            "You'll see BOTH dates on Arabic newspapers, documents, religious texts. Example front-page date:\n\n" +
            "  الأَربِعاء ١٥ رَمَضان ١٤٤٦ / ١٩ مارس ٢٠٢٥\n" +
            "  Wednesday, 15 Ramadan 1446 / 19 March 2025\n\n" +
            "Gregorian month names in Arabic use transliterated European names:\n" +
            "  يَناير (yanāyir) January   فِبراير (fibrāyir) February   مارس (māris) March\n" +
            "  أَبريل (abrīl) April      مايو (māyū) May             يُونيو (yūniyū) June\n" +
            "  يُوليو (yūliyū) July      أَغُسطُس (aghusṭus) August   سِبتَمبَر (sibtambar) September\n" +
            "  أُكتوبَر (uktūbar) October نوفَمبَر (nufambar) November ديسَمبَر (dīsambar) December\n\n" +
            "(In some Gulf and Levantine countries, alternative native names are used: كانون الأَوَّل kānūn al-awwal for December, شُباط shubāṭ for February, etc. The transliterated names are the most internationally recognized.)",
        },
        {
          kind: "info",
          title: "Hijri months",
          body:
            "The 12 Hijri months:\n\n" +
            "  ١. مُحَرَّم (Muḥarram)\n" +
            "  ٢. صَفَر (Ṣafar)\n" +
            "  ٣. رَبيع الأَوَّل (Rabīʿ al-Awwal)\n" +
            "  ٤. رَبيع الآخِر (Rabīʿ al-Ākhir)\n" +
            "  ٥. جُمادى الأُولى (Jumādā al-Ūlā)\n" +
            "  ٦. جُمادى الآخِرة (Jumādā al-Ākhira)\n" +
            "  ٧. رَجَب (Rajab)\n" +
            "  ٨. شَعبان (Shaʿbān)\n" +
            "  ٩. رَمَضان (Ramaḍān) — month of fasting\n" +
            "  ١٠. شَوّال (Shawwāl) — begins with Eid al-Fiṭr\n" +
            "  ١١. ذو القَعدة (Dhū al-Qaʿda)\n" +
            "  ١٢. ذو الحِجّة (Dhū al-Ḥijja) — pilgrimage month, includes Eid al-Aḍḥā\n\n" +
            "For a beginner, you don't need to master all 12. The two you'll see most: Ramaḍān (رَمَضان) and Dhū al-Ḥijja (ذو الحِجّة).",
        },
        {
          kind: "mcq",
          question: "Friday in Arabic:",
          choices: ["al-aḥad", "al-jumuʿa", "as-sabt", "al-khamīs"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'al-ithnayn' is:",
          choices: ["Sunday", "Monday", "Tuesday", "Wednesday"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In the Islamic (Hijri) calendar, year 1 corresponds to:",
          choices: [
            "The birth of Prophet Muhammad",
            "The hijra (migration) from Mecca to Medina in 622 CE",
            "The founding of the Umayyad caliphate",
            "The Christian year 1 CE",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The Hijri calendar has how many days per year, roughly?",
          choices: ["~365 (solar)", "~354 (lunar)", "~400", "Variable — no fixed length"],
          correctIndex: 1,
          explain: "Lunar, 12 months × ~29.5 days = ~354 days. This is why Islamic dates drift ~11 days earlier per Gregorian year.",
        },
        {
          kind: "mcq",
          question: "In most Arab countries, the weekend is:",
          choices: [
            "Saturday–Sunday (like the West)",
            "Friday–Saturday",
            "Thursday–Friday",
            "Sunday only",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The month of fasting is:",
          choices: ["Shaʿbān", "Ramaḍān", "Dhū al-Ḥijja", "Muḥarram"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match day to English",
          pairs: [
            { ar: "الأَحَد", en: "Sunday" },
            { ar: "الاِثنَين", en: "Monday" },
            { ar: "الثُّلاثاء", en: "Tuesday" },
            { ar: "الأَربِعاء", en: "Wednesday" },
            { ar: "الخَميس", en: "Thursday" },
            { ar: "الجُمُعة", en: "Friday" },
            { ar: "السَّبت", en: "Saturday" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'Friday' in Arabic (transliteration).",
          expected: "al-jumua",
          altAccepted: ["al-jumuʿa", "aljumua", "al-juma", "al-jumu'a"],
        },
      ],
    },

    {
      id: "L6.5",
      levelId: "L6",
      order: 5,
      title: "Telling Time & Temporal Expressions",
      subtitle: "Al-sāʿa, al-yawm, ghadan, ams",
      theme: "time",
      estimatedMinutes: 30,
      xp: 75,
      prerequisites: ["L6.4"],
      summary: "The core time vocabulary: today, tomorrow, yesterday, now, hour.",
      wrapUp: "You can now schedule anything, announce the time, and anchor events relative to today. Level 6 complete.",
      activities: [
        {
          kind: "info",
          title: "Core time words",
          body:
            "  اليَوم (al-yawm) — today\n" +
            "  غَداً (ghadan) — tomorrow (note the tanwīn — this word is adverbial)\n" +
            "  أَمس (ams) — yesterday\n" +
            "  الآن (al-ān) — now\n" +
            "  بَعدَ الظُّهر (baʿd aẓ-ẓuhr) — afternoon (lit. 'after noon')\n" +
            "  الصَّباح (aṣ-ṣabāḥ) — the morning\n" +
            "  المَساء (al-masāʾ) — the evening\n" +
            "  اللَّيل (al-layl) — the night\n" +
            "  السَّنة (as-sana) — the year\n" +
            "  الشَّهر (ash-shahr) — the month\n" +
            "  الأُسبوع (al-usbūʿ) — the week\n" +
            "  السّاعة (as-sāʿa) — the hour / the clock\n" +
            "  الدَّقيقة (ad-daqīqa) — the minute\n" +
            "  الثّانية (ath-thāniya) — the second\n\n" +
            "Usage:\n" +
            "  اليَوم الأَربِعاء (al-yawm al-arbiʿāʾ) — today is Wednesday\n" +
            "  غَداً الخَميس (ghadan al-khamīs) — tomorrow [is] Thursday\n" +
            "  هذا الأُسبوع (hādhā l-usbūʿ) — this week\n" +
            "  الأُسبوع القادِم (al-usbūʿ al-qādim) — next week (lit. 'the coming week')\n" +
            "  الأُسبوع الماضي (al-usbūʿ al-māḍī) — last week (lit. 'the passing week')",
          showcase: [
            { ar: "اليَوم", translit: "al-yawm", en: "today" },
            { ar: "غَداً", translit: "ghadan", en: "tomorrow" },
            { ar: "أَمس", translit: "ams", en: "yesterday" },
            { ar: "الآن", translit: "al-ān", en: "now" },
            { ar: "هذا الأُسبوع", translit: "hādhā l-usbūʿ", en: "this week" },
            { ar: "السَّنة القادِمة", translit: "as-sana al-qādima", en: "next year" },
          ],
        },
        {
          kind: "info",
          title: "Telling the hour",
          body:
            "The hour is expressed as: السّاعة [number]\n\n" +
            "  السّاعة الواحِدة (as-sāʿa al-wāḥida) — 1 o'clock\n" +
            "  السّاعة الثّانية (as-sāʿa ath-thāniya) — 2 o'clock (uses ordinal, 'the second hour')\n" +
            "  السّاعة الثّالِثة (as-sāʿa ath-thālitha) — 3 o'clock\n" +
            "  السّاعة الرّابِعة — 4 o'clock\n" +
            "  السّاعة الخامِسة — 5 o'clock\n" +
            "  …\n" +
            "  السّاعة الثّانية عَشرة — 12 o'clock\n\n" +
            "The hour uses ORDINAL numbers (first, second, third…) rather than cardinals — because the sense is 'the first hour', 'the second hour'.\n\n" +
            "AM/PM: صَباحاً (ṣabāḥan, in the morning) and مَساءً (masāʾan, in the evening).\n" +
            "  السّاعة الثّالِثة مَساءً (as-sāʿa ath-thālitha masāʾan) — 3 PM\n" +
            "  السّاعة السّابِعة صَباحاً (as-sāʿa as-sābiʿa ṣabāḥan) — 7 AM\n\n" +
            "Colloquially, people often use the cardinal numbers instead, especially in dialects: السّاعة ثَلاثة (as-sāʿa thalātha) — 'three o'clock'. MSA prefers the ordinal.",
        },
        {
          kind: "info",
          title: "Minutes, halves, quarters",
          body:
            "  وَالنِّصف (wa-n-niṣf) — and a half (thirty minutes)\n" +
            "  وَالرُّبع (wa-r-rubʿ) — and a quarter (fifteen minutes)\n" +
            "  إِلّا الرُّبع (illā r-rubʿ) — except a quarter (fifteen to)\n\n" +
            "  السّاعة الثّالِثة وَالنِّصف — 3:30\n" +
            "  السّاعة الرّابِعة وَالرُّبع — 4:15\n" +
            "  السّاعة الخامِسة إِلّا الرُّبع — 4:45 ('the fifth hour minus a quarter')\n\n" +
            "Minutes past and to:\n" +
            "  السّاعة الثّالِثة وَعَشر دَقائِق — 3:10\n" +
            "  السّاعة الرّابِعة إِلّا عَشر دَقائِق — 3:50",
        },
        {
          kind: "mcq",
          question: "'ghadan' means:",
          choices: ["now", "today", "yesterday", "tomorrow"],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "'as-sāʿa as-sābiʿa' means:",
          choices: [
            "It is 6 o'clock",
            "It is 7 o'clock",
            "The seven hours",
            "Seventh minute",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'al-usbūʿ al-qādim' means:",
          choices: ["last week", "this week", "next week", "a long week"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "3:30 in Arabic:",
          choices: [
            "as-sāʿa ath-thālitha wa-n-niṣf",
            "as-sāʿa ath-thālitha wa-r-rubʿ",
            "as-sāʿa ath-thālitha illā r-rubʿ",
            "thalātha wa-niṣf",
          ],
          correctIndex: 0,
          explain: "'The third hour and the half' = 3:30.",
        },
        {
          kind: "mcq",
          question: "5:45 in Arabic (using 'illā r-rubʿ' construction):",
          choices: [
            "as-sāʿa al-khāmisa wa-r-rubʿ",
            "as-sāʿa as-sādisa illā r-rubʿ",
            "as-sāʿa al-khāmisa wa-n-niṣf",
            "as-sāʿa as-sābiʿa illā n-niṣf",
          ],
          correctIndex: 1,
          explain: "5:45 = 'the sixth hour minus a quarter' = as-sāʿa as-sādisa illā r-rubʿ.",
        },
        {
          kind: "match",
          prompt: "Match time word to meaning",
          pairs: [
            { ar: "اليَوم", en: "today" },
            { ar: "غَداً", en: "tomorrow" },
            { ar: "أَمس", en: "yesterday" },
            { ar: "الآن", en: "now" },
            { ar: "السّاعة", en: "the hour" },
            { ar: "الدَّقيقة", en: "the minute" },
            { ar: "الأُسبوع", en: "the week" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "اليَوم ____. (Today is Friday.)",
          blank: "al-jumuʿa",
          en: "al-jumuʿa",
          choices: ["al-jumuʿa", "as-sabt", "al-ithnayn", "al-khamīs"],
          correctIndex: 0,
        },
        {
          kind: "fillblank",
          prompt: "'Next year' in Arabic: as-sana al-____.",
          blank: "qādima",
          en: "qādima (coming)",
          choices: ["qādima", "māḍiya", "jadīda", "kabīra"],
          correctIndex: 0,
        },
        {
          kind: "typing",
          prompt: "Type 'tomorrow' in Arabic (transliteration).",
          expected: "ghadan",
        },
        {
          kind: "typing",
          prompt: "Type '7 o'clock in the morning' — as-sāʿa as-sābiʿa ṣabāḥan (transliteration).",
          expected: "as-saa as-sabia sabahan",
          altAccepted: [
            "as-sāʿa as-sābiʿa ṣabāḥan",
            "assaa assabia sabahan",
            "as saa as sabia sabahan",
          ],
        },
      ],
    },

    {
      id: "L6.6",
      levelId: "L6",
      order: 6,
      title: "Level 6 Review",
      subtitle: "Numbers, days, and time together",
      theme: "review",
      estimatedMinutes: 30,
      xp: 100,
      prerequisites: ["L6.5"],
      summary: "Thorough review of counting, the calendar, and time.",
      wrapUp: "Level 6 done. Quantities, dates, and times — the full scaffolding for talking about when things happen.",
      activities: [
        {
          kind: "mcq",
          arabicPrompt: "٧",
          question: "What number?",
          choices: ["5", "6", "7", "8"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "٩",
          question: "What number?",
          choices: ["6", "7", "8", "9"],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "'arbaʿūn' means:",
          choices: ["4", "14", "40", "400"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'sabʿa wa-thalāthūn' is:",
          choices: ["37", "73", "17", "70"],
          correctIndex: 0,
          explain: "'Seven and thirty' = 37. Ones first.",
        },
        {
          kind: "mcq",
          question: "Sunday in Arabic:",
          choices: ["al-aḥad", "al-ithnayn", "as-sabt", "al-jumuʿa"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'as-sāʿa ath-thāniya ʿashrata' is:",
          choices: ["2 o'clock", "10 o'clock", "12 o'clock", "20 o'clock"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "To say 'three teachers' (mudarris is masc), you need:",
          choices: [
            "thalāth mudarrisīn",
            "thalātha mudarrisīn",
            "thalāthat mudarrisīn",
            "thalāthūn mudarris",
          ],
          correctIndex: 2,
          explain: "Polarity: masculine counted noun → feminine-looking number (with ة). thalāthat mudarrisīn.",
        },
        {
          kind: "mcq",
          question: "Year 1 of the Hijri calendar is:",
          choices: [
            "Christian year 1",
            "570 CE (birth of Muhammad)",
            "622 CE (the hijra)",
            "Year of the Qurʾān's compilation",
          ],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "اليَوم", en: "today" },
            { ar: "غَداً", en: "tomorrow" },
            { ar: "أَمس", en: "yesterday" },
            { ar: "الآن", en: "now" },
            { ar: "الأُسبوع", en: "the week" },
            { ar: "الشَّهر", en: "the month" },
            { ar: "السَّنة", en: "the year" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'today is Monday' — al-yawm al-ithnayn (transliteration).",
          expected: "al-yawm al-ithnayn",
          altAccepted: [
            "al yawm al ithnayn",
            "alyawm alithnayn",
          ],
        },
        {
          kind: "typing",
          prompt: "Type '100' in Arabic (transliteration).",
          expected: "mia",
          altAccepted: ["miʾa", "mia", "mi'a", "miʾah"],
        },
        {
          kind: "fillblank",
          prompt: "'The second hour' in Arabic: as-sāʿa ____.",
          blank: "ath-thāniya",
          en: "the second (f)",
          choices: ["ith-thānī", "ath-thāniya", "ithnān", "thānī"],
          correctIndex: 1,
          explain: "as-sāʿa is feminine (ends in ة), so the ordinal adjective is feminine: ath-thāniya.",
        },
      ],
    },
  ],
};
