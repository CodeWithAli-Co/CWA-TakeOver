// ============================================================================
// LEVEL 6 — Numbers, days, and time
// ============================================================================

import type { Level } from "../types";

export const level6: Level = {
  id: "L6",
  order: 6,
  title: "Numbers & Time",
  subtitle: "Count, tell the day, tell the time",
  theme: "numbers",
  goal: "Count to 100, say days of the week, and read times and dates.",
  lessons: [
    {
      id: "L6.1",
      levelId: "L6",
      order: 1,
      title: "Numbers 1–10",
      subtitle: "The foundation of Arabic counting",
      theme: "numbers",
      estimatedMinutes: 25,
      xp: 60,
      prerequisites: ["L5.5"],
      summary: "wāḥid, ithnān, thalātha…",
      wrapUp: "The Arabic digits (٠–٩) are the ancestors of the Western 0–9. You now know both forms.",
      activities: [
        {
          kind: "info",
          title: "1 to 10",
          body:
            "١  واحِد   (wāḥid) — 1\n" +
            "٢  اِثْنان  (ithnān) — 2\n" +
            "٣  ثَلاثَة (thalātha) — 3\n" +
            "٤  أَرْبَعَة (arbaʿa) — 4\n" +
            "٥  خَمْسَة (khamsa) — 5\n" +
            "٦  سِتَّة (sitta) — 6\n" +
            "٧  سَبْعَة (sabʿa) — 7\n" +
            "٨  ثَمانِيَة (thamāniya) — 8\n" +
            "٩  تِسْعَة (tisʿa) — 9\n" +
            "١٠ عَشَرَة (ʿashara) — 10\n\n" +
            "Yes, Arabic uses two digit systems — Hindi-Arabic (١٢٣) and Western-Arabic (123). Both are Arabic — one went east, one went west.",
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
          kind: "mcq",
          arabicPrompt: "٥",
          question: "What number is this?",
          choices: ["3", "4", "5", "6"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "٨",
          question: "What number is this?",
          choices: ["6", "7", "8", "9"],
          correctIndex: 2,
          explain: "Watch out — ٦ is 6, ٧ is 7. ٨ looks like a small tree.",
        },
        {
          kind: "mcq",
          question: "Which is 'thalātha'?",
          choices: ["2", "3", "4", "5"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match the word to the digit",
          pairs: [
            { ar: "واحِد", en: "1" },
            { ar: "ثَلاثَة", en: "3" },
            { ar: "خَمْسَة", en: "5" },
            { ar: "سَبْعَة", en: "7" },
            { ar: "عَشَرَة", en: "10" },
          ],
        },
        {
          kind: "typing",
          prompt: "Type the Arabic word for '2' (transliteration).",
          expected: "ithnan",
          altAccepted: ["ithnān", "ithnaan"],
        },
      ],
    },

    {
      id: "L6.2",
      levelId: "L6",
      order: 2,
      title: "Numbers 11–20",
      subtitle: "Teen numbers",
      theme: "numbers",
      estimatedMinutes: 20,
      xp: 55,
      prerequisites: ["L6.1"],
      summary: "ḥidāshar, ithnāshar, thalāthat ʿashar…",
      wrapUp: "Teens in Arabic are literally '3 + 10', '4 + 10' — easy once you see the pattern.",
      activities: [
        {
          kind: "info",
          title: "11 to 20",
          body:
            "١١ أَحَدَ عَشَر (aḥada ʿashar)\n" +
            "١٢ اِثْنا عَشَر (ithnā ʿashar)\n" +
            "١٣ ثَلاثَةَ عَشَر (thalāthata ʿashar)\n" +
            "١٤ أَرْبَعَةَ عَشَر (arbaʿata ʿashar)\n" +
            "١٥ خَمْسَةَ عَشَر (khamsata ʿashar)\n" +
            "…\n" +
            "٢٠ عِشْرون (ʿishrūn)\n\n" +
            "Pattern: 'three-ten', 'four-ten', etc. 20 is its own word.",
          showcase: [
            { ar: "١٣", translit: "thalāthata ʿashar", en: "13" },
            { ar: "١٥", translit: "khamsata ʿashar", en: "15" },
            { ar: "٢٠", translit: "ʿishrūn", en: "20" },
          ],
        },
        {
          kind: "mcq",
          question: "'khamsata ʿashar' means:",
          choices: ["5", "10", "15", "50"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          arabicPrompt: "٢٠",
          question: "What number is this?",
          choices: ["2", "12", "20", "200"],
          correctIndex: 2,
        },
      ],
    },

    {
      id: "L6.3",
      levelId: "L6",
      order: 3,
      title: "Tens, Hundreds, and Up",
      subtitle: "Counting bigger",
      theme: "numbers",
      estimatedMinutes: 20,
      xp: 55,
      prerequisites: ["L6.2"],
      summary: "ʿishrūn, thalāthūn, miʾa, alf.",
      wrapUp: "You can now count to a thousand in Arabic.",
      activities: [
        {
          kind: "info",
          title: "Tens, hundred, thousand",
          body:
            "٢٠ عِشْرون (ʿishrūn) — 20\n" +
            "٣٠ ثَلاثون (thalāthūn) — 30\n" +
            "٤٠ أَرْبَعون (arbaʿūn) — 40\n" +
            "٥٠ خَمْسون (khamsūn) — 50\n" +
            "١٠٠ مِئَة (miʾa) — 100\n" +
            "١٠٠٠ أَلْف (alf) — 1,000\n\n" +
            "To say 'thirty-five': خَمْسَة وَثَلاثون (khamsa wa-thalāthūn) = 'five and thirty'.",
          showcase: [
            { ar: "٥٠", translit: "khamsūn", en: "50" },
            { ar: "١٠٠", translit: "miʾa", en: "100" },
            { ar: "١٠٠٠", translit: "alf", en: "1,000" },
            { ar: "٣٥", translit: "khamsa wa-thalāthūn", en: "35 (five and thirty)" },
          ],
        },
        {
          kind: "mcq",
          question: "'miʾa' means:",
          choices: ["10", "50", "100", "1000"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "'khamsa wa-thalāthūn' means:",
          choices: ["35", "53", "13", "25"],
          correctIndex: 0,
          explain: "Literally 'five and thirty' — Arabic says small then big.",
        },
      ],
    },

    {
      id: "L6.4",
      levelId: "L6",
      order: 4,
      title: "Days of the Week",
      subtitle: "Al-aḥad, al-ithnayn, …",
      theme: "time",
      estimatedMinutes: 20,
      xp: 50,
      prerequisites: ["L6.3"],
      summary: "Most day names come straight from the numbers.",
      wrapUp: "Notice Monday = 'the second', Tuesday = 'the third'. Numbers everywhere.",
      activities: [
        {
          kind: "info",
          title: "The seven days",
          body:
            "الأَحَد (al-aḥad) — Sunday (literally 'the one')\n" +
            "الاِثْنَيْن (al-ithnayn) — Monday ('the two')\n" +
            "الثُّلاثاء (ath-thulāthāʾ) — Tuesday ('the three')\n" +
            "الأَرْبِعاء (al-arbiʿāʾ) — Wednesday ('the four')\n" +
            "الخَميس (al-khamīs) — Thursday ('the five')\n" +
            "الجُمْعَة (al-jumʿa) — Friday ('the gathering' — holy day)\n" +
            "السَّبْت (as-sabt) — Saturday ('the sabbath')",
          showcase: [
            { ar: "الاِثْنَيْن", translit: "al-ithnayn", en: "Monday" },
            { ar: "الجُمْعَة", translit: "al-jumʿa", en: "Friday" },
            { ar: "السَّبْت", translit: "as-sabt", en: "Saturday" },
          ],
        },
        {
          kind: "mcq",
          question: "Friday in Arabic is:",
          choices: ["al-aḥad", "al-jumʿa", "as-sabt", "al-khamīs"],
          correctIndex: 1,
        },
        {
          kind: "mcq",
          question: "'al-ithnayn' is:",
          choices: ["Sunday", "Monday", "Tuesday", "Wednesday"],
          correctIndex: 1,
        },
        {
          kind: "match",
          prompt: "Match the day to its English name",
          pairs: [
            { ar: "الأَحَد", en: "Sunday" },
            { ar: "الاِثْنَيْن", en: "Monday" },
            { ar: "الخَميس", en: "Thursday" },
            { ar: "الجُمْعَة", en: "Friday" },
            { ar: "السَّبْت", en: "Saturday" },
          ],
        },
      ],
    },

    {
      id: "L6.5",
      levelId: "L6",
      order: 5,
      title: "Time & Today / Tomorrow / Yesterday",
      subtitle: "Al-yawm, ghadan, al-sāʿa",
      theme: "time",
      estimatedMinutes: 20,
      xp: 55,
      prerequisites: ["L6.4"],
      summary: "Core time words — today, tomorrow, yesterday, now, hour.",
      wrapUp: "You can locate yourself and others in time. Powerful.",
      activities: [
        {
          kind: "info",
          title: "Time vocabulary",
          body:
            "اليَوْم (al-yawm) — today\n" +
            "غَداً (ghadan) — tomorrow\n" +
            "أَمْس (ams) — yesterday\n" +
            "الآن (al-ān) — now\n" +
            "السّاعَة (as-sāʿa) — the hour / the clock\n\n" +
            "Telling the time uses the pattern: السّاعَة ثَلاثَة (as-sāʿa thalātha) = 'the hour is three' = 'it's 3 o'clock'.",
          showcase: [
            { ar: "اليَوْم", translit: "al-yawm", en: "today" },
            { ar: "غَداً", translit: "ghadan", en: "tomorrow" },
            { ar: "أَمْس", translit: "ams", en: "yesterday" },
            { ar: "الآن", translit: "al-ān", en: "now" },
            { ar: "السّاعَة خَمْسَة", translit: "as-sāʿa khamsa", en: "it's 5 o'clock" },
          ],
        },
        {
          kind: "mcq",
          question: "'ghadan' means:",
          choices: ["now", "today", "yesterday", "tomorrow"],
          correctIndex: 3,
        },
        {
          kind: "mcq",
          question: "'as-sāʿa sabʿa' means:",
          choices: ["it's 6 o'clock", "it's 7 o'clock", "it's 8 o'clock", "it's 9 o'clock"],
          correctIndex: 1,
        },
        {
          kind: "fillblank",
          prompt: "اليَوْم ____. (Today is Friday.)",
          blank: "al-jumʿa",
          en: "Friday",
          choices: ["al-jumʿa", "as-sabt", "al-ithnayn", "al-khamīs"],
          correctIndex: 0,
        },
      ],
    },

    {
      id: "L6.6",
      levelId: "L6",
      order: 6,
      title: "Level 6 Review",
      subtitle: "Numbers, days, and time",
      theme: "review",
      estimatedMinutes: 25,
      xp: 80,
      prerequisites: ["L6.5"],
      summary: "Cement the counting and calendar.",
      wrapUp: "You can count, schedule, and tell time. Now we'll talk about people.",
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
          question: "'arbaʿūn' means:",
          choices: ["4", "14", "40", "400"],
          correctIndex: 2,
        },
        {
          kind: "mcq",
          question: "Sunday in Arabic:",
          choices: ["al-aḥad", "al-ithnayn", "as-sabt", "al-jumʿa"],
          correctIndex: 0,
        },
        {
          kind: "match",
          prompt: "Match",
          pairs: [
            { ar: "اليَوْم", en: "today" },
            { ar: "غَداً", en: "tomorrow" },
            { ar: "أَمْس", en: "yesterday" },
            { ar: "الآن", en: "now" },
          ],
        },
      ],
    },
  ],
};
