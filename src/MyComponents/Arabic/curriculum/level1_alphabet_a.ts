// ============================================================================
// LEVEL 1 — Foundations of the Arabic Script (letters 1–14 of 28)
//
// Depth: linguistic orientation, articulation points (makhārij), letter families
// by shape + dot pattern, and the beginning of root awareness. Adult learner
// expected — no hand-holding, but thorough scaffolding.
// ============================================================================

import type { Level } from "../types";

export const level1: Level = {
  id: "L1",
  order: 1,
  title: "Foundations of the Arabic Script",
  subtitle: "The first half of the alphabet, systematically",
  theme: "alphabet",
  goal: "Reliably identify and pronounce letters 1–14 in their isolated form, understand the dot-based family system, and begin recognizing Arabic's articulation points.",
  lessons: [
    // -----------------------------------------------------------------------
    {
      id: "L1.1",
      levelId: "L1",
      order: 1,
      title: "Orientation — How Arabic Works",
      subtitle: "Script mechanics, script lineage, and the mental model",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 60,
      summary: "What makes Arabic Arabic — before we touch a single letter.",
      wrapUp: "You've now got the mental framework. The rest is pattern and reps.",
      activities: [
        {
          kind: "info",
          title: "Arabic as a Semitic language",
          body:
            "Arabic is part of the Semitic family alongside Hebrew, Aramaic, and Amharic. The family shares three defining features:\n\n" +
            "  1. Consonantal roots. Most vocabulary grows out of 3-letter skeletons that carry a core meaning. We'll go deep on this starting Level 8, but you should see it coming: K-T-B carries 'writing', so كِتاب (kitāb, book), كاتِب (kātib, writer), and مَكْتَبَة (maktaba, library) are all from one root.\n\n" +
            "  2. Rich morphology, especially on verbs. Arabic has 10 common verb forms derived from the same root, each signaling a different shade of meaning (to do / to make someone do / to be done / etc.).\n\n" +
            "  3. A writing system that treats short vowels as optional marks. Natives read without them. Beginners use them. You'll do both by the end of this course.\n\n" +
            "Arabic is also the liturgical language of roughly 1.9 billion Muslims, and the closest modern form of Quranic Arabic (7th-century Classical Arabic) that's still in everyday use. That's why it hasn't drifted the way Latin did into the Romance languages — the Qurʾān acted as an anchor.",
          tip: "You're not learning a dialect in this course. You're learning Modern Standard Arabic (fuṣḥā), the universal literary form. Dialects diverge; fuṣḥā is the constant.",
        },
        {
          kind: "info",
          title: "Direction, cursive, and the four-form problem",
          body:
            "Three mechanical facts to internalize now:\n\n" +
            "  1. RIGHT TO LEFT. Arabic reads right to left. (Numbers — the ones written with Western digits — are still read left to right, which means a mixed line reads in both directions depending on content. Your eyes adapt in a week.)\n\n" +
            "  2. CURSIVE. Most letters connect to their neighbors — like English handwriting. There is no printed vs. cursive distinction: all Arabic is 'cursive'.\n\n" +
            "  3. FOUR FORMS. Because letters connect, most letters have FOUR shapes depending on position: isolated, initial (start of a word), medial (middle), final (end). The 'core shape' of the letter is the isolated form; the other three are compressed or abbreviated versions.\n\n" +
            "Six letters don't connect to the letter AFTER them. These are called non-connectors: ا  د  ذ  ر  ز  و. When one appears in the middle of a word, the next letter has to start in its initial form — you'll see a visible gap.",
          showcase: [
            { ar: "ب / بـ / ـبـ / ـب", translit: "isolated / initial / medial / final", en: "the four forms of bā" },
            { ar: "كَتَبَ", translit: "kataba", en: "he wrote — note three separate shapes of the same letter family" },
          ],
        },
        {
          kind: "info",
          title: "The alphabet and the dot system",
          body:
            "The Arabic alphabet has 28 consonants. It does NOT have separate letters for short vowels; those are marks (harakat), covered in Level 3.\n\n" +
            "A key insight: many letters are GRAPHICALLY IDENTICAL and differentiated only by dot placement. Memorize this once and the alphabet gets much easier:\n\n" +
            "  ب ت ث — same body, 1 dot below / 2 dots above / 3 dots above\n" +
            "  ج ح خ — same body, dot inside / no dot / dot above\n" +
            "  د ذ   — same body, no dot / one dot above\n" +
            "  ر ز   — same body, no dot / one dot above\n" +
            "  س ش  — same body, no dots / three dots above\n" +
            "  ص ض  — same body, no dot / one dot above\n" +
            "  ط ظ  — same body, no dot / one dot above\n" +
            "  ع غ   — same body, no dot / one dot above\n" +
            "  ف ق  — almost same body, 1 dot above / 2 dots above\n\n" +
            "Nine 'families' carry over half the alphabet. If you can remember the body, the dots do the rest.",
          tip: "When a letter confuses you, ask two questions in order: (1) what BODY is this? (2) how many dots, and where?",
        },
        {
          kind: "info",
          title: "Articulation points (makhārij) — a working concept",
          body:
            "Classical Arabic phonetics divides the mouth and throat into articulation points called makhārij (sg. makhraj). Learning WHERE a letter is produced matters more than in English, because:\n\n" +
            "  1. Some sounds exist nowhere in English (ع ح غ ق ض) and you have to locate them anatomically.\n" +
            "  2. Arabic pairs 'light' and 'heavy' versions of the same consonant (ت vs ط, د vs ض, س vs ص, ذ vs ظ). Pronouncing them interchangeably changes meanings.\n\n" +
            "The rough zones:\n" +
            "  • Throat (deep to shallow): ء ه / ع ح / غ خ\n" +
            "  • Back of mouth: ق ك\n" +
            "  • Middle of mouth / tongue: ج ش ي\n" +
            "  • Front of tongue + teeth: ت د ط ص ض ظ ذ ث س ز ر ل ن\n" +
            "  • Lips: ب م و ف\n\n" +
            "You don't need to memorize this table. You will start to FEEL it as you progress through the levels.",
        },
        {
          kind: "mcq",
          question: "Arabic is read and written:",
          choices: ["Left to right, top to bottom", "Right to left", "Top to bottom, right to left", "It depends on context"],
          correctIndex: 1,
          explain: "Right to left. Mixed text with Western-digit numbers embeds LTR segments, but the baseline direction is RTL.",
        },
        {
          kind: "mcq",
          question: "How many letters in the Arabic alphabet, and what type are they?",
          choices: [
            "26 mixed consonants and vowels",
            "28 consonants — vowels are marks",
            "33 letters total",
            "22 consonants plus 8 vowels",
          ],
          correctIndex: 1,
          explain: "28 consonants. Short vowels (fatḥa, kasra, ḍamma) are diacritics added above or below the letters.",
        },
        {
          kind: "mcq",
          question: "Six letters are 'non-connectors'. What does that mean?",
          choices: [
            "They are never written in isolation",
            "They do not connect to the letter that comes AFTER them",
            "They do not connect to the letter that comes BEFORE them",
            "They cannot appear in the middle of a word",
          ],
          correctIndex: 1,
          explain: "Non-connectors (ا د ذ ر ز و) connect from the right but not to the left, forcing the next letter to begin fresh in its initial form.",
        },
        {
          kind: "mcq",
          question: "Arabic belongs to which language family?",
          choices: ["Indo-European", "Afro-Asiatic (Semitic branch)", "Turkic", "Sino-Tibetan"],
          correctIndex: 1,
          explain: "Semitic branch, alongside Hebrew, Aramaic, Amharic, Tigrinya, Maltese.",
        },
        {
          kind: "mcq",
          question: "Why are some Arabic letters identical in body but carry different dots?",
          choices: [
            "Historical accident — the dots were added to disambiguate older undotted script.",
            "The dots indicate vowels.",
            "The dots are decorative.",
            "Different regions use different dot conventions.",
          ],
          correctIndex: 0,
          explain: "Early Arabic manuscripts (including early Qurʾāns) had no dots. Dots (iʿjām) were systematized around the 7th–8th centuries to disambiguate consonants in reading.",
        },
        {
          kind: "info",
          title: "How to use this course",
          body:
            "Each level has 4–7 lessons of 25–45 minutes. Recommended cadence: 3–4 sessions per week. Don't skip review lessons; the review lessons are where retention is actually built.\n\n" +
            "A normal lesson structure:\n" +
            "  • 1–3 info slides (new concept and context)\n" +
            "  • 6–15 scored activities (MCQ, typing, matching, fill-blank, reading)\n" +
            "  • A wrap-up note tying the lesson to what's coming next\n\n" +
            "A passing score is 60%. XP is proportional to score. Lessons are never locked — you can leap ahead whenever you want — but the dashboard will always have a recommended 'next' lesson following the design order, because each lesson assumes the previous one.",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.2",
      levelId: "L1",
      order: 2,
      title: "Alif, Bāʾ, Tāʾ, Thāʾ",
      subtitle: "The first letter family — 1 body, 4 meanings",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 65,
      prerequisites: ["L1.1"],
      summary: "Your first four letters — and the single most important dot-pattern in Arabic.",
      wrapUp: "You've learned four letters AND the principle that runs through the entire alphabet: one body, multiple letters distinguished by dots.",
      activities: [
        {
          kind: "info",
          title: "ا — Alif",
          body:
            "Alif is a vertical stroke. It represents a long 'ā' vowel (like the a in 'father') when it follows a consonant with a fatḥa mark.\n\n" +
            "Alif is also a non-connector: the letter following it starts in its initial form.\n\n" +
            "Alif sometimes carries a hamza (ء) — a glottal stop — perched on it. You'll see three variants:\n" +
            "  أ — alif with hamza above, pronounced 'a' or 'u'\n" +
            "  إ — alif with hamza below, pronounced 'i'\n" +
            "  آ — alif with madda, pronounced 'ā' (long)\n\n" +
            "At the start of a word, the plain alif (ا) is usually a placeholder carrying a hamza — the hamza is just often omitted in casual print.",
          showcase: [
            { ar: "ا", translit: "alif", en: "long ā / carrier for hamza" },
            { ar: "أَب", translit: "ab", en: "father (alif + hamza above)" },
            { ar: "آمين", translit: "āmīn", en: "amen — note the madda (~)" },
          ],
        },
        {
          kind: "info",
          title: "ب ت ث — the same boat",
          body:
            "Three letters sharing an identical body (a shallow boat-shape with a hook on the right):\n\n" +
            "  ب — bāʾ → 'b'. ONE dot BELOW the body.\n" +
            "  ت — tāʾ → 't' (light t, tongue tip on teeth). TWO dots ABOVE.\n" +
            "  ث — thāʾ → 'th' as in THINK (voiceless). THREE dots ABOVE.\n\n" +
            "Note: the Arabic ث is specifically the voiceless 'th' of 'think', NOT the voiced 'th' of 'this'. That other 'th' is a separate letter (ذ) in the next lesson.\n\n" +
            "Why these three share a body: in the original 7th-century Arabic manuscripts, they were written identically. The dots (iʿjām) were added to disambiguate them.",
          showcase: [
            { ar: "ب", translit: "bāʾ", en: "b", note: "one dot below" },
            { ar: "ت", translit: "tāʾ", en: "t (light)", note: "two dots above" },
            { ar: "ث", translit: "thāʾ", en: "th (think)", note: "three dots above" },
            { ar: "باب", translit: "bāb", en: "door" },
            { ar: "بِنْت", translit: "bint", en: "girl / daughter" },
            { ar: "تِين", translit: "tīn", en: "figs" },
            { ar: "ثَوْب", translit: "thawb", en: "garment (robe)" },
          ],
        },
        {
          kind: "flashcard",
          prompt: "Drill the four letters — isolated forms",
          cards: [
            { ar: "ا", translit: "alif", en: "long ā" },
            { ar: "ب", translit: "bāʾ", en: "b (one dot below)" },
            { ar: "ت", translit: "tāʾ", en: "t (two dots above)" },
            { ar: "ث", translit: "thāʾ", en: "th as in 'think' (three dots above)" },
            { ar: "أ", translit: "alif + hamza", en: "glottal stop — often just 'a'" },
            { ar: "آ", translit: "alif + madda", en: "long ā at word start" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ب",
          question: "Which letter is this, and what single detail identifies it?",
          choices: [
            "tāʾ — two dots above",
            "bāʾ — one dot below",
            "thāʾ — three dots above",
            "nūn — one dot above",
          ],
          correctIndex: 1,
          explain: "One dot BELOW the body = bāʾ → 'b'. Every other member of this family has dots above.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ت",
          question: "Which letter?",
          choices: ["bāʾ (b)", "tāʾ (t)", "thāʾ (th)", "yāʾ (y)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ث",
          question: "Which letter?",
          choices: ["tāʾ (t)", "thāʾ — th as in 'think'", "dhāl — th as in 'this'", "shīn (sh)"],
          correctIndex: 1,
          explain: "Voiceless 'th' of 'think'. The voiced 'th' of 'this' is the letter ذ (dhāl) and is introduced in lesson L1.4.",
        },
        {
          kind: "mcq",
          arabicPrompt: "أ",
          question: "This is alif with a hamza above. It represents:",
          choices: [
            "A long ā vowel",
            "A glottal stop — usually with an 'a' or 'u' vowel",
            "A silent letter",
            "The letter 't'",
          ],
          correctIndex: 1,
          explain: "The hamza (ء) is a glottal stop — the catch in the throat between syllables of 'uh-oh'. Alif is just its carrier.",
        },
        {
          kind: "match",
          prompt: "Match each Arabic letter to its sound",
          pairs: [
            { ar: "ا", en: "long ā" },
            { ar: "ب", en: "b" },
            { ar: "ت", en: "t (light)" },
            { ar: "ث", en: "th (think)" },
          ],
        },
        {
          kind: "match",
          prompt: "Match the whole Arabic word to its English meaning",
          pairs: [
            { ar: "باب", en: "door" },
            { ar: "بِنْت", en: "girl" },
            { ar: "تِين", en: "figs" },
            { ar: "ثَوْب", en: "garment" },
          ],
        },
        {
          kind: "typing",
          prompt: "The Arabic letter ب is transliterated as…",
          expected: "b",
          altAccepted: ["ba", "bā", "baa"],
          hint: "Just the core consonant is fine.",
        },
        {
          kind: "typing",
          prompt: "The Arabic word باب means 'door'. Type the transliteration.",
          expected: "bab",
          altAccepted: ["bāb", "baab"],
        },
        {
          kind: "typing",
          prompt: "The Arabic word تِين means 'figs'. Type the transliteration.",
          expected: "tin",
          altAccepted: ["tīn", "teen"],
        },
        {
          kind: "fillblank",
          prompt: "The letter ____ is distinguished by THREE dots above its body.",
          blank: "thāʾ",
          en: "thāʾ",
          choices: ["bāʾ", "tāʾ", "thāʾ", "nūn"],
          correctIndex: 2,
        },
        {
          kind: "info",
          title: "Takeaway",
          body:
            "Four letters, one governing principle: same body, dots assign the sound.\n\n" +
            "This is the single most important recognition skill for the whole alphabet. Eight of the 28 letters come in dot-only pairs or triplets. If you can distinguish ب ت ث confidently, you're 30% of the way through the alphabet already.",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.3",
      levelId: "L1",
      order: 3,
      title: "Jīm, Ḥāʾ, Khāʾ",
      subtitle: "One body, three sounds — and your first real throat letter",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 65,
      prerequisites: ["L1.2"],
      summary: "ج ح خ — a family that includes Arabic's most famous non-English sound.",
      wrapUp: "You just added three letters and your first taste of throat articulation. ح is the most-mispronounced letter by English speakers — you'll spend this level and the next getting comfortable with it.",
      activities: [
        {
          kind: "info",
          title: "The body",
          body:
            "All three letters share a body shaped like a teardrop with a forward hook:\n\n" +
            "  ج — jīm — one dot INSIDE the body → 'j' as in 'judge'\n" +
            "  ح — ḥāʾ — NO dot → a voiceless pharyngeal fricative\n" +
            "  خ — khāʾ — one dot ABOVE the body → voiceless velar fricative ('kh', as in Bach)\n\n" +
            "The letter name contains a long 'ī'/'ā' because the traditional way to name Arabic letters is to pronounce the consonant with a long vowel.",
        },
        {
          kind: "info",
          title: "ح — the pharyngeal H",
          body:
            "ḥāʾ is not like English H. English H is a puff of breath at the glottis (top of the throat). Arabic ḥāʾ is produced DEEPER, where the pharynx (middle throat) constricts.\n\n" +
            "Mechanics:\n" +
            "  1. Open your mouth as if you're fogging up a window — 'haaah'.\n" +
            "  2. Now tighten the back of your throat, like you're about to whisper sharply.\n" +
            "  3. Push breath out through that tight spot. You should feel a warm, sustained 'hhh' deeper in the throat than English.\n\n" +
            "A common test: English 'he' vs Arabic حي (ḥayy, 'alive'). If they sound the same, you're not yet producing ḥāʾ — you're producing English H (which is the separate letter ه, covered in Level 2).\n\n" +
            "You do not need to produce it perfectly today. You need to recognize that it is DIFFERENT from English H, and to keep returning to it.",
          tip: "Practice prompt: pronounce the Hebrew name 'Chanukah' or the Scottish 'loch'. ح is somewhere between that and a whisper.",
        },
        {
          kind: "info",
          title: "خ — the velar KH",
          body:
            "خāʾ is a voiceless velar fricative — produced at the back of the roof of the mouth, like gently clearing your throat.\n\n" +
            "It's identical to the sound in:\n" +
            "  • German Bach, nach, Loch\n" +
            "  • Scottish loch (as in 'Loch Ness')\n" +
            "  • Hebrew חנוכה (Chanukah — the 'ch')\n" +
            "  • Spanish 'j' in Juan, Jorge\n\n" +
            "If you can produce any of those sounds, you already have خ. It's sometimes confused with ح by beginners, but the two are physically very different — خ is higher up, more scrapey; ح is lower, breathier.",
          showcase: [
            { ar: "ج", translit: "jīm", en: "j as in judge" },
            { ar: "ح", translit: "ḥāʾ", en: "pharyngeal H — breathier, deeper" },
            { ar: "خ", translit: "khāʾ", en: "kh as in Bach / loch" },
            { ar: "حَجّ", translit: "ḥajj", en: "pilgrimage (to Mecca)" },
            { ar: "أَخ", translit: "akh", en: "brother" },
            { ar: "جَمَل", translit: "jamal", en: "camel" },
            { ar: "خُبْز", translit: "khubz", en: "bread" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ح",
          question: "Which letter is this, and where is it produced?",
          choices: [
            "jīm — middle of the mouth",
            "ḥāʾ — pharynx (middle throat)",
            "khāʾ — back of the roof of the mouth",
            "hāʾ — glottis (top of throat, like English H)",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ج",
          question: "Which letter?",
          choices: ["ḥāʾ", "jīm", "khāʾ", "tāʾ"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "خ",
          question: "Which letter — and which English word has the same sound?",
          choices: [
            "jīm — as in 'judge'",
            "ḥāʾ — as in... no English equivalent",
            "khāʾ — as in German 'Bach' or Scottish 'loch'",
            "hāʾ — as in English 'hello'",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Which Arabic letter is used in the name 'Hanukkah' (חנוכה) — the 'Kh' sound?",
          choices: ["ح", "خ", "ج", "ه"],
          correctIndex: 1,
          explain: "Hanukkah's 'Ch' (as in Bach) is خāʾ in Arabic — a voiceless velar fricative.",
        },
        {
          kind: "match",
          prompt: "Match the letter to the sound",
          pairs: [
            { ar: "ج", en: "j (judge)" },
            { ar: "ح", en: "pharyngeal H" },
            { ar: "خ", en: "kh (Bach)" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "حَجّ", en: "pilgrimage" },
            { ar: "أَخ", en: "brother" },
            { ar: "جَمَل", en: "camel" },
            { ar: "خُبْز", en: "bread" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of ج (the core consonant).",
          expected: "j",
          altAccepted: ["jim", "jīm"],
        },
        {
          kind: "typing",
          prompt: "The Arabic word خُبْز means 'bread'. Type the transliteration.",
          expected: "khubz",
        },
        {
          kind: "fillblank",
          prompt: "The letter ح is produced in the ____.",
          blank: "pharynx",
          en: "pharynx (middle throat)",
          choices: ["pharynx", "lips", "back of the soft palate", "tip of the tongue"],
          correctIndex: 0,
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.4",
      levelId: "L1",
      order: 4,
      title: "Dāl, Dhāl, Rāʾ, Zāy",
      subtitle: "Two two-letter families — and four of the six non-connectors",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 65,
      prerequisites: ["L1.3"],
      summary: "د ذ ر ز — and what 'non-connector' looks like in real writing.",
      wrapUp: "You now know four of the six non-connectors (ا د ذ ر ز). When any of them appears, the NEXT letter starts fresh.",
      activities: [
        {
          kind: "info",
          title: "د and ذ — dāl / dhāl",
          body:
            "The body: a hooked stroke that looks like a small '7' in reverse.\n\n" +
            "  د — dāl — no dot → 'd' (voiced dental stop, tongue behind the upper teeth)\n" +
            "  ذ — dhāl — one dot above → voiced 'th' as in 'this' / 'the'\n\n" +
            "The English 'th' phoneme splits into TWO Arabic letters:\n" +
            "  • ث (thāʾ) — voiceless: think, thin, thought\n" +
            "  • ذ (dhāl) — voiced: this, that, the, other\n\n" +
            "Test voicing: touch your throat and say 'think' then 'this'. 'Think' = no vibration at the start. 'This' = vibration. That's the ث vs ذ distinction.\n\n" +
            "Both د and ذ are non-connectors. The letter after them starts in its initial form.",
          showcase: [
            { ar: "د", translit: "dāl", en: "d" },
            { ar: "ذ", translit: "dhāl", en: "voiced th (this)" },
            { ar: "دَرْس", translit: "dars", en: "lesson" },
            { ar: "هَذا", translit: "hādhā", en: "this (m)" },
            { ar: "ذَهَب", translit: "dhahab", en: "gold" },
          ],
        },
        {
          kind: "info",
          title: "ر and ز — rāʾ / zāy",
          body:
            "The body: a curve that dips below the baseline.\n\n" +
            "  ر — rāʾ — no dot → trilled or tapped 'r' (like Spanish or Italian r, not American r)\n" +
            "  ز — zāy — one dot above → 'z'\n\n" +
            "Production of ر: the tip of the tongue touches the ridge just behind the upper teeth, quickly — a single tap or a short trill. It is NOT the American English 'r' (which is retroflex — tongue curled back). If you say American 'r', you'll sound noticeably non-native.\n\n" +
            "Both ر and ز are non-connectors.",
          showcase: [
            { ar: "ر", translit: "rāʾ", en: "tapped/trilled r" },
            { ar: "ز", translit: "zāy", en: "z" },
            { ar: "رَجُل", translit: "rajul", en: "man" },
            { ar: "زَيْت", translit: "zayt", en: "oil" },
            { ar: "أَرُزّ", translit: "aruzz", en: "rice" },
          ],
        },
        {
          kind: "info",
          title: "The six non-connectors — why the gaps matter",
          body:
            "The six letters that NEVER connect to the letter after them:\n\n" +
            "  ا  د  ذ  ر  ز  و\n\n" +
            "In handwriting and print, when one of these appears mid-word, you'll see a visible break. The letter AFTER must start in its initial form.\n\n" +
            "Example: دَرَسَ (darasa, 'he studied'). The letter د is a non-connector, so ر begins fresh. In writing it looks like 'د‌رس' with a clear gap after د.\n\n" +
            "This trips beginners who try to mentally 'flow' every letter. Don't. Accept the gaps — they're grammatical, not errors.",
        },
        {
          kind: "flashcard",
          prompt: "All eight letters so far — drill cold",
          cards: [
            { ar: "ا", translit: "alif", en: "long ā" },
            { ar: "ب", translit: "bāʾ", en: "b" },
            { ar: "ت", translit: "tāʾ", en: "t" },
            { ar: "ث", translit: "thāʾ", en: "th (think)" },
            { ar: "ج", translit: "jīm", en: "j" },
            { ar: "ح", translit: "ḥāʾ", en: "pharyngeal H" },
            { ar: "خ", translit: "khāʾ", en: "kh (Bach)" },
            { ar: "د", translit: "dāl", en: "d" },
            { ar: "ذ", translit: "dhāl", en: "th (this)" },
            { ar: "ر", translit: "rāʾ", en: "tapped r" },
            { ar: "ز", translit: "zāy", en: "z" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ذ",
          question: "Which letter?",
          choices: [
            "dāl — 'd'",
            "dhāl — 'th' as in 'this'",
            "thāʾ — 'th' as in 'think'",
            "zāy — 'z'",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ز",
          question: "Which letter?",
          choices: ["rāʾ", "zāy", "dāl", "thāʾ"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which of these is NOT a non-connector?",
          choices: ["ا", "ت", "ر", "و"],
          correctIndex: 1,
          explain: "ت connects to the letter after it. The non-connectors so far are ا د ذ ر ز (and we'll meet و in Level 2).",
        },
        {
          kind: "mcq",
          question: "English splits one 'th' sound into two phonemes. Arabic distinguishes them with:",
          choices: [
            "One letter that flexes — context disambiguates",
            "Two separate letters: ث (voiceless, think) and ذ (voiced, this)",
            "The same letter with different dots",
            "A diacritic above the letter",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic ر is closest to which English sound?",
          choices: [
            "American 'r' in 'red'",
            "British 'r' in 'rice'",
            "Spanish 'r' in 'pero' — a quick tongue tap",
            "French 'r' in 'rouge' — back of throat",
          ],
          correctIndex: 2,
          explain: "A dental tap or trill. French/German r is a separate sound (غ ghayn, coming in Level 2).",
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "د", en: "d" },
            { ar: "ذ", en: "th (this)" },
            { ar: "ر", en: "tapped r" },
            { ar: "ز", en: "z" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "دَرْس", en: "lesson" },
            { ar: "رَجُل", en: "man" },
            { ar: "زَيْت", en: "oil" },
            { ar: "ذَهَب", en: "gold" },
            { ar: "أَرُزّ", en: "rice" },
          ],
        },
        {
          kind: "typing",
          prompt: "The Arabic word رَجُل means 'man'. Type the transliteration.",
          expected: "rajul",
        },
        {
          kind: "typing",
          prompt: "The Arabic word ذَهَب means 'gold'. Type the transliteration.",
          expected: "dhahab",
        },
        {
          kind: "fillblank",
          prompt: "When ر appears in the middle of a word, the letter AFTER it ____.",
          blank: "starts fresh in its initial form",
          en: "starts fresh in its initial form",
          choices: [
            "connects normally",
            "starts fresh in its initial form",
            "is omitted",
            "doubles",
          ],
          correctIndex: 1,
          explain: "ر is a non-connector. Six letters behave this way: ا د ذ ر ز و.",
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.5",
      levelId: "L1",
      order: 5,
      title: "Sīn, Shīn",
      subtitle: "Three teeth, with or without dots",
      theme: "alphabet",
      estimatedMinutes: 30,
      xp: 55,
      prerequisites: ["L1.4"],
      summary: "س and ش — and some of the most common words in Arabic.",
      wrapUp: "ش is visually distinctive (three dots above) and shows up everywhere — شَمس (sun), شاي (tea), شارع (street).",
      activities: [
        {
          kind: "info",
          title: "س — sīn",
          body:
            "The body: three short 'teeth' (small waves) ending in a curving final hook below the baseline.\n\n" +
            "  س — sīn — no dots → 's' (voiceless alveolar fricative, like English 's' in 'sit')\n\n" +
            "Sīn is 'light' — a thin, front-of-mouth s. Its heavy counterpart ص (ṣād) is a different letter entirely, covered in Level 2. Pronouncing them interchangeably changes meanings (سَيف sayf = sword vs صَيف ṣayf = summer).",
        },
        {
          kind: "info",
          title: "ش — shīn",
          body:
            "Same three-teeth body as sīn, but with THREE dots arranged in a triangle ABOVE.\n\n" +
            "  ش — shīn → 'sh' (as in 'ship')\n\n" +
            "Shīn has no heavy counterpart. It appears in some of the most frequent Arabic words:\n" +
            "  شَمس (shams) — sun\n" +
            "  شاي (shāy) — tea\n" +
            "  شارع (shāriʿ) — street\n" +
            "  شُكراً (shukran) — thanks\n" +
            "  مُشكِلة (mushkila) — problem",
          showcase: [
            { ar: "س", translit: "sīn", en: "s (light)" },
            { ar: "ش", translit: "shīn", en: "sh" },
            { ar: "سَلام", translit: "salām", en: "peace" },
            { ar: "شَمس", translit: "shams", en: "sun" },
            { ar: "شاي", translit: "shāy", en: "tea" },
            { ar: "شُكراً", translit: "shukran", en: "thanks" },
            { ar: "سِنّ", translit: "sinn", en: "tooth / age" },
          ],
        },
        {
          kind: "info",
          title: "Etymology sidebar — shukran, sukkar, assassin",
          body:
            "Many English (and Romance) words came from Arabic. A few you know:\n\n" +
            "  • 'sugar' (English) ← سُكَّر (sukkar) ← Persian shakar ← Sanskrit śarkarā\n" +
            "  • 'coffee' ← قَهوة (qahwa)\n" +
            "  • 'algebra' ← الجبر (al-jabr) — from the treatise by al-Khwārizmī (9th c.)\n" +
            "  • 'algorithm' ← distortion of al-Khwārizmī's own name\n" +
            "  • 'admiral' ← أَمير البَحر (amīr al-baḥr, 'commander of the sea')\n" +
            "  • 'alcohol' ← الكُحول (al-kuḥūl)\n" +
            "  • 'zero' and 'cipher' both ← صِفر (ṣifr)\n\n" +
            "The Arabic world was the scientific lingua franca from roughly the 8th to the 13th century. Modern European math, astronomy, medicine, and chemistry vocabulary still show that imprint.",
        },
        {
          kind: "mcq",
          arabicPrompt: "س",
          question: "Which letter?",
          choices: ["sīn (s)", "shīn (sh)", "ṣād (heavy s)", "sīn with ḍamma"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ش",
          question: "Which letter?",
          choices: ["sīn", "shīn", "thāʾ", "ṣād"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Arabic has two letters often transliterated as 's'. They are:",
          choices: [
            "س (light s) and ز (z)",
            "س (light s) and ص (heavy/emphatic s)",
            "ش (sh) and س (s)",
            "ص (ṣ) and ش (sh)",
          ],
          correctIndex: 1,
          explain: "س is the light s. ص (ṣād, Level 2) is the heavy/emphatic s that thickens surrounding vowels.",
        },
        {
          kind: "mcq",
          question: "The English word 'sugar' derives (by way of Persian) from Arabic:",
          choices: ["سُكَّر", "شاي", "قَهوة", "شَمس"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "سَلام", en: "peace" },
            { ar: "شَمس", en: "sun" },
            { ar: "شاي", en: "tea" },
            { ar: "شُكراً", en: "thanks" },
          ],
        },
        {
          kind: "typing",
          prompt: "The word شَمس means 'sun'. Type the transliteration.",
          expected: "shams",
        },
        {
          kind: "typing",
          prompt: "The word سَلام means 'peace'. Type the transliteration.",
          expected: "salam",
          altAccepted: ["salām", "salaam"],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic transliteration for 'thanks' (شُكراً).",
          expected: "shukran",
        },
        {
          kind: "fillblank",
          prompt: "____ is the three-teeth body with no dots — the letter 's'.",
          blank: "sīn",
          en: "sīn",
          choices: ["sīn", "shīn", "ṣād", "thāʾ"],
          correctIndex: 0,
        },
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: "L1.6",
      levelId: "L1",
      order: 6,
      title: "Level 1 Review",
      subtitle: "Lock in the first 14 letters",
      theme: "review",
      estimatedMinutes: 35,
      xp: 100,
      prerequisites: ["L1.2", "L1.3", "L1.4", "L1.5"],
      summary: "A thorough stress-test of everything in Level 1.",
      wrapUp: "Level 1 complete. Half the alphabet is behind you. The second half (ص ض ط ظ ع غ ف ق ك ل م ن ه و ي) reuses all the same family logic.",
      activities: [
        {
          kind: "info",
          title: "Quick consolidation before the drill",
          body:
            "Letters you've met this level (14 total):\n\n" +
            "  Non-emphatic family (teeth-based bodies):\n" +
            "    ا  ب  ت  ث  س  ش\n\n" +
            "  Throat-and-curve bodies:\n" +
            "    ج  ح  خ  د  ذ  ر  ز\n\n" +
            "Non-connectors so far: ا د ذ ر ز (5 of the 6; و is in Level 2).\n\n" +
            "Throat sound you've met: ح (pharyngeal H).\n" +
            "Back-of-mouth fricative: خ (Bach's 'ch').\n" +
            "Voicing contrast: ث (think) vs ذ (this).\n\n" +
            "If any of these feel shaky, the flashcard below exists to close gaps before the scored questions. Nothing wrong with running it twice.",
        },
        {
          kind: "flashcard",
          prompt: "All 14 letters — final drill",
          cards: [
            { ar: "ا", translit: "alif", en: "long ā / hamza carrier" },
            { ar: "ب", translit: "bāʾ", en: "b (one dot below)" },
            { ar: "ت", translit: "tāʾ", en: "light t (two dots above)" },
            { ar: "ث", translit: "thāʾ", en: "th — think (three dots above)" },
            { ar: "ج", translit: "jīm", en: "j (dot inside)" },
            { ar: "ح", translit: "ḥāʾ", en: "pharyngeal H (no dot)" },
            { ar: "خ", translit: "khāʾ", en: "kh — Bach (dot above)" },
            { ar: "د", translit: "dāl", en: "d (non-connector)" },
            { ar: "ذ", translit: "dhāl", en: "th — this (non-connector, dot above)" },
            { ar: "ر", translit: "rāʾ", en: "tapped r (non-connector)" },
            { ar: "ز", translit: "zāy", en: "z (non-connector, dot above)" },
            { ar: "س", translit: "sīn", en: "light s (three teeth, no dots)" },
            { ar: "ش", translit: "shīn", en: "sh (three teeth, three dots)" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ث",
          question: "Which letter, and is it voiced?",
          choices: [
            "thāʾ — voiceless 'th' (think)",
            "dhāl — voiced 'th' (this)",
            "tāʾ — 't'",
            "shīn — 'sh'",
          ],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ح",
          question: "Which letter, and where is it produced?",
          choices: [
            "khāʾ — back of mouth",
            "hāʾ — glottis, like English H",
            "ḥāʾ — pharynx, middle throat",
            "jīm — palate",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ذ",
          question: "Which letter?",
          choices: ["dāl", "dhāl", "zāy", "rāʾ"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ش",
          question: "Which letter?",
          choices: ["sīn", "shīn", "thāʾ", "ṣād"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which letter does NOT connect to the next letter in a word?",
          choices: ["ب", "ج", "ر", "س"],
          correctIndex: 2,
          explain: "ر is a non-connector. The others all connect forward.",
        },
        {
          kind: "mcq",
          question: "The English word 'algebra' traces to the Arabic treatise title:",
          choices: [
            "الجَبر (al-jabr)",
            "المَنزِل (al-manzil)",
            "الشَّمس (ash-shams)",
            "الكِتاب (al-kitāb)",
          ],
          correctIndex: 0,
          explain: "al-Khwārizmī's 9th-century treatise 'al-Kitāb al-mukhtaṣar fī ḥisāb al-jabr wa-l-muqābala' gave both 'algebra' (al-jabr) and 'algorithm' (al-Khwārizmī) to European languages.",
        },
        {
          kind: "mcq",
          question: "How many Arabic letters share the boat-shaped body بـ / تـ / ثـ?",
          choices: ["2", "3", "4", "5"],
          correctIndex: 1,
          explain: "Three: ب (one dot below), ت (two dots above), ث (three dots above). In context, other letters may look similar in medial form — but these three are the same BODY.",
        },
        {
          kind: "match",
          prompt: "Match each letter to its sound",
          pairs: [
            { ar: "ب", en: "b" },
            { ar: "ت", en: "t" },
            { ar: "ج", en: "j" },
            { ar: "ح", en: "pharyngeal H" },
            { ar: "خ", en: "kh (Bach)" },
            { ar: "د", en: "d" },
            { ar: "ر", en: "tapped r" },
            { ar: "س", en: "s" },
            { ar: "ش", en: "sh" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "باب", en: "door" },
            { ar: "بِنْت", en: "girl" },
            { ar: "خُبز", en: "bread" },
            { ar: "رَجُل", en: "man" },
            { ar: "زَيت", en: "oil" },
            { ar: "شَمس", en: "sun" },
            { ar: "سَلام", en: "peace" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of شُكراً (thanks).",
          expected: "shukran",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of خُبز (bread).",
          expected: "khubz",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of دَرْس (lesson).",
          expected: "dars",
        },
        {
          kind: "fillblank",
          prompt: "The two Arabic letters for the two English 'th' sounds are ث (thāʾ) and ____.",
          blank: "ذ (dhāl)",
          en: "dhāl",
          choices: ["د (dāl)", "ذ (dhāl)", "ز (zāy)", "ش (shīn)"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
