// ============================================================================
// LEVEL 2 — The rest of the alphabet (letters 15–28) + emphatic sounds
//
// Depth focus: emphatic ('heavy') consonants, pharyngeal/velar throat letters
// (ع غ ق), and the final connective letters (ك ل م ن ه و ي) plus hamza.
// ============================================================================

import type { Level } from "../types";

export const level2: Level = {
  id: "L2",
  order: 2,
  title: "Completing the Alphabet",
  subtitle: "The emphatic family, the throat letters, and the rest",
  theme: "alphabet",
  goal: "Recognize the remaining 14 letters, produce the four emphatic consonants as distinct from their light counterparts, and understand the pharyngeal distinction (ع vs ح, خ vs غ).",
  lessons: [
    {
      id: "L2.1",
      levelId: "L2",
      order: 1,
      title: "Ṣād, Ḍād — the Emphatic Family (Part 1)",
      subtitle: "Heavy consonants that change vowels around them",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 70,
      prerequisites: ["L1.6"],
      summary: "ص and ض — Arabic's signature emphatic letters. Pronouncing them wrong changes meanings.",
      wrapUp: "You've met the first two of four emphatic letters. They're physically produced by flattening the tongue broad across the roof of the mouth.",
      activities: [
        {
          kind: "info",
          title: "What does 'emphatic' mean?",
          body:
            "Arabic has four 'emphatic' consonants — traditionally called mufakhkhama (thickened) or muṭbaqa (covered). They are:\n\n" +
            "  ص — ṣād      (heavy s)\n" +
            "  ض — ḍād      (heavy d)\n" +
            "  ط — ṭāʾ      (heavy t)\n" +
            "  ظ — ẓāʾ      (heavy dh / heavy z in some dialects)\n\n" +
            "Physically, to produce an emphatic:\n" +
            "  1. Start from the equivalent light consonant (s / d / t / dh).\n" +
            "  2. Flatten the tongue broadly so it contacts the roof of the mouth.\n" +
            "  3. Constrict the pharynx — same area as ح.\n" +
            "  4. Let the mouth cavity feel 'fuller'. A surrounding 'a' sounds more like 'aw'; an 'i' sounds darker; a 'u' sounds deeper.\n\n" +
            "The vowels around an emphatic letter THICKEN automatically. This is why سَيف (sayf, sword) and صَيف (ṣayf, summer) don't just differ in the s — the 'ay' quality differs too.\n\n" +
            "An aside: emphatic consonants exist in several Semitic languages (Hebrew used to have them but largely lost them). Arabic preserved the full set.",
        },
        {
          kind: "info",
          title: "ص — ṣād",
          body:
            "The body looks like a loop with a small tail — think of a cursive 'L' curled in on itself.\n\n" +
            "  ص — ṣād → heavy S (voiceless emphatic alveolar fricative)\n\n" +
            "Mechanics: say English 's'. Then flatten your tongue wide, pushing the sides against the upper molars. The 's' gets darker and 'fatter'. That's ṣād.\n\n" +
            "Minimal pairs with س (sīn):\n" +
            "  سَيف (sayf) — sword       vs   صَيف (ṣayf) — summer\n" +
            "  سُور (sūr) — an enclosure vs   صُور (ṣūr) — horns / photos\n" +
            "  سَبْر (sabr) — probing    vs   صَبْر (ṣabr) — patience",
          showcase: [
            { ar: "ص", translit: "ṣād", en: "heavy s" },
            { ar: "صَيف", translit: "ṣayf", en: "summer" },
            { ar: "صَبْر", translit: "ṣabr", en: "patience" },
            { ar: "صَديق", translit: "ṣadīq", en: "friend (male)" },
            { ar: "صَحيح", translit: "ṣaḥīḥ", en: "correct / authentic" },
          ],
        },
        {
          kind: "info",
          title: "ض — ḍād",
          body:
            "Same body as ص with one dot added above.\n\n" +
            "  ض — ḍād → heavy D (voiced emphatic alveolar stop)\n\n" +
            "Mechanics: ḍād is pronounced with the SIDE of the tongue pressing against the upper molars while voicing 'd'. Classical sources describe it as a uniquely Arabic sound — no other language has quite the same articulation. Arabic is sometimes called لُغة الضاد (lughat al-ḍād), 'the language of ḍād'.\n\n" +
            "In casual modern speech, ض is produced similarly to ṭāʾ voiced, which is close enough for communication.\n\n" +
            "Minimal pairs with د (dāl):\n" +
            "  دَرَبَ (daraba) — to practice   vs   ضَرَبَ (ḍaraba) — to hit\n" +
            "  دَل (dall) — he led             vs   ضَلّ (ḍall) — he went astray",
          showcase: [
            { ar: "ض", translit: "ḍād", en: "heavy d" },
            { ar: "ضَوء", translit: "ḍawʾ", en: "light (illumination)" },
            { ar: "مَريض", translit: "marīḍ", en: "sick / ill" },
            { ar: "أَرض", translit: "arḍ", en: "earth / ground" },
            { ar: "رَمَضان", translit: "Ramaḍān", en: "Ramadan (the month)" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ص",
          question: "Which letter?",
          choices: ["sīn (light s)", "ṣād (heavy s)", "shīn (sh)", "zāy (z)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ض",
          question: "Which letter?",
          choices: ["dāl (d)", "dhāl (th, this)", "ḍād (heavy d)", "ẓāʾ (heavy dh)"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Arabic صَيف means 'summer'. What does سَيف mean?",
          choices: ["Sunrise", "Sword", "Sand", "Sunset"],
          correctIndex: 1,
          explain: "sayf (سَيف) = sword, ṣayf (صَيف) = summer. A single-letter difference flips the meaning entirely.",
        },
        {
          kind: "mcq",
          question: "Arabic is nicknamed 'the language of ض' because:",
          choices: [
            "It's the most common letter in Arabic.",
            "The letter ض (ḍād) has an articulation classical Arabic sources claim is unique to Arabic.",
            "It's the first letter of the word 'Arabic'.",
            "It's the last letter of the alphabet.",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "When a vowel is adjacent to an emphatic consonant, it:",
          choices: [
            "Drops out entirely",
            "Thickens / darkens (e.g., 'a' → more like 'aw')",
            "Lengthens",
            "Becomes silent",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match letter to description",
          pairs: [
            { ar: "س", en: "light s" },
            { ar: "ص", en: "heavy/emphatic s" },
            { ar: "د", en: "light d" },
            { ar: "ض", en: "heavy/emphatic d" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "صَديق", en: "friend" },
            { ar: "صَحيح", en: "correct" },
            { ar: "أَرض", en: "earth / ground" },
            { ar: "مَريض", en: "sick" },
            { ar: "رَمَضان", en: "Ramadan" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of صَديق (friend, m.).",
          expected: "sadiq",
          altAccepted: ["ṣadīq", "sadeeq"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of أَرض (earth / ground).",
          expected: "ard",
          altAccepted: ["arḍ"],
        },
        {
          kind: "fillblank",
          prompt: "Arabic صَبْر (ṣabr) means 'patience'. The word سَبْر (sabr) — differing only in ص vs س — means ____.",
          blank: "probing",
          en: "probing",
          choices: ["patience again", "sword", "probing / exploration", "sunset"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L2.2",
      levelId: "L2",
      order: 2,
      title: "Ṭāʾ, Ẓāʾ — the Emphatic Family (Part 2)",
      subtitle: "Heavy T and heavy DH",
      theme: "alphabet",
      estimatedMinutes: 30,
      xp: 60,
      prerequisites: ["L2.1"],
      summary: "ط and ظ — the remaining emphatics.",
      wrapUp: "All four emphatic letters (ص ض ط ظ) are now on the table. Their shared physical signature: flat wide tongue, constricted pharynx, thickened vowels.",
      activities: [
        {
          kind: "info",
          title: "ط — ṭāʾ",
          body:
            "A loop-and-stroke body, visually distinctive.\n\n" +
            "  ط — ṭāʾ → heavy T (voiceless emphatic alveolar stop)\n\n" +
            "Produced like تāʾ (light t) but with the tongue flattened and broad, pressing against the front palate. The mouth feels fuller.\n\n" +
            "Minimal pairs with ت (tāʾ):\n" +
            "  تين (tīn) — figs              vs   طين (ṭīn) — clay\n" +
            "  تَمر (tamr) — dates (fruit)   vs   طَمْر (ṭamr) — burial\n\n" +
            "In words derived from the root ط-ب (health/medicine):\n" +
            "  طَبيب (ṭabīb) — doctor\n" +
            "  طِبّ (ṭibb) — medicine\n" +
            "  طَعام (ṭaʿām) — food",
          showcase: [
            { ar: "ط", translit: "ṭāʾ", en: "heavy t" },
            { ar: "طِين", translit: "ṭīn", en: "clay / mud" },
            { ar: "طَبيب", translit: "ṭabīb", en: "doctor" },
            { ar: "طالِب", translit: "ṭālib", en: "student (m)" },
            { ar: "طَيِّب", translit: "ṭayyib", en: "good / kind" },
          ],
        },
        {
          kind: "info",
          title: "ظ — ẓāʾ",
          body:
            "Same body as ط with one dot added above.\n\n" +
            "  ظ — ẓāʾ → heavy DH (voiced emphatic)\n\n" +
            "Classical pronunciation: a heavy, flat-tongued version of dhāl (ذ, the 'th' in 'this'). In some modern dialects (especially Egyptian), ظ is pronounced as a heavy 'z' instead. Modern Standard Arabic (fuṣḥā) preserves the classical heavy-DH.\n\n" +
            "Minimal pair with ذ:\n" +
            "  ذَلّ (dhall) — humiliation   vs   ظَلّ (ẓall) — he remained\n" +
            "  ذَكاء (dhakāʾ) — intelligence vs  ظَلام (ẓalām) — darkness (different word, illustrates ظ in context)",
          showcase: [
            { ar: "ظ", translit: "ẓāʾ", en: "heavy dh (sometimes heavy z)" },
            { ar: "ظَهر", translit: "ẓahr", en: "back (body part) / noon" },
            { ar: "ظَلام", translit: "ẓalām", en: "darkness" },
            { ar: "نَظام", translit: "niẓām", en: "system / order" },
            { ar: "مَحفَظة", translit: "maḥfaẓa", en: "wallet / purse" },
          ],
        },
        {
          kind: "info",
          title: "All four emphatics — side by side",
          body:
            "  ص / ṣād   — heavy s   ← vs س (light s)\n" +
            "  ض / ḍād   — heavy d   ← vs د (light d)\n" +
            "  ط / ṭāʾ   — heavy t   ← vs ت (light t)\n" +
            "  ظ / ẓāʾ   — heavy dh  ← vs ذ (light 'th' as in 'this')\n\n" +
            "Notice the pattern: each emphatic pairs with a 'front of the mouth' light consonant. The difference between them is the ROOM of the mouth — flat wide tongue for emphatics, narrow tongue for lights.\n\n" +
            "In transliteration, emphatics are marked with a subscript dot: ṣ, ḍ, ṭ, ẓ. Some writing systems use capitals (S, D, T, Z) instead. Both are unambiguous.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ط",
          question: "Which letter?",
          choices: ["tāʾ (light t)", "ṭāʾ (heavy t)", "thāʾ (th)", "dāl (d)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ظ",
          question: "Which letter?",
          choices: ["ẓāʾ (heavy dh)", "ḍād (heavy d)", "dhāl (light th)", "ṭāʾ (heavy t)"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "طِين means 'clay / mud'. What does تِين mean?",
          choices: ["Clay again", "Figs", "Fish", "Fate"],
          correctIndex: 1,
          explain: "ṭīn = clay, tīn = figs. Light vs heavy t → different words.",
        },
        {
          kind: "mcq",
          question: "How many Arabic letters are in the emphatic family?",
          choices: ["Two", "Three", "Four", "Six"],
          correctIndex: 2,
          explain: "Four: ص ض ط ظ (ṣ, ḍ, ṭ, ẓ).",
        },
        {
          kind: "match",
          prompt: "Match emphatic to its light counterpart",
          pairs: [
            { ar: "ص", en: "paired with س" },
            { ar: "ض", en: "paired with د" },
            { ar: "ط", en: "paired with ت" },
            { ar: "ظ", en: "paired with ذ" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "طَبيب", en: "doctor" },
            { ar: "طالِب", en: "student" },
            { ar: "نَظام", en: "system" },
            { ar: "ظَهر", en: "back / noon" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of طَبيب (doctor).",
          expected: "tabib",
          altAccepted: ["ṭabīb", "tabeeb"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of نَظام (system).",
          expected: "nizam",
          altAccepted: ["niẓām", "nidham", "nidhaam"],
        },
        {
          kind: "fillblank",
          prompt: "The four emphatic letters are ص ض ط ____.",
          blank: "ظ",
          en: "ẓāʾ",
          choices: ["ذ", "ز", "ظ", "ع"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L2.3",
      levelId: "L2",
      order: 3,
      title: "ʿAyn, Ghayn — the Pharyngeal & Uvular Pair",
      subtitle: "The two sounds English speakers fear most (and then love)",
      theme: "pronunciation",
      estimatedMinutes: 40,
      xp: 80,
      prerequisites: ["L2.2"],
      summary: "ع and غ — the sounds that separate fluent learners from casual ones.",
      wrapUp: "ع and غ both take practice. Most learners need weeks — not hours — to nail them. Don't be discouraged if today's attempts don't land. Awareness is the first 80%.",
      activities: [
        {
          kind: "info",
          title: "ع — ʿayn",
          body:
            "ʿayn is a VOICED PHARYNGEAL FRICATIVE. It has no English equivalent — not because it's exotic, but because English phonology stops at the top of the throat.\n\n" +
            "Production:\n" +
            "  1. Place your hand on your throat at the level of your Adam's apple.\n" +
            "  2. Squeeze the pharynx — you'll feel the tissue narrow.\n" +
            "  3. Voice it — not breathy like H, but with vocal cord vibration.\n" +
            "  4. The result is a slightly strained, voiced 'ahhh' that sounds like you're carrying weight.\n\n" +
            "It is NOT:\n" +
            "  • The English 'a' sound\n" +
            "  • A glottal stop (that's hamza, ء)\n" +
            "  • Silent\n\n" +
            "In transliteration, ʿayn is written ʿ or ' (apostrophe). The famous name 'Ali is actually ʿAlī (عَلي), and that initial sound — the heavy catch at the start — is ʿayn.\n\n" +
            "A classical poet (al-Jāḥiẓ, 9th c.) wrote that ʿayn is the 'easiest letter for Arabs, the hardest for everyone else.' He wasn't wrong.",
          tip: "Training exercise: pretend you're being gently strangled and try to say 'aaah'. That strained, throat-constricted 'aaah' is close to ʿayn.",
        },
        {
          kind: "info",
          title: "غ — ghayn",
          body:
            "ghayn is a VOICED VELAR/UVULAR FRICATIVE. Same body as ʿayn, with one dot added above.\n\n" +
            "Production:\n" +
            "  1. Start from خāʾ (the 'kh' in Bach — voiceless).\n" +
            "  2. Add voicing (vocal cords vibrate).\n" +
            "  3. Result: a sound like GARGLING water, or the French 'r' in 'rouge', or the Parisian 'r' in 'Paris'.\n\n" +
            "English has no exact equivalent, but if you can do a French or German uvular 'r', you can do ghayn.\n\n" +
            "Relationship to ʿayn: \n" +
            "  • ع — lower, pharynx, 'strained'\n" +
            "  • غ — higher, back of soft palate, 'gargling'\n" +
            "They share a body and a dot-difference. They do NOT share an articulation point. Don't merge them in your head.",
          showcase: [
            { ar: "ع", translit: "ʿayn", en: "voiced pharyngeal fricative" },
            { ar: "غ", translit: "ghayn", en: "voiced uvular fricative (gargle)" },
            { ar: "عَلي", translit: "ʿAlī", en: "Ali (name)" },
            { ar: "عَرَبي", translit: "ʿarabī", en: "Arabic / Arab" },
            { ar: "عِلم", translit: "ʿilm", en: "knowledge / science" },
            { ar: "مَعَ", translit: "maʿa", en: "with" },
            { ar: "غَداً", translit: "ghadan", en: "tomorrow" },
            { ar: "لُغة", translit: "lugha", en: "language" },
            { ar: "غُرفة", translit: "ghurfa", en: "room" },
          ],
        },
        {
          kind: "info",
          title: "The throat letters — a summary",
          body:
            "Arabic has SIX 'throat letters' (ḥurūf al-ḥalq) grouped by articulation depth:\n\n" +
            "  Deepest (glottis):     ء  ه\n" +
            "  Middle (pharynx):       ع  ح\n" +
            "  Highest (soft palate):  غ  خ\n\n" +
            "At each depth, one is VOICED and one is UNVOICED:\n\n" +
            "                          Voiceless    Voiced\n" +
            "  Glottis:                 ه            ء  (functional voicing varies)\n" +
            "  Pharynx:                 ح            ع\n" +
            "  Velar/Uvular:            خ            غ\n\n" +
            "If you can physically feel the three zones, you've grasped the Arabic throat system. Most adult English speakers need 1–3 months of attentive practice before ع comes out naturally.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ع",
          question: "Which letter, and what's its articulation point?",
          choices: [
            "ghayn — velar / uvular",
            "ḥāʾ — pharynx, voiceless",
            "ʿayn — pharynx, VOICED",
            "hamza — glottal stop",
          ],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "غ",
          question: "Which letter?",
          choices: ["ʿayn", "ghayn", "qāf", "khāʾ"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The name 'Ali' (عَلي) begins with which letter?",
          choices: ["alif — just a long ā", "ʿayn — voiced pharyngeal", "hamza — glottal stop", "hāʾ — light h"],
          correctIndex: 1,
          explain: "Ali is properly ʿAlī — beginning with ʿayn, not a plain vowel.",
        },
        {
          kind: "mcq",
          question: "Which French or German sound is closest to Arabic غ (ghayn)?",
          choices: [
            "French 'r' in 'rouge' — uvular r",
            "French 'u' in 'tu'",
            "German 'ö'",
            "German 'ch' in 'ich'",
          ],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "Which three pairs are the 'throat letters' of Arabic?",
          choices: [
            "ا / ي / و",
            "ب / م / ف",
            "ء-ه / ع-ح / غ-خ",
            "ص-ض / ط-ظ / س-ش",
          ],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match letter to articulation zone",
          pairs: [
            { ar: "ع", en: "pharynx, voiced" },
            { ar: "ح", en: "pharynx, voiceless" },
            { ar: "غ", en: "velar/uvular, voiced" },
            { ar: "خ", en: "velar/uvular, voiceless" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "عَرَبي", en: "Arabic / Arab" },
            { ar: "عِلم", en: "knowledge" },
            { ar: "مَعَ", en: "with" },
            { ar: "لُغة", en: "language" },
            { ar: "غَداً", en: "tomorrow" },
            { ar: "غُرفة", en: "room" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of عَرَبي (Arabic).",
          expected: "arabi",
          altAccepted: ["ʿarabī", "'arabi", "'arabiyy"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of لُغة (language).",
          expected: "lugha",
        },
        {
          kind: "fillblank",
          prompt: "____ is produced at the pharynx with voicing — a strained 'ahhh' sound.",
          blank: "ʿayn",
          en: "ʿayn",
          choices: ["hamza", "ʿayn", "ghayn", "khāʾ"],
          correctIndex: 1,
        },
      ],
    },

    {
      id: "L2.4",
      levelId: "L2",
      order: 4,
      title: "Fāʾ, Qāf",
      subtitle: "F, and the uvular K that became a dialect marker",
      theme: "alphabet",
      estimatedMinutes: 30,
      xp: 60,
      prerequisites: ["L2.3"],
      summary: "ف ق — and the single letter that reveals where someone is from.",
      wrapUp: "ق is geographically informative: its pronunciation often reveals an Arab's country.",
      activities: [
        {
          kind: "info",
          title: "ف — fāʾ",
          body:
            "A circle with a stroke — distinctive body.\n\n" +
            "  ف — fāʾ → 'f' (voiceless labiodental fricative — like English 'f')\n\n" +
            "No surprises. Identical to English 'f'.\n\n" +
            "Note: classical Arabic has NO letter for 'p' or 'v'. Modern loanwords tend to use ب for 'p' and ف for 'v', though modified letters (پ, ڤ) exist in Persian/Urdu loans. In fuṣḥā, if you see 'Paris', it's written باريس (Bārīs, pronounced with 'b').",
        },
        {
          kind: "info",
          title: "ق — qāf",
          body:
            "Body resembles ف (one dot above) but with TWO dots above.\n\n" +
            "  ق — qāf → voiceless UVULAR stop — a 'k' produced at the very back of the throat, near where غ lives.\n\n" +
            "Formation: say 'k' as far back as you can — at the uvula (the little hanging tissue at the back of your mouth). Your tongue root presses back. The sound is a darker, deeper 'k' than English.\n\n" +
            "Minimal pair with ك (kāf — regular k, Level 2.5):\n" +
            "  كَلب (kalb) — dog       vs   قَلب (qalb) — heart\n" +
            "  كَدَر (kadar) — dullness vs   قَدَر (qadar) — fate\n\n" +
            "DIALECT NOTE: qāf is one of the most geographically variable letters:\n" +
            "  • Classical / Gulf / Saudi rural: deep uvular 'q'\n" +
            "  • Cairo / urban Egypt / Beirut urban: dropped to glottal stop (قلب sounds like 'ʾalb')\n" +
            "  • Levantine rural / Bedouin: pronounced 'g' (قلب → 'galb')\n" +
            "  • Moroccan / North African: varies — sometimes 'g', sometimes 'q'\n\n" +
            "In MSA (what you're learning), always the classical deep 'q'. If you listen to Arab speakers and one says 'ʾahwa' for قهوة (coffee), that's Cairene. Same word, different ق.",
          showcase: [
            { ar: "ف", translit: "fāʾ", en: "f" },
            { ar: "ق", translit: "qāf", en: "uvular k" },
            { ar: "قَلب", translit: "qalb", en: "heart" },
            { ar: "قُرآن", translit: "Qurʾān", en: "Qurʾān (the recitation)" },
            { ar: "قَهوة", translit: "qahwa", en: "coffee (→ English 'coffee')" },
            { ar: "فَم", translit: "fam", en: "mouth" },
            { ar: "فِي", translit: "fī", en: "in" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ف",
          question: "Which letter?",
          choices: ["qāf", "fāʾ", "thāʾ", "dhāl"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ق",
          question: "Which letter, and where is it produced?",
          choices: [
            "kāf — front of the soft palate (regular k)",
            "qāf — uvula, deep back of throat",
            "khāʾ — velar fricative",
            "ghayn — voiced velar fricative",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "قَلب means 'heart'. What does كَلب mean?",
          choices: ["Heart (same)", "Dog", "Sun", "Pen"],
          correctIndex: 1,
          explain: "qalb = heart, kalb = dog. Mixing ق and ك is a classic embarrassment for learners.",
        },
        {
          kind: "mcq",
          question: "In urban Cairo, قَهوة (coffee) is commonly pronounced:",
          choices: ["qahwa — classical uvular q", "ʾahwa — glottal stop", "gahwa — hard g", "All three are used"],
          correctIndex: 1,
          explain: "Cairene Arabic drops the q to a glottal stop. Same word — different local sound.",
        },
        {
          kind: "mcq",
          question: "Arabic has no native letter for which of these English sounds?",
          choices: ["'b'", "'p'", "'m'", "'f'"],
          correctIndex: 1,
          explain: "Arabic lacks 'p' and 'v'. Loanwords approximate with ب and ف respectively. (Persian/Urdu use modified letters پ and ڤ.)",
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "قَلب", en: "heart" },
            { ar: "قَهوة", en: "coffee" },
            { ar: "قُرآن", en: "Qurʾān" },
            { ar: "فَم", en: "mouth" },
            { ar: "فِي", en: "in" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of قَلب (heart).",
          expected: "qalb",
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of قَهوة (coffee).",
          expected: "qahwa",
        },
        {
          kind: "fillblank",
          prompt: "ق is produced at the ____ — behind where ك sits.",
          blank: "uvula",
          en: "uvula / deep back of throat",
          choices: ["lips", "teeth", "uvula", "tip of the tongue"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L2.5",
      levelId: "L2",
      order: 5,
      title: "Kāf, Lām, Mīm, Nūn",
      subtitle: "The four most frequent consonants in Arabic",
      theme: "alphabet",
      estimatedMinutes: 35,
      xp: 65,
      prerequisites: ["L2.4"],
      summary: "ك ل م ن — you'll see these in most sentences you encounter.",
      wrapUp: "The special ligature لا (lā, 'no') is the most common two-letter combination in Arabic. Your eye will start picking it out automatically.",
      activities: [
        {
          kind: "info",
          title: "ك — kāf",
          body:
            "Distinctive shape in isolated form — like a tall 'L' with a hat.\n\n" +
            "  ك — kāf → 'k' (voiceless velar stop, same as English 'k')\n\n" +
            "Classical cousin to ق (qāf) but produced forward in the mouth. Always pronounced like English 'k'.\n\n" +
            "Kāf is a very common ROOT letter — it's in كِتاب (book), كُلّ (all), مَلِك (king), شُكراً (thanks), and many more.",
        },
        {
          kind: "info",
          title: "ل — lām",
          body:
            "A simple vertical stroke with a curved tail.\n\n" +
            "  ل — lām → 'l' (voiced alveolar lateral, like English 'l')\n\n" +
            "Lām is the consonant in the definite article الـ (al-, 'the'). Almost every noun you'll meet uses this.\n\n" +
            "Special combination: when lām is followed by alif, they MERGE into a single ligature:\n" +
            "  ل + ا = لا\n" +
            "This ligature is pronounced 'lā' and means 'no' / 'not'. You'll see لا constantly — recognize it as a unit, not two letters.",
          showcase: [
            { ar: "لا", translit: "lā", en: "no / not — the ل+ا ligature" },
            { ar: "لَيل", translit: "layl", en: "night" },
            { ar: "لُغة", translit: "lugha", en: "language" },
          ],
        },
        {
          kind: "info",
          title: "م — mīm",
          body:
            "A small circle with a descending tail.\n\n" +
            "  م — mīm → 'm' (voiced bilabial nasal, like English 'm')\n\n" +
            "Mīm is everywhere. It serves as:\n" +
            "  • The letter in thousands of vocabulary words\n" +
            "  • A PREFIX for nouns derived from verbs (maktab 'office' ← k-t-b root; madkhal 'entrance' ← d-kh-l)\n" +
            "  • A PREFIX for present-tense passive participles\n\n" +
            "When you see مـ at the start of a noun, there's a >50% chance it's a derived noun of the form maFʿaL or muFaʿʿiL. We'll formalize this in Level 8.",
        },
        {
          kind: "info",
          title: "ن — nūn",
          body:
            "A deep bowl shape with ONE dot above.\n\n" +
            "  ن — nūn → 'n' (voiced alveolar nasal, like English 'n')\n\n" +
            "Don't confuse nūn with ت or ث — they share a bowl-ish body. The trick:\n" +
            "  • In ISOLATED form, nūn's bowl is deep (descends below the baseline).\n" +
            "  • ت ث have a shallow boat that sits ON the baseline.\n" +
            "  • In INITIAL/MEDIAL position, all three look similar (a tooth), so only dots distinguish: 1 above = ن, 2 above = ت, 3 above = ث, 1 below = ب.\n\n" +
            "Nūn appears as a SUFFIX:\n" +
            "  • Plural verb endings (yaktubūn 'they write')\n" +
            "  • Feminine plural markers in some cases\n" +
            "  • Tanwīn (indefinite noun ending) sounds 'an/in/un' even though it's written as doubled harakat (we'll see this in Level 3).",
          showcase: [
            { ar: "ك", translit: "kāf", en: "k" },
            { ar: "ل", translit: "lām", en: "l" },
            { ar: "م", translit: "mīm", en: "m" },
            { ar: "ن", translit: "nūn", en: "n" },
            { ar: "كِتاب", translit: "kitāb", en: "book" },
            { ar: "مَلِك", translit: "malik", en: "king" },
            { ar: "نَهْر", translit: "nahr", en: "river" },
            { ar: "مَكتَب", translit: "maktab", en: "office / desk" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ك",
          question: "Which letter?",
          choices: ["qāf (deep k)", "kāf (regular k)", "lām (l)", "fāʾ (f)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ل",
          question: "Which letter?",
          choices: ["alif", "lām", "kāf", "nūn"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "م",
          question: "Which letter?",
          choices: ["mīm", "nūn", "lām", "fāʾ"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          arabicPrompt: "ن",
          question: "Which letter?",
          choices: ["tāʾ (2 dots above)", "thāʾ (3 dots above)", "nūn (1 dot above, deep bowl)", "bāʾ (1 dot below)"],
          correctIndex: 2,
          explain: "In isolated form, nūn's bowl descends below the baseline — that descending depth plus the single upper dot is the identifier.",
        },
        {
          kind: "mcq",
          arabicPrompt: "لا",
          question: "This ligature is read as:",
          choices: ["'ila' — 'to'", "'lā' — 'no / not'", "'al' — 'the'", "'na' — negation suffix"],
          correctIndex: 1,
          explain: "ل + ا merge to لا = 'lā'. You'll see this combo in almost every paragraph you read.",
        },
        {
          kind: "match",
          prompt: "Match letter to sound",
          pairs: [
            { ar: "ك", en: "k" },
            { ar: "ل", en: "l" },
            { ar: "م", en: "m" },
            { ar: "ن", en: "n" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "كِتاب", en: "book" },
            { ar: "مَلِك", en: "king" },
            { ar: "نَهْر", en: "river" },
            { ar: "مَكتَب", en: "office / desk" },
            { ar: "لَيل", en: "night" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of كِتاب (book).",
          expected: "kitab",
          altAccepted: ["kitāb", "kitaab"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَكتَب (office).",
          expected: "maktab",
        },
        {
          kind: "fillblank",
          prompt: "A مـ prefix on a noun (like مَكتَب maktab) often indicates the noun is ____.",
          blank: "derived from a 3-letter verb root",
          en: "derived from a 3-letter verb root (maFʿaL noun pattern)",
          choices: [
            "a proper name",
            "a loan word",
            "derived from a 3-letter verb root (place/instrument)",
            "feminine",
          ],
          correctIndex: 2,
          explain: "The maFʿaL pattern makes 'place of' nouns from roots. k-t-b → maktab (place of writing, office). d-kh-l → madkhal (place of entering).",
        },
      ],
    },

    {
      id: "L2.6",
      levelId: "L2",
      order: 6,
      title: "Hāʾ, Wāw, Yāʾ + Hamza",
      subtitle: "The last three letters and the glottal stop",
      theme: "alphabet",
      estimatedMinutes: 40,
      xp: 75,
      prerequisites: ["L2.5"],
      summary: "ه و ي — plus ء (hamza). And: why و and ي act as both consonants AND long vowels.",
      wrapUp: "Every letter is now accounted for. Next level: putting vowels on them and actually reading words.",
      activities: [
        {
          kind: "info",
          title: "ه — hāʾ (the light h)",
          body:
            "Distinctive body — a small rounded shape. VERY different forms depending on position:\n  Isolated: ه   Initial: هـ   Medial: ـهـ   Final after connector: ـه\n\n" +
            "  ه — hāʾ → light 'h' (voiceless glottal fricative, like English 'h' in 'hello')\n\n" +
            "NOT to be confused with ح (ḥāʾ, the pharyngeal H from Level 1). Rule of thumb:\n" +
            "  • ه is like English 'h'. If you can say 'hello', you can say ه.\n" +
            "  • ح is deeper, in the pharynx. You had to learn it deliberately.",
        },
        {
          kind: "info",
          title: "Tāʾ marbūṭa — ة",
          body:
            "A special variant of ه called tāʾ marbūṭa ('tied tāʾ'). It looks like ه with two dots above:\n\n" +
            "  ة\n\n" +
            "Appears ONLY at the END of a word, and ONLY on feminine-gender nouns and adjectives.\n\n" +
            "How it's pronounced:\n" +
            "  • Alone or at the end of a sentence: silent, or pronounced as a soft 'h'.\n" +
            "  • Before a word that continues: pronounced 't'.\n\n" +
            "This letter is the almost-infallible MARKER of feminine gender in Arabic. If a noun ends in ة, assume it's feminine until proven otherwise. Examples:\n" +
            "  مَدينة (madīna) — city (feminine)\n" +
            "  مُدَرِّسة (mudarrisa) — female teacher\n" +
            "  سَيّارة (sayyāra) — car (feminine)",
          showcase: [
            { ar: "ه", translit: "hāʾ", en: "light h" },
            { ar: "ة", translit: "tāʾ marbūṭa", en: "silent/t — feminine marker" },
            { ar: "هُوَ", translit: "huwa", en: "he" },
            { ar: "هِيَ", translit: "hiya", en: "she" },
            { ar: "مَدينة", translit: "madīna", en: "city" },
            { ar: "سَيّارة", translit: "sayyāra", en: "car" },
          ],
        },
        {
          kind: "info",
          title: "و — wāw (a hybrid letter)",
          body:
            "A loop with a tail, distinctive. Non-connector.\n\n" +
            "  و — wāw has TWO jobs:\n" +
            "    1. As a CONSONANT: 'w' (like English 'w' in 'water').\n" +
            "    2. As a LONG VOWEL: 'ū' (long 'oo', when preceded by a letter with ḍamma).\n\n" +
            "Context decides. If the previous letter has a ḍamma (ـُ), و extends it into a long 'ū'. Otherwise, و is pronounced as 'w'.\n\n" +
            "Examples:\n" +
            "  وَلَد (walad) — boy        → و is 'w'\n" +
            "  نُور (nūr) — light        → و is long 'ū'\n" +
            "  سُوق (sūq) — market       → و is long 'ū'\n" +
            "  يَوم (yawm) — day          → و is 'w' (as part of diphthong 'aw')\n\n" +
            "و is also the standalone word 'and': وَ (wa).",
          showcase: [
            { ar: "و", translit: "wāw", en: "w / long ū" },
            { ar: "وَلَد", translit: "walad", en: "boy" },
            { ar: "نُور", translit: "nūr", en: "light" },
            { ar: "سُوق", translit: "sūq", en: "market / souk" },
            { ar: "يَوم", translit: "yawm", en: "day" },
          ],
        },
        {
          kind: "info",
          title: "ي — yāʾ (another hybrid)",
          body:
            "A bowl shape with TWO dots below.\n\n" +
            "  ي — yāʾ has TWO jobs:\n" +
            "    1. As a CONSONANT: 'y' (like English 'y' in 'yes').\n" +
            "    2. As a LONG VOWEL: 'ī' (long 'ee', when preceded by a letter with kasra).\n\n" +
            "Examples:\n" +
            "  يَد (yad) — hand             → ي is 'y'\n" +
            "  بَيت (bayt) — house          → ي is 'y' (as part of diphthong 'ay')\n" +
            "  فِي (fī) — in                → ي is long 'ī'\n" +
            "  كَبير (kabīr) — big           → ي is long 'ī'\n\n" +
            "Alef alif (ا) + و (wāw) + ي (yāʾ) are the three 'weak letters'. They're the three letters that can function as long vowels, and they behave specially in verb conjugations (we'll see 'weak verbs' in later grammar).",
        },
        {
          kind: "info",
          title: "ء — hamza (the glottal stop)",
          body:
            "Hamza is technically a letter in the Arabic phonological system, even though it's written as a diacritic-like mark. It represents a GLOTTAL STOP — a brief closure of the vocal cords, like the catch in 'uh-oh'.\n\n" +
            "Hamza can be:\n" +
            "  1. Written alone on the baseline: ء\n" +
            "  2. Carried by a seat letter depending on surrounding vowels:\n" +
            "     • أ — alif seat (for 'a' or 'u' vowels around it)\n" +
            "     • إ — alif-with-hamza-below (for 'i' vowel)\n" +
            "     • ؤ — wāw seat (for 'u' vowels)\n" +
            "     • ئ — yāʾ seat (for 'i' vowels)\n\n" +
            "Which seat gets used follows complex rules about the surrounding vowels. Don't memorize these now — you'll absorb the patterns by exposure.\n\n" +
            "Examples:\n" +
            "  أَنا (anā) — I\n" +
            "  إِسلام (Islām) — Islam (with alif-below)\n" +
            "  سَماء (samāʾ) — sky (standalone hamza at end)\n" +
            "  سَأَلَ (saʾala) — he asked",
          showcase: [
            { ar: "ء", translit: "hamza", en: "glottal stop" },
            { ar: "أَنا", translit: "anā", en: "I" },
            { ar: "إِسلام", translit: "Islām", en: "Islam" },
            { ar: "سَماء", translit: "samāʾ", en: "sky" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ه",
          question: "Which letter?",
          choices: ["ḥāʾ (pharyngeal H)", "hāʾ (light h)", "hamza (glottal stop)", "khāʾ (velar kh)"],
          correctIndex: 1,
          explain: "ه is the LIGHT h — English 'h'. The pharyngeal H (ح) is a different letter entirely.",
        },
        {
          kind: "mcq",
          arabicPrompt: "ة",
          question: "This is tāʾ marbūṭa. What does it mark?",
          choices: [
            "Masculine gender",
            "Feminine gender — almost always",
            "Plural number",
            "Past tense",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In which of these does و function as a LONG VOWEL ('ū'), not the consonant 'w'?",
          choices: [
            "وَلَد (walad) — boy",
            "نُور (nūr) — light",
            "يَوم (yawm) — day",
            "وَ — 'and'",
          ],
          correctIndex: 1,
          explain: "The ḍamma on نـ (nu-) extends through و into a long 'ū'. The others use و as a consonant 'w'.",
        },
        {
          kind: "mcq",
          question: "In which of these does ي function as a LONG VOWEL ('ī')?",
          choices: [
            "يَد (yad) — hand",
            "بَيت (bayt) — house",
            "فِي (fī) — in",
            "None — ي is always a consonant",
          ],
          correctIndex: 2,
          explain: "The kasra on فـ (fi-) extends through ي into a long 'ī'. In yad and bayt, ي is the consonant 'y'.",
        },
        {
          kind: "mcq",
          question: "Hamza (ء) represents:",
          choices: [
            "A long ā vowel",
            "A glottal stop — the catch in the throat",
            "A silent letter used for spacing",
            "The number one",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "The THREE 'weak letters' that can double as long vowels are:",
          choices: ["ا و ي", "ه و ي", "ب م ف", "ع ح غ"],
          correctIndex: 0,
          explain: "alif, wāw, yāʾ — they're 'weak' because in verb conjugations they often drop out or transform.",
        },
        {
          kind: "match",
          prompt: "Match letter to role",
          pairs: [
            { ar: "ه", en: "light h (English h)" },
            { ar: "ة", en: "feminine marker (silent or t)" },
            { ar: "و", en: "w / long ū" },
            { ar: "ي", en: "y / long ī" },
            { ar: "ء", en: "glottal stop (hamza)" },
          ],
        },
        {
          kind: "match",
          prompt: "Match word to meaning",
          pairs: [
            { ar: "هُوَ", en: "he" },
            { ar: "هِيَ", en: "she" },
            { ar: "مَدينة", en: "city" },
            { ar: "سَيّارة", en: "car" },
            { ar: "نُور", en: "light" },
            { ar: "سُوق", en: "market" },
            { ar: "بَيت", en: "house" },
            { ar: "سَماء", en: "sky" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of مَدينة (city).",
          expected: "madina",
          altAccepted: ["madīna", "madeena"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of سَيّارة (car).",
          expected: "sayyara",
          altAccepted: ["sayyāra"],
        },
        {
          kind: "typing",
          prompt: "Type the transliteration of سَماء (sky).",
          expected: "samaa",
          altAccepted: ["samāʾ", "sama'", "sama"],
        },
      ],
    },

    {
      id: "L2.7",
      levelId: "L2",
      order: 7,
      title: "Level 2 Review — All 28 Letters",
      subtitle: "Full alphabet stress test",
      theme: "review",
      estimatedMinutes: 40,
      xp: 130,
      prerequisites: ["L2.1", "L2.2", "L2.3", "L2.4", "L2.5", "L2.6"],
      summary: "A real diagnostic. If you can pass this without guessing, the alphabet is yours.",
      wrapUp: "The alphabet is behind you. What's ahead: harakat (vowel marks), reading real words end-to-end, and the beginning of grammar.",
      activities: [
        {
          kind: "info",
          title: "Full alphabet — reference",
          body:
            "In traditional order:\n\n" +
            "  ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي\n\n" +
            "Non-connectors (6): ا د ذ ر ز و\n\n" +
            "Emphatic family (4): ص ض ط ظ\n\n" +
            "Throat letters (6): ء ه ع ح غ خ  (glottal / pharyngeal / velar)\n\n" +
            "Hybrid (letter + long vowel) (3): ا و ي\n\n" +
            "Special forms:\n" +
            "  ة (tāʾ marbūṭa) — feminine ending\n" +
            "  ء أ إ ؤ ئ — hamza and its seats\n" +
            "  لا — lām+alif ligature\n\n" +
            "Run the flashcards once if you're rusty, then move to the scored questions.",
        },
        {
          kind: "flashcard",
          prompt: "Full alphabet flashcard drill",
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
            { ar: "س", translit: "sīn", en: "s (light)" },
            { ar: "ش", translit: "shīn", en: "sh" },
            { ar: "ص", translit: "ṣād", en: "heavy s" },
            { ar: "ض", translit: "ḍād", en: "heavy d" },
            { ar: "ط", translit: "ṭāʾ", en: "heavy t" },
            { ar: "ظ", translit: "ẓāʾ", en: "heavy dh" },
            { ar: "ع", translit: "ʿayn", en: "voiced pharyngeal" },
            { ar: "غ", translit: "ghayn", en: "voiced velar (gargle)" },
            { ar: "ف", translit: "fāʾ", en: "f" },
            { ar: "ق", translit: "qāf", en: "uvular k" },
            { ar: "ك", translit: "kāf", en: "k (regular)" },
            { ar: "ل", translit: "lām", en: "l" },
            { ar: "م", translit: "mīm", en: "m" },
            { ar: "ن", translit: "nūn", en: "n" },
            { ar: "ه", translit: "hāʾ", en: "light h" },
            { ar: "و", translit: "wāw", en: "w / long ū" },
            { ar: "ي", translit: "yāʾ", en: "y / long ī" },
          ],
        },
        {
          kind: "mcq",
          arabicPrompt: "ض",
          question: "Which letter?",
          choices: ["dāl", "dhāl", "ḍād", "ẓāʾ"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ع",
          question: "Which letter?",
          choices: ["ghayn", "ʿayn", "ḥāʾ", "hāʾ"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          arabicPrompt: "ق",
          question: "Which letter?",
          choices: ["fāʾ", "kāf", "qāf", "ghayn"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "ظ",
          question: "Which letter?",
          choices: ["ṭāʾ (heavy t)", "ẓāʾ (heavy dh)", "ḍād (heavy d)", "dhāl (light th)"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Which pair is an EMPHATIC / LIGHT contrast?",
          choices: ["ت vs د", "ص vs س", "ش vs ج", "ب vs ف"],
          correctIndex: 1,
          explain: "ص (heavy s) vs س (light s). The other emphatic pairs are ض/د, ط/ت, ظ/ذ.",
        },
        {
          kind: "mcq",
          question: "Which letter in isolated form is produced DEEPEST in the throat?",
          choices: ["ه", "ح", "ع", "غ"],
          correctIndex: 2,
          explain: "ع — voiced pharyngeal. ح is same zone but voiceless. غ and خ are higher (velar). ه is glottal (top).",
        },
        {
          kind: "mcq",
          question: "A word ends in ة (tāʾ marbūṭa). What do you conclude?",
          choices: [
            "The word is a verb",
            "The word is almost certainly FEMININE",
            "The word is plural",
            "The word is a loan word",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "Hamza (ء) is:",
          choices: [
            "A long vowel marker",
            "A glottal stop",
            "The Arabic equivalent of a period",
            "Silent everywhere",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "How many non-connector letters are there?",
          choices: ["4", "5", "6", "8"],
          correctIndex: 2,
          explain: "Six: ا د ذ ر ز و.",
        },
        {
          kind: "match",
          prompt: "Match letter to its sound",
          pairs: [
            { ar: "ق", en: "uvular k (deep)" },
            { ar: "ك", en: "regular k" },
            { ar: "ع", en: "voiced pharyngeal" },
            { ar: "غ", en: "voiced velar (gargle)" },
            { ar: "ف", en: "f" },
            { ar: "ه", en: "light h" },
            { ar: "و", en: "w / long ū" },
            { ar: "ي", en: "y / long ī" },
            { ar: "ص", en: "heavy s" },
            { ar: "ض", en: "heavy d" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the name of the letter ع.",
          expected: "ayn",
          altAccepted: ["ʿayn", "'ayn"],
        },
        {
          kind: "typing",
          prompt: "Type the name of the letter غ.",
          expected: "ghayn",
        },
        {
          kind: "fillblank",
          prompt: "The letter pair with matched bodies but opposite voicing, pronounced at the PHARYNX, is ع (voiced) and ____ (voiceless).",
          blank: "ح (ḥāʾ)",
          en: "ḥāʾ",
          choices: ["ه (hāʾ)", "ح (ḥāʾ)", "خ (khāʾ)", "ء (hamza)"],
          correctIndex: 1,
        },
      ],
    },
  ],
};
