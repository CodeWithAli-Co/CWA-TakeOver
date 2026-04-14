// ============================================================================
// LEVEL 9 — Food, drink, ordering, and daily-life vocabulary
//
// Depth focus: rich food vocabulary, ordering and transaction language,
// polite request structures, and basic market/haggling phrases.
// ============================================================================

import type { Level } from "../types";

export const level9: Level = {
  id: "L9",
  order: 9,
  title: "Food, Drink & Daily Transactions",
  subtitle: "Functional Arabic for cafés, markets, and tables",
  theme: "food",
  goal: "Name common foods, order in a café or restaurant, handle basic transactions, and use polite request formulas.",
  lessons: [
    {
      id: "L9.1",
      levelId: "L9",
      order: 1,
      title: "Food Basics — Staples and Categories",
      subtitle: "Bread, rice, meat, fish, vegetables, fruit",
      theme: "food",
      estimatedMinutes: 35,
      xp: 80,
      prerequisites: ["L8.5"],
      summary: "The core vocabulary covers 80% of what's on any Arab menu.",
      wrapUp: "Food vocabulary is one of the most rewarding areas to study — every word has an immediate concrete use.",
      activities: [
        {
          kind: "info",
          title: "Grains and staples",
          body:
            "  خُبز (khubz) — bread (the word; various types exist)\n" +
            "  خُبز عَرَبي (khubz ʿarabī) — pita-style flatbread\n" +
            "  خُبز فَرَنسي (khubz faransī) — French bread / baguette\n" +
            "  أَرُزّ (aruzz) — rice\n" +
            "  مَعكَرونة (maʿkarūna) — pasta / macaroni\n" +
            "  دَقيق (daqīq) — flour\n\n" +
            "Bread note: 'khubz' is BASE bread. There are dozens of regional breads with their own names:\n" +
            "  • خُبز صاج (khubz ṣāj) — thin flatbread cooked on a convex griddle (Levantine)\n" +
            "  • خُبز طابون (khubz ṭābūn) — oven-baked flatbread\n" +
            "  • مَرقوق (marqūq) — very thin, almost tissue-paper-thin bread\n\n" +
            "Arab meals are often anchored by bread the way Western meals are by rice or potatoes. In many countries, eating with your hands using bread as a utensil is standard.",
          showcase: [
            { ar: "خُبز", translit: "khubz", en: "bread" },
            { ar: "أَرُزّ", translit: "aruzz", en: "rice" },
            { ar: "مَعكَرونة", translit: "maʿkarūna", en: "pasta" },
          ],
        },
        {
          kind: "info",
          title: "Proteins",
          body:
            "  لَحم (laḥm) — meat (generic, usually red meat unless specified)\n" +
            "  لَحم بَقَر (laḥm baqar) — beef (meat of cow)\n" +
            "  لَحم ضَأن (laḥm ḍaʾn) — lamb / mutton (meat of sheep)\n" +
            "  دَجاج (dajāj) — chicken\n" +
            "  سَمَك (samak) — fish\n" +
            "  جَمبَري (jambarī) — shrimp (loan from Persian)\n" +
            "  بَيض (bayḍ) — eggs\n" +
            "  كِبدة (kibda) — liver\n\n" +
            "Halal / haram: pork (لَحم خِنزير / laḥm khinzīr) is forbidden in Islamic dietary law, and you won't find it in most Arab-country supermarkets. In Christian-majority Arab communities (e.g., parts of Lebanon), pork is available but rarer than in the West.",
        },
        {
          kind: "info",
          title: "Vegetables, fruits, dairy",
          body:
            "VEGETABLES (خُضار, khuḍār):\n" +
            "  طَماطِم / بَندورة (ṭamāṭim / banadūra) — tomato (Gulf vs Levantine)\n" +
            "  بَصَل (baṣal) — onion\n" +
            "  ثوم (thūm) — garlic\n" +
            "  خِيار (khiyār) — cucumber\n" +
            "  بَطاطا / بَطاطِس (baṭāṭā / baṭāṭis) — potato (Levantine / Egyptian)\n" +
            "  جَزَر (jazar) — carrot\n" +
            "  فِلفِل (filfil) — pepper (bell or hot)\n\n" +
            "FRUITS (فَواكِه, fawākih):\n" +
            "  تُفّاح (tuffāḥ) — apple\n" +
            "  بُرتُقال (burtuqāl) — orange\n" +
            "  مَوز (mawz) — banana\n" +
            "  عِنَب (ʿinab) — grapes\n" +
            "  تِين (tīn) — figs\n" +
            "  رُمّان (rummān) — pomegranate\n" +
            "  تَمر (tamr) — dates (the fruit)\n\n" +
            "DAIRY:\n" +
            "  حَليب (ḥalīb) — milk\n" +
            "  لَبَن (laban) — yogurt (Levantine) / milk (Egyptian — same word, different referent!)\n" +
            "  جُبن (jubn) — cheese\n" +
            "  زُبدة (zubda) — butter\n" +
            "  قِشطة (qishṭa) — cream\n\n" +
            "The laban / ḥalīb distinction is a classic example of how dialects diverge. Levantine 'laban' = yogurt, Egyptian 'laban' = milk. When in doubt, specify: 'laban rāʾib' (curdled laban) = yogurt; 'laban ḥalīb' = (milk) milk.",
          showcase: [
            { ar: "خُبز", translit: "khubz", en: "bread" },
            { ar: "دَجاج", translit: "dajāj", en: "chicken" },
            { ar: "سَمَك", translit: "samak", en: "fish" },
            { ar: "تُفّاح", translit: "tuffāḥ", en: "apple" },
            { ar: "عِنَب", translit: "ʿinab", en: "grapes" },
            { ar: "تَمر", translit: "tamr", en: "dates" },
            { ar: "جُبن", translit: "jubn", en: "cheese" },
          ],
        },
        {
          kind: "info",
          title: "Traditional / iconic dishes",
          body:
            "Recognizing these words helps you parse a menu anywhere in the Arab world:\n\n" +
            "  حُمُّص (ḥummuṣ) — hummus (chickpea spread)\n" +
            "  فَلافِل (falāfil) — falafel (fried chickpea balls)\n" +
            "  شاوَرما (shāwarmā) — shawarma (spit-roasted meat)\n" +
            "  كُفتة (kufta) — kofta (seasoned ground meat, grilled)\n" +
            "  كَبَسة / كَبسَة (kabsa) — kabsa (rice dish with meat, Saudi/Gulf)\n" +
            "  مَنسَف (mansaf) — mansaf (rice + lamb + yogurt, Jordan)\n" +
            "  مُلوخِيَّة (mulūkhiyya) — mulukhiyah (stew made from jute mallow leaves)\n" +
            "  تَبّولة (tabbūla) — tabbouleh (parsley-bulgur salad)\n" +
            "  فَتّوش (fattūsh) — fattoush (salad with toasted bread)\n" +
            "  كُنافة (kunāfa) — kunafa (sweet dessert with cheese and syrup)\n" +
            "  بَقلاوة (baqlāwa) — baklava\n\n" +
            "Regional pride: Lebanese, Syrian, Palestinian, Jordanian, and Egyptian cuisines overlap heavily but each claims dishes as their own. Mansaf is Jordanian national dish; hummus has contested Lebanese/Palestinian/Israeli origin claims; shawarma originated in the Ottoman Empire.",
        },
        {
          kind: "mcq",
          question: "'khubz' means:",
          choices: ["rice", "meat", "bread", "cheese"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'dajāj' means:",
          choices: ["fish", "chicken", "beef", "duck"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "A Lebanese 'laban' is:",
          choices: ["milk", "yogurt", "cheese", "butter"],
          correctIndex: 1,
          explain: "In Levantine Arabic, laban = yogurt. In Egyptian, the same word = milk. Regional divergence.",
        },
        {
          kind: "mcq",
          question: "Which dish is the Jordanian national dish?",
          choices: ["shawarma", "mansaf", "falafel", "kunafa"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'laḥm ḍaʾn' means:",
          choices: ["chicken", "beef", "lamb / mutton", "fish"],
          correctIndex: 2,
          explain: "laḥm = meat; ḍaʾn = sheep. Together: lamb.",
        },
        {
          kind: "mcq",
          question: "Which IS halal (permitted in Islamic dietary law)?",
          choices: [
            "Pork (khinzīr)",
            "Chicken (dajāj)",
            "Alcohol (khamr)",
            "Blood",
          ],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match food to English",
          pairs: [
            { ar: "خُبز", en: "bread" },
            { ar: "أَرُزّ", en: "rice" },
            { ar: "لَحم", en: "meat" },
            { ar: "دَجاج", en: "chicken" },
            { ar: "سَمَك", en: "fish" },
            { ar: "بَيض", en: "eggs" },
            { ar: "تُفّاح", en: "apple" },
            { ar: "جُبن", en: "cheese" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'chicken' (transliteration).",
          expected: "dajaj",
          altAccepted: ["dajāj"],
        },
        {
          kind: "typing",
          prompt: "Type the word for 'fish' (transliteration).",
          expected: "samak",
        },
      ],
    },

    {
      id: "L9.2",
      levelId: "L9",
      order: 2,
      title: "Drinks, Tea Culture, and Hospitality",
      subtitle: "Coffee, tea, and the social meaning of a cup",
      theme: "food",
      estimatedMinutes: 30,
      xp: 75,
      prerequisites: ["L9.1"],
      summary: "Beverage vocabulary plus the cultural weight of offering tea or coffee to a guest.",
      wrapUp: "In Arab hospitality, refusing a first offer of tea or coffee is often read as cold. Offer, accept, and enjoy.",
      activities: [
        {
          kind: "info",
          title: "Core drinks",
          body:
            "  ماء (māʾ) — water\n" +
            "  شاي (shāy) — tea\n" +
            "  قَهوة (qahwa) — coffee (→ English 'coffee' ← 'qahwa')\n" +
            "  عَصير (ʿaṣīr) — juice\n" +
            "  عَصير بُرتُقال (ʿaṣīr burtuqāl) — orange juice\n" +
            "  حَليب (ḥalīb) — milk (as a drink)\n" +
            "  لَبَن (laban) — buttermilk / yogurt drink (Levantine) / milk (Egyptian)\n" +
            "  ماء مَعدَني (māʾ maʿdanī) — mineral water\n" +
            "  مَشروب غازي (mashrūb ghāzī) — soft drink (fizzy drink)\n" +
            "  بيرة (bīra) — beer (non-Muslim contexts, or non-alcoholic مُشروب خالي مِن الكُحول)\n" +
            "  نَبيذ (nabīdh) — wine\n\n" +
            "In most Arab countries, alcohol is restricted or unavailable in public (ḥarām in Islamic law). Non-alcoholic beer and malt drinks are common alternatives.",
        },
        {
          kind: "info",
          title: "Tea and coffee — the social centerpieces",
          body:
            "TEA (شاي / shāy) is drunk constantly across the Arab world. Typically:\n" +
            "  • Levantine & Egyptian: black tea with sugar, often with mint (شاي بالنَعنَع, shāy bin-naʿnaʿ)\n" +
            "  • Gulf: black tea with saffron and cardamom\n" +
            "  • Moroccan: green tea with mint and heavy sugar, poured ceremonially from height\n\n" +
            "COFFEE (قَهوة / qahwa) has regional meanings:\n" +
            "  • قَهوة عَرَبِيَّة (qahwa ʿarabiyya) — 'Arabic coffee': lightly roasted, cardamom-flavored, served in tiny cups. Traditional in the Gulf.\n" +
            "  • قَهوة تُركي (qahwa turkī) — 'Turkish coffee': thick, served with grounds, often unsweetened or with sugar boiled in.\n" +
            "  • قَهوة سادة (qahwa sāda) — 'plain coffee' — no sugar.\n" +
            "  • قَهوة مَزبوطة (qahwa mazbūṭa) — 'just right' — medium sugar.\n" +
            "  • قَهوة حِلوة (qahwa ḥilwa) — sweet.\n\n" +
            "Hospitality norm: offering tea or coffee to a guest is nearly mandatory. Refusing politely once is fine; refusing multiple times reads as rejection of the person. A traveler's rule: accept the first offer.",
          showcase: [
            { ar: "شاي بالنَعنَع", translit: "shāy bin-naʿnaʿ", en: "mint tea" },
            { ar: "قَهوة سادة", translit: "qahwa sāda", en: "coffee without sugar" },
            { ar: "قَهوة مَزبوطة", translit: "qahwa mazbūṭa", en: "coffee, medium sugar" },
            { ar: "عَصير بُرتُقال", translit: "ʿaṣīr burtuqāl", en: "orange juice" },
          ],
        },
        {
          kind: "info",
          title: "Etymology",
          body:
            "The Arabic contribution to the world's coffee vocabulary is enormous:\n\n" +
            "  قَهوة (qahwa) → Ottoman kahve → Italian caffè → English coffee / French café\n" +
            "  The word entered European languages via Ottoman Turkish after Turkish forces introduced coffee culture to Vienna in the 1680s (following the Ottoman siege).\n\n" +
            "Other drink vocabulary with Arabic roots:\n" +
            "  • 'syrup' ← شَراب (sharāb, 'drink')\n" +
            "  • 'sherbet' ← شَربة (sharba)\n" +
            "  • 'lemon' ← لَيمون (laymūn, via French 'limon')\n" +
            "  • 'apricot' ← بَرقوق (barqūq) / الخَوخ\n" +
            "  • 'orange' ← نارَنج (nāranj) ← Persian narang ← Sanskrit",
        },
        {
          kind: "mcq",
          question: "'shāy' means:",
          choices: ["tea", "coffee", "water", "juice"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'qahwa mazbūṭa' is:",
          choices: [
            "Coffee without sugar",
            "Coffee with medium sugar",
            "Coffee with extra sugar",
            "Decaf coffee",
          ],
          correctIndex: 1,
          explain: "mazbūṭa = 'just right' / 'measured'. Medium sugar — typical default order.",
        },
        {
          kind: "mcq",
          question: "The English word 'coffee' traces to Arabic:",
          choices: ["شاي", "قَهوة", "عَصير", "ماء"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "In many Arab cultures, refusing a guest's first offer of tea/coffee reads as:",
          choices: [
            "Proper modesty",
            "Cold / a rejection of the host",
            "Good manners",
            "A signal that you're busy",
          ],
          correctIndex: 1,
          explain: "Hospitality norms expect acceptance. Refusing politely once can be OK but is often awkward.",
        },
        {
          kind: "match",
          prompt: "Match drink to English",
          pairs: [
            { ar: "ماء", en: "water" },
            { ar: "شاي", en: "tea" },
            { ar: "قَهوة", en: "coffee" },
            { ar: "عَصير", en: "juice" },
            { ar: "حَليب", en: "milk" },
            { ar: "نَبيذ", en: "wine" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'mint tea' (shāy bin-naʿnaʿ) — transliteration.",
          expected: "shay bin-nanaa",
          altAccepted: [
            "shāy bin-naʿnaʿ",
            "shay bi naana",
            "shay naana",
            "shay naanaa",
            "shay bel nanaa",
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for 'water' (transliteration).",
          expected: "ma",
          altAccepted: ["māʾ", "maa", "ma'"],
        },
      ],
    },

    {
      id: "L9.3",
      levelId: "L9",
      order: 3,
      title: "Ordering — 'I'd like…' and Transaction Phrases",
      subtitle: "Politely asking, paying, and thanking",
      theme: "food",
      estimatedMinutes: 35,
      xp: 85,
      prerequisites: ["L9.2"],
      summary: "The phrases you need in any café or restaurant across the Arab world.",
      wrapUp: "With these phrases you can order, negotiate, and close a transaction. Level 9 is about real-world functionality.",
      activities: [
        {
          kind: "info",
          title: "The core ordering phrases",
          body:
            "  أُريدُ (urīdu) — I want\n" +
            "  مِن فَضلِك (min faḍlik) — please (to a man)\n" +
            "  مِن فَضلِكِ (min faḍliki) — please (to a woman)\n" +
            "  لَو سَمَحت (law samaḥt) — if you'll permit / excuse me (more polite; m)\n" +
            "  لَو سَمَحتِ (law samaḥti) — same, to a woman\n\n" +
            "Sample orders:\n" +
            "  أُريدُ قَهوة، مِن فَضلِك. (urīdu qahwa, min faḍlik) — I'd like coffee, please.\n" +
            "  أَشتَهي شاي. (ashtahī shāy) — I'd enjoy/crave tea.\n" +
            "  هَل يُمكِن ... (hal yumkin …) — Is it possible [to] …\n" +
            "  هَل عِندَكُم ... (hal ʿindakum …) — Do you (pl) have …\n" +
            "  أُعطيني ... (uʿṭīnī …) — Give me … (functional, slightly abrupt)\n\n" +
            "'Please' has an additional register:\n" +
            "  • min faḍlik — 'from your grace' → please (everyday)\n" +
            "  • law samaḥt — 'if you'll allow' → more polite; good for first requests\n" +
            "  • mumkin — 'is it possible' → soft question, e.g., 'mumkin qahwa?' ('could I have coffee?')",
          showcase: [
            { ar: "أُريدُ قَهوة", translit: "urīdu qahwa", en: "I'd like coffee" },
            { ar: "مِن فَضلِك", translit: "min faḍlik", en: "please (m)" },
            { ar: "لَو سَمَحت", translit: "law samaḥt", en: "excuse me, if you'd allow (m)" },
            { ar: "مُمكِن شاي؟", translit: "mumkin shāy?", en: "could I have tea?" },
          ],
        },
        {
          kind: "info",
          title: "Price, paying, change",
          body:
            "  بِكَم هذا؟ (bi-kam hādhā?) — how much is this?\n" +
            "  الحِساب، مِن فَضلِك. (al-ḥisāb, min faḍlik) — the check, please.\n" +
            "  بَقشيش (baqshīsh) — tip\n" +
            "  باقي (bāqī) — change (leftover)\n" +
            "  اِحتَفِظ بالباقي. (iḥtafiẓ bil-bāqī) — keep the change.\n" +
            "  نَقدا (naqdan) — in cash\n" +
            "  بِالبِطاقة (bil-biṭāqa) — by card\n\n" +
            "Currency vocabulary — huge variation by country:\n" +
            "  دينار (dīnār) — Jordanian/Iraqi/Bahraini/Kuwaiti/Libyan/Tunisian/Algerian dinar\n" +
            "  ريال (riyāl) — Saudi/Qatari/Omani/Yemeni/Iranian riyal\n" +
            "  دِرهَم (dirham) — UAE/Moroccan dirham\n" +
            "  لِيرة (līra) — Lebanese/Syrian lira\n" +
            "  جُنَيه (junayh) — Egyptian pound\n\n" +
            "Conversation example:\n" +
            "  'Bi-kam hādhā?' — How much is this?\n" +
            "  'ʿashara riyāl.' — 10 riyal.\n" +
            "  'Tamām.' — OK.\n" +
            "  (You pay) 'Iḥtafiẓ bil-bāqī.' — Keep the change.",
          showcase: [
            { ar: "بِكَم هذا؟", translit: "bi-kam hādhā?", en: "how much is this?" },
            { ar: "الحِساب مِن فَضلِك", translit: "al-ḥisāb min faḍlik", en: "the check please" },
            { ar: "اِحتَفِظ بالباقي", translit: "iḥtafiẓ bil-bāqī", en: "keep the change" },
          ],
        },
        {
          kind: "info",
          title: "Common café / restaurant phrases you'll hear",
          body:
            "From the server:\n" +
            "  أَهلاً وَسَهلاً (ahlan wa sahlan) — welcome\n" +
            "  تَفَضَّل (tafaḍḍal) / تَفَضَّلي (tafaḍḍalī) — please, here you go (to m / f)\n" +
            "  ماذا تَشرَب؟ / ماذا تَأكُل؟ (mādhā tashrab / taʾkul?) — what do you want to drink / eat?\n" +
            "  أَيَّ حَجم؟ (ayyu ḥajm?) — what size?\n" +
            "  سُكَّر؟ (sukkar?) — sugar?\n" +
            "  شَيء آخَر؟ (shayʾ ākhar?) — anything else?\n" +
            "  بِالهَنا وَالشِّفا (bil-hanāʾ wa sh-shifāʾ) — 'bon appétit' (lit. 'with pleasure and healing')\n\n" +
            "You might say:\n" +
            "  بِدون سُكَّر (bidūn sukkar) — without sugar\n" +
            "  قَليل (qalīl) — a little\n" +
            "  كَثير (kathīr) — a lot\n" +
            "  حار (ḥārr) — hot (spicy or temperature)\n" +
            "  بارِد (bārid) — cold\n" +
            "  أَيضاً (ayḍan) — also / too\n" +
            "  هذا كُلّ شَيء (hādhā kull shayʾ) — that's everything\n\n" +
            "'Bil-hanāʾ wa sh-shifāʾ' is the Arabic equivalent of 'bon appétit' — said to someone who is about to eat. It implies the food will be enjoyable AND healing. The reply: الله يَعافيك (allāh yuʿāfīk) — 'may God grant you well-being'.",
        },
        {
          kind: "mcq",
          question: "To politely say 'please' to a man:",
          choices: ["min faḍlik", "min faḍliki", "shukran", "ʿafwan"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          question: "'al-ḥisāb min faḍlik' means:",
          choices: [
            "the menu, please",
            "the check, please",
            "the water, please",
            "how much does it cost?",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'mumkin shāy?' means:",
          choices: [
            "I want tea",
            "Could I have tea? / Is tea possible?",
            "Do you have tea?",
            "Is tea good?",
          ],
          correctIndex: 1,
          explain: "mumkin = 'possible'. A soft, polite way to request.",
        },
        {
          kind: "mcq",
          question: "'iḥtafiẓ bil-bāqī' means:",
          choices: [
            "I need change",
            "Keep the change",
            "Can I pay by card?",
            "The bill is wrong",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'bidūn sukkar' means:",
          choices: [
            "With extra sugar",
            "Without sugar",
            "With a little sugar",
            "With honey",
          ],
          correctIndex: 1,
          explain: "bidūn = 'without'. A useful negator for substances.",
        },
        {
          kind: "mcq",
          question: "'bil-hanāʾ wa sh-shifāʾ' is said:",
          choices: [
            "When greeting",
            "When paying",
            "To someone about to eat — 'bon appétit'",
            "When leaving",
          ],
          correctIndex: 2,
        },
        {
          kind: "match",
          prompt: "Match Arabic phrase to English",
          pairs: [
            { ar: "أُريدُ", en: "I want" },
            { ar: "مِن فَضلِك", en: "please (m)" },
            { ar: "بِكَم هذا؟", en: "how much is this?" },
            { ar: "الحِساب", en: "the check" },
            { ar: "تَفَضَّل", en: "please / here you go" },
            { ar: "بِدون", en: "without" },
            { ar: "شُكراً", en: "thanks" },
          ],
        },
        {
          kind: "fillblank",
          prompt: "أُريدُ ____ مِن فَضلِك. (I'd like tea, please.)",
          blank: "شاي (shāy)",
          en: "tea",
          choices: ["قَهوة", "شاي", "ماء", "عَصير"],
          correctIndex: 1,
        },
        {
          kind: "typing",
          prompt: "Type 'how much is this?' — bi-kam hādhā (transliteration).",
          expected: "bi-kam hadha",
          altAccepted: ["bi kam hadha", "bikam hadha", "bi-kam hādhā"],
        },
        {
          kind: "typing",
          prompt: "Type 'without sugar' — bidūn sukkar (transliteration).",
          expected: "bidun sukkar",
          altAccepted: ["bidūn sukkar", "bedoon sukkar"],
        },
      ],
    },

    {
      id: "L9.4",
      levelId: "L9",
      order: 4,
      title: "Full Café Dialogue + Market Interaction",
      subtitle: "Ordering, paying, and the extras",
      theme: "food",
      estimatedMinutes: 35,
      xp: 100,
      prerequisites: ["L9.3"],
      summary: "A realistic café exchange — you understand every word.",
      wrapUp: "Level 9 complete. You have functional Arabic for most daily transactions. Level 10 is the capstone: connected reading and cultural context.",
      activities: [
        {
          kind: "dialogue",
          prompt: "Hanif walks into a café. Read carefully.",
          lines: [
            { speaker: "A", ar: "أَهلاً وَسَهلاً! ماذا تُريد؟", translit: "ahlan wa sahlan! mādhā turīd?", en: "Welcome! What would you like?" },
            { speaker: "B", ar: "أَهلاً. أُريدُ قَهوة مَزبوطة وَ شَطيرة جُبن، مِن فَضلِك.", translit: "ahlan. urīdu qahwa mazbūṭa wa-shaṭīrat jubn, min faḍlik.", en: "Hi. I'd like a medium-sugar coffee and a cheese sandwich, please." },
            { speaker: "A", ar: "حاضِر. هَل تُريد شَيئاً آخَر؟", translit: "ḥāḍir. hal turīd shayʾan ākhar?", en: "Right away. Would you like anything else?" },
            { speaker: "B", ar: "نَعَم، كوب ماء أَيضاً، لَو سَمَحت.", translit: "naʿam, kūb māʾ ayḍan, law samaḥt.", en: "Yes, a cup of water too, please." },
            { speaker: "A", ar: "بِالتَأكيد. الطَلَب في الحال.", translit: "bit-taʾkīd. aṭ-ṭalab fī l-ḥāl.", en: "Of course. Your order is coming right up." },
            { speaker: "B", ar: "شُكراً. بِكَم الحِساب؟", translit: "shukran. bi-kam al-ḥisāb?", en: "Thanks. How much is the check?" },
            { speaker: "A", ar: "خَمسة عَشَر دولار.", translit: "khamsata ʿashar dūlār.", en: "Fifteen dollars." },
            { speaker: "B", ar: "تَفَضَّل عِشرون. اِحتَفِظ بالباقي.", translit: "tafaḍḍal ʿishrūn. iḥtafiẓ bil-bāqī.", en: "Here's twenty. Keep the change." },
            { speaker: "A", ar: "شُكراً جَزيلاً. بِالهَنا وَالشِّفا.", translit: "shukran jazīlan. bil-hanāʾ wa sh-shifāʾ.", en: "Thanks very much. Bon appétit." },
            { speaker: "B", ar: "الله يَعافيك.", translit: "allāh yuʿāfīk.", en: "May God grant you well-being." },
          ],
          question: "What did Hanif order?",
          choices: [
            "Tea and bread",
            "Coffee (medium sugar), cheese sandwich, and water",
            "Coffee, sugar, and milk",
            "Hummus, bread, and juice",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "What was the total price and what did Hanif pay?",
          choices: [
            "$10; paid $10",
            "$15; paid $20 and left a $5 tip",
            "$20; paid exact change",
            "$25; paid $30",
          ],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'ḥāḍir' (the server's first reply) most closely means:",
          choices: [
            "Welcome",
            "Ready / right away / at your service",
            "Sure",
            "Thanks",
          ],
          correctIndex: 1,
          explain: "ḥāḍir = 'present / ready' — used as 'right away' or 'at your service' in service contexts.",
        },
        {
          kind: "mcq",
          question: "'shukran jazīlan' means:",
          choices: [
            "Thanks",
            "Thanks very much / many thanks",
            "You're welcome",
            "Goodbye",
          ],
          correctIndex: 1,
          explain: "jazīlan = 'plenty / abundantly'. shukran jazīlan = 'many thanks'.",
        },
        {
          kind: "mcq",
          question: "'tafaḍḍal' (the customer's phrase when paying) in context means:",
          choices: [
            "Thank you",
            "Please / here you go (offering money)",
            "Goodbye",
            "Sorry",
          ],
          correctIndex: 1,
        },
        {
          kind: "info",
          title: "Bonus — asking about halal / vegetarian",
          body:
            "Useful follow-up questions at restaurants:\n\n" +
            "  هَل هذا حَلال؟ (hal hādhā ḥalāl?) — Is this halal?\n" +
            "  أَنا نَباتي / نَباتِيَّة. (anā nabātī / nabātiyya) — I am vegetarian (m/f).\n" +
            "  هَل يَحتَوي عَلى لَحم؟ (hal yaḥtawī ʿalā laḥm?) — Does it contain meat?\n" +
            "  بِدون بَصَل / ثوم / فِلفِل. (bidūn baṣal / thūm / filfil) — without onion / garlic / pepper.\n" +
            "  عِندي حَساسِيَّة مِن ... (ʿindī ḥasāsiyya min …) — I have an allergy to …\n" +
            "  حار جِداً! (ḥārr jiddan!) — very spicy!\n" +
            "  طَعام لَذيذ. (ṭaʿām ladhīdh) — delicious food.\n\n" +
            "In many Arab cities (especially tourist areas), English menus exist. But even a few phrases in Arabic open doors — servers, shopkeepers, and fellow diners will warm up instantly.",
          showcase: [
            { ar: "هَل هذا حَلال؟", translit: "hal hādhā ḥalāl?", en: "is this halal?" },
            { ar: "أَنا نَباتي", translit: "anā nabātī", en: "I am vegetarian (m)" },
            { ar: "طَعام لَذيذ", translit: "ṭaʿām ladhīdh", en: "delicious food" },
          ],
        },
        {
          kind: "mcq",
          question: "To say 'I'm vegetarian' (female speaker):",
          choices: [
            "anā nabātī",
            "anā nabātiyya",
            "anā bidūn laḥm",
            "anā lā ākul laḥm",
          ],
          correctIndex: 1,
          explain: "Either nabātiyya (f.) or 'anā lā ākul laḥm' (I don't eat meat) works — but the vegetarian adjective itself has f. form.",
        },
        {
          kind: "match",
          prompt: "Match phrase to meaning",
          pairs: [
            { ar: "تَفَضَّل", en: "please / here you go" },
            { ar: "حاضِر", en: "right away / at your service" },
            { ar: "شَيء آخَر؟", en: "anything else?" },
            { ar: "بِالهَنا وَالشِّفا", en: "bon appétit" },
            { ar: "اِحتَفِظ بالباقي", en: "keep the change" },
            { ar: "طَعام لَذيذ", en: "delicious food" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type 'is this halal?' — hal hādhā ḥalāl (transliteration).",
          expected: "hal hadha halal",
          altAccepted: ["hal hādhā ḥalāl"],
        },
        {
          kind: "typing",
          prompt: "Type 'I'd like coffee, please' — urīdu qahwa, min faḍlik (transliteration).",
          expected: "uridu qahwa min fadlik",
          altAccepted: [
            "urīdu qahwa min faḍlik",
            "urid qahwa min fadlik",
            "uridu qahwa, min fadlik",
          ],
        },
      ],
    },
  ],
};
