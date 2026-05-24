# Takeover — 5-Minute Live Demo Runbook

> **Hero arc:** AI-driven hire-to-onboard pipeline. Voice-driven where possible, click-driven as backup.
> **Total target:** 5:00. Hard ceiling 5:30 — over that, the room's attention drops.
> **Demo character:** "Sarah Chen, Senior Frontend Engineer applicant" — fully seeded fake persona.
> **Demo company:** "Acme Inc" (or whatever shell account the user picks for the staged data).
>
> **Pacing rule:** every beat below has a target seconds count. If you're 5 seconds over on a beat, skip the optional line in the next beat to catch up. Don't try to make up time by talking faster — it always reads as nervous.

---

## Equipment + state checklist (do 10 min before going on)

### Stage equipment
- [ ] Primary laptop with Takeover running
- [ ] Second screen — iPad or laptop — visible to audience, showing Sarah's "candidate email inbox" (open in browser to a staged Gmail-like view OR the actual accept page URL)
- [ ] Lavalier or stage mic for you
- [ ] **Separate** USB mic for Takeover to listen on (so stage audio doesn't bleed into Axon's wake-word detection — this is the single biggest live-demo failure mode)
- [ ] Mic mute/unmute hotkey practiced

### App state
- [ ] Demo data reset (click "Reset demo data" in `/admin/demo` — seeds 12 candidates, 1 job posting for Sr Frontend, clears any prior offers)
- [ ] Axon settings: voice = "british-george" (or whichever preset sounds best in the room — verify by saying "Hey Axon, what voice are you using?" before stage)
- [ ] Axon settings: continuous vision = OFF (it's distracting on a demo screen)
- [ ] Axon settings: voice gate = OFF (it'd block you on stage if mic picks up audience voices)
- [ ] Vision/visible-screen capture allowed (so "what's on this screen" works as fallback)
- [ ] Logged in as the demo recruiter account ("Riya, Head of People" or similar)
- [ ] Calendly test account: tomorrow 2pm slot UNBOOKED and confirmed via Calendly's UI
- [ ] Network test: ping anthropic.com, resend.com, calendly.com — all reachable

### Display
- [ ] Browser/IDE/Discord/Slack all closed (no notification embarrassments)
- [ ] Resolution matches projector (1920×1080 is safest — Takeover's Void theme reads beautifully on projectors but only at native res)
- [ ] Cursor large enough to follow from the back of the room — System Preferences → Accessibility → Cursor size = 2–3x

### Voice
- [ ] Practice the four spoken commands you'll use, in this voice, in this room, before going on:
    1. *"Hey Axon, who are the top three candidates for the Senior Frontend role?"*
    2. *"Hey Axon, schedule a 30-minute intro with Sarah for tomorrow at 2 PM."*
    3. *"Hey Axon, draft and send an offer letter to Sarah at 140,000 dollars, starting two weeks from now."*
    4. *"Hey Axon, onboard Sarah."*

---

# The 5-minute arc, beat by beat

## Beat 1 — The inbox (0:00–0:25, 25s)

**Screen state at start.** Takeover open. Candidates page (`/candidates`). 12 candidates visible in a table view. Sortable columns: Name, Applied At, Role, Status (all "applied"). No fit_score column yet — that's the reveal in Beat 2.

**What you do.**
- Click into the page if not already there
- Scroll the list slowly so the room sees there are real-feeling names and timestamps

**What you say.**
> "This is what came in to our website overnight. Twelve people applied to be a Senior Frontend Engineer at our company. In any other tool, this is where I open a spreadsheet, or a Greenhouse pipeline, and start reading. I'm not going to do that."

**Fallback if `/candidates` page doesn't load.** Click back to dashboard, then back to candidates. If still broken: "we have twelve in the inbox right now — let me just show you the Axon side from the start" → skip to Beat 2 with verbal-only intro.

---

## Beat 2 — Voice rank (0:25–1:15, 50s)

**What you do.**
- Look at the room briefly, not the screen. Speak the command clearly. Don't whisper.
- Wait for the orb to wake (you'll see it pulse) — about 0.5 sec
- After you finish the command, just stand still and let Axon work. The orb's "thinking" state is part of the show.

**What you say.**
> *"Hey Axon, who are the top three candidates for the Senior Frontend role?"*

**What the room sees (in this order).**
1. Orb pulses cyan-violet ("thinking" mode)
2. Axon's voice responds, narrating something like: *"Looking through twelve applications now."* (This is the streamed early acknowledgment so the audience isn't watching a silent screen.)
3. The candidate table re-sorts — fit_score column animates in, top 3 candidates pop to the top with scores (89%, 84%, 76%).
4. Axon finishes: *"Sarah Chen is your strongest fit at 89%. Eight years at Stripe and Vercel, deep TypeScript, ships design-systems work, has shipped staff-level features. Marcus Williams is second at 84% — slightly less senior but stronger React fundamentals. Priya Patel is third at 76%."*

**What you say after Axon finishes.**
> "I didn't define any rules. I didn't write any filters. I just told Axon what role I was hiring for last week, and he read every resume, scored every one against it, and explained the why. That's what the AI is for."

**Fallback if Axon doesn't hear you.** Look at the orb. If it didn't wake, hit Ctrl+Space (push-to-talk) and say the command again. If still nothing: click the orb to open the command panel, type the command, hit enter. Tell the room: *"Sometimes I just type it — Axon doesn't care."* Don't apologize, just keep moving.

**Fallback if ranking returns garbage.** This shouldn't happen because the candidates are seeded with deterministic resumes optimized for fit, but if Axon ranks oddly, just click "Sarah Chen" anyway — she'll be in the list — and narrate: *"Sarah's the obvious top fit, let's open her."* Move on.

---

## Beat 3 — Candidate detail (1:15–1:50, 35s)

**What you do.**
- Click "Sarah Chen" in the candidate list. Detail drawer slides in from the right.

**What the room sees.**
- Drawer: top half is Sarah's parsed profile (avatar placeholder, 8 yrs experience, Senior FE, Stripe + Vercel, TypeScript / React / GraphQL / design systems)
- Middle: Axon's structured assessment — Strengths (3 bullets), Concerns (1 bullet, honest), Recommended next step ("30-min intro to verify cultural fit on async-first team")
- Bottom: action buttons — "Schedule interview", "Make offer", "Reject", "Save for later"

**What you say.**
> "Here's her resume parsed into structured fields. Here's Axon's read. Strengths: senior IC at two strong eng cultures, ships full-stack, comfortable with design systems. Concerns: hasn't led an interview loop, so she may need ramp on that side. Recommended next step: thirty-minute intro to check async fit. Notice it's not just a score — it's an opinion, with a recommendation. That's what a recruiter would write."

**Fallback if drawer doesn't open.** Click Sarah's row a second time. If still nothing: navigate to `/candidates/sarah-chen` directly via URL. If still broken: skip to Beat 4 with verbal hand-wave ("let me just schedule the intro and we'll come back to her details").

---

## Beat 4 — Schedule the interview (1:50–2:30, 40s)

**What you do.**
- Speak the command. Don't click the "Schedule interview" button — let voice do it, that's the wow.

**What you say.**
> *"Hey Axon, schedule a 30-minute intro with Sarah for tomorrow at 2 PM."*

**What the room sees.**
1. Orb pulses
2. Small toast: "Checking your calendar…"
3. Calendly-style confirmation modal slides up: Tuesday May 26, 2:00–2:30 PM, "Intro with Sarah Chen — 30 minutes", invite sent to sarah.chen@example.com, Calendly meeting link visible
4. Axon: *"Booked. Sarah's been emailed the Calendly invite for tomorrow at 2 PM."*

**What you say.**
> "Real Calendly booking. The invite is in her inbox right now. If you were doing this in your stack today you'd be in the Greenhouse interview tab, copy-pasting her email into Calendly, picking a slot, pasting the link back into a candidate note. Axon does the whole chain in one sentence."

**Fallback if Calendly OAuth chokes.** This is the most fragile single piece in the whole demo. If the modal hangs more than 5 seconds, say: *"Calendly's API is slow today — Axon already has the slot held, the invite goes out as soon as it responds. Let's move on, the offer is the more interesting piece."* Skip to Beat 5.

---

## Beat 5 — Narrative skip + make the offer (2:30–3:15, 45s)

**What you do.**
- Pause briefly. Look at the audience. Set up the narrative skip.
- Speak the offer command.

**What you say (setup).**
> "Now I'm going to skip a few days in the story. Sarah came in for the interview. The team loved her. We want to hire her."

**What you say (command).**
> *"Hey Axon, draft and send an offer letter to Sarah at 140,000 dollars, starting two weeks from now."*

**What the room sees.**
1. Orb pulses
2. Side panel opens: offer letter generating in real-time (DiffOverlay/live-coder typewriter — text appears line by line, looks like Axon is writing the letter as you watch)
3. Counter-sign step appears: "Sign as Riya Patel, Head of People" — you click the signature field, type "Riya Patel", click Sign
4. Axon: *"Offer drafted, you've counter-signed, sending to Sarah now."*
5. Toast: "Offer sent to sarah.chen@example.com — HMAC verified"

**What you say.**
> "Real offer letter. Real ESIGN-compliant signature. Real HMAC-signed email through our website. We're not pretending — that email actually goes out."

**Fallback if drafting hangs.** Click the "Draft offer" button manually if voice fails. If the draft itself fails to generate, say *"Already drafted, just sending now"* and click "Send" on whatever pre-loaded offer is in the seed data (it should always be there as a safety net).

---

## Beat 6 — Switch to second screen, candidate accepts (3:15–3:55, 40s)

**What you do.**
- Step toward the second screen. Pick it up if it's a tablet, or just gesture toward it. Make the physical switch feel deliberate — investors are watching your body language as much as the screen.
- The accept page is already loaded on the second screen showing Sarah's email inbox with the offer email at the top
- Click into the email
- Click the "Review & Sign" button → accept page loads
- On the accept page: type "Sarah Chen" in the signature field, check the ESIGN box, click Accept

**What you say (during the switch).**
> "Sarah's on her phone. This is what she sees."

**What you say (after Accept).**
> "Typed-name signature, ESIGN compliant, legally binding. The accept event fires a webhook back into Takeover."

**Fallback if the email doesn't load on the second screen.** Open the accept URL directly in a new tab — you have the URL bookmarked, right? RIGHT? (Pre-bookmark it. Practice this transition five times before stage.)

---

## Beat 7 — Auto-onboarding (3:55–4:25, 30s)

**What you do.**
- Switch back to primary laptop. The Takeover screen should *already* have updated — Axon should be speaking the moment you return.

**What the room sees / hears.**
- Chat panel pops up: notification "📢 Sarah Chen accepted the Senior Frontend offer"
- Axon speaks: *"Sarah accepted. I've added her to the team chat, generated her 30-60-90 day plan, and scheduled her welcome for Monday at 9 AM."*
- Onboarding panel auto-opens showing a structured 3-column plan: 30 days (4 items), 60 days (4 items), 90 days (4 items), each item with date + owner

**What you say.**
> "Three things just happened, all from her clicking Accept. She's been added to our team chat. Her personalized 30-60-90 day plan was generated from her resume — see how it knows her React background so day-one is design-system context, not Hello World? And her welcome session is on the calendar. None of this was a template. Axon wrote it for *her*."

**Fallback if the chat or plan doesn't appear.** Click `/onboarding/sarah-chen` directly. The plan should be there from the seed data even if real-time wasn't fired.

---

## Beat 8 — Axon-as-trainer (4:25–5:00, 35s)

> This is the riskiest beat. It's also the magic moment. Don't cut it.

**What you do.**
- Click a "switch user → Sarah Chen" button in dev mode (or have a second window pre-logged-in as Sarah, switch to it via Cmd+Tab)
- Sarah's view loads. Plain dashboard.

**What the room sees.**
1. As Sarah's dashboard loads, the orb appears and starts speaking immediately (this opening is deterministic — scripted, not live LLM):

   *"Hi Sarah, welcome to Acme. I'm Axon — I'll be your training partner for your first ninety days. The fastest way to learn this place is to ask me anything as it comes up. Let me show you where everything lives."*

2. Axon's cursor (highlighted with a focus ring) navigates: clicks "Tasks", waits a beat, clicks "Chat", waits, clicks "Pattern Library", explains each in one short sentence.

3. After ~15 seconds of guided tour, Axon stops: *"Got it? Try asking me something."*

4. **You type** (don't speak — this is intentional, simulates Sarah at her keyboard on day 1): *"How do I submit my first time entry?"*

5. Live LLM call (this is the risk moment — Claude answers from a small RAG over Takeover's own docs):
   > *"Click Time Tracking in the sidebar, then 'New entry.' For your first one I'd start with the morning of your first standup — that's how the team gets in the rhythm. Want me to take you there?"*

6. End on Axon's offer to navigate. Don't actually navigate — let the silence land.

**What you say (back as yourself, looking at audience).**
> "That was twelve resumes, one hire, zero recruiter hours, in under five minutes. And tomorrow, when Sarah's stuck on something at 11 PM, Axon's still there. That's what AI for ops actually means."

**Fallback if the live question fails.** If Claude doesn't return in 4 seconds, say to the room: *"That's tonight's homework for our Claude integration — let me show you what the rest of the onboarding looks like"* → click into the onboarding plan, narrate one or two items, then close out with the same final line.

**Fallback if the scripted opening fails (don't click the wrong button!).** If the orb doesn't auto-appear on Sarah's login, click the orb manually and say: *"Sarah, welcome — let me show you around"* → manually click the same tour stops Axon would have clicked. The audience won't know the difference unless you tell them.

---

# After the demo: bridge to closing slides

You're now at ~5:00 (or ~5:30 with overrun). Smoothly switch back to slides — Slide 6 (The Moat) is next. The closing line of the demo ("That's what AI for ops actually means") is the natural bridge.

---

# What the seed data must contain

For this demo to run cleanly, the seed has to deliver **deterministic-looking variation**. The candidates have to feel real (different names, different backgrounds, varied resumes), but the ranking has to be reproducible — same input → same top 3 every time. The seed I'm building will guarantee:

**12 candidates for "Senior Frontend Engineer at Acme Inc":**
1. **Sarah Chen** — 8 yrs, Stripe → Vercel, deep TS/React, design systems → fit ~89% **(THE HIRE)**
2. **Marcus Williams** — 6 yrs, Shopify, strong React/Redux, less senior breadth → fit ~84%
3. **Priya Patel** — 5 yrs, Robinhood + agency, full-stack tilt → fit ~76%
4. **Jordan Lee** — 4 yrs, big tech bootcamp grad, generalist → fit ~62%
5. **Ahmed Hassan** — 12 yrs, mostly Java backend, dabbled in React → fit ~48% (interesting wildcard, gets flagged "deep backend, weaker FE — consider for staff backend role instead")
6. **Riley Morgan** — 3 yrs, junior-mid, mostly Vue, learning React → fit ~38%
7. **Chris Park** — 7 yrs but all Angular, no React → fit ~31%
8. **Sam Rodriguez** — recent bootcamp grad, strong portfolio but new → fit ~28%
9. **Taylor Chen** — 2 yrs, looking like a wrong-level apply → fit ~22% (and flagged "level mismatch — would suit junior FE role")
10. **Casey Brown** — backend-only, applied to wrong role → fit ~15%
11. **Alex Kim** — content writer, definitely wrong role → fit ~5% (auto-flagged "likely misclicked the role")
12. **Drew Liu** — fully blank resume, name only (tests the "incomplete application" path) → fit N/A, flagged for follow-up

The bottom 3 (Alex, Drew, Casey) are intentional — they let Axon's narration include things like *"three of these don't look like serious applications"*, which is realistic and credibility-building.

**2–3 of the above will be swapped for real anonymized resumes you provide** — Sarah (the hire), Marcus (the close-second), and one weak candidate are the highest-leverage swaps for authenticity.

---

# One-pager version (for your wallet on stage)

```
0:00  Inbox open. "Twelve people applied overnight."
0:25  "Hey Axon, top three for Senior Frontend?"  →  rank w/ reasoning
1:15  Click Sarah. "Here's the read."
1:50  "Hey Axon, schedule a 30-min intro tomorrow at 2 PM"
2:30  "Interview went great." "Hey Axon, draft and send offer at 140k."
3:15  → second screen. Sarah signs.
3:55  Back. Axon: "Sarah accepted, added her, generated plan."
4:25  Switch to Sarah's login. Axon greets, tours, answers a question.
5:00  "Twelve resumes, one hire, zero recruiter hours, under five minutes."
```

Print this on an index card. Tape it to the side of your laptop where only you can see it.
