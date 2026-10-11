# ReLoop: 3-Minute Challenge Demo Script

**Theme**: Sustainability & Social Impact (Circular Economy Pilot)  
**Pilot City**: Seattle, WA  
**Target Duration**: 3 Minutes (180 Seconds)

---

### [0:00 - 0:30] Introduction & The Real-World Circular Dilemma
- **Visual**: Show ReLoop Home Page (`/`) with the Seattle Circular Economy Pilot badge and warm, accessible styling.
- **Narrator**:
  > *"Every day, millions of fixable chairs, wearable clothes, and recyclable packaging end up in landfills. Why? Because municipal recycling rules are confusing, donation criteria are strict, and people don't know where to turn.*
  > *Meet **ReLoop** — a mobile-first circular platform that pairs **Gemini on Vertex AI** with **grounded local data** to give every unwanted item a verified second life."*

---

### [0:30 - 1:15] AI Assessment & Human Confirmation
- **Action**: Click **"Try Sample Chair Walkthrough"** on the home screen.
- **Visual**: Navigate to `/assess`. Show the wooden chair with loose dowel joint description and Seattle selected.
- **Narrator**:
  > *"Notice our first critical principle: Prompt safety and evidence separation. The user uploads a photo or enters a description. Gemini on Vertex AI analyzes the item and returns structured visual observations — identifying furniture and wood. But rather than guessing if the item is functional, ReLoop asks clarifying condition questions: 'Is it sturdy or does it wobble?'"*
- **Action**: Select *"Minor wobble or loose joint"* and click **"Synthesize Verified Recommendations"**.

---

### [1:15 - 2:00] Deterministic Grounding & No AI Hallucinations
- **Visual**: Navigate to Results Page (`/results`). Display the ranked hierarchy cards: #1 Repair &gt; #2 Bulky Collection.
- **Narrator**:
  > *"Here is ReLoop's core architectural innovation: Gemini does NOT invent organizations, opening hours, or fake recycling promises. Our deterministic backend matches against verified municipal rules and curated non-profit directories.*
  > *Because our chair has a fixable wobble, Ballard Tool Library Fixers Collective is ranked #1 for repair. We see the official municipal citation and exact verification date. Any ungrounded AI citations are rejected by our validation engine."*
- **Action**: Click the interactive map pin to highlight Ballard Tool Library and show external direction links.

---

### [2:00 - 2:30] Outbox Pattern & Event Publishing
- **Visual**: Scroll to **"Record Completed Outcome"** on the Results page.
- **Action**: Enter self-reported weight `6.5` kg and click **"Record Completion"**.
- **Narrator**:
  > *"ReLoop clearly distinguishes choosing an action from actually completing it. When the user completes their repair, we atomically save the outcome in Firestore alongside an outbox event. Our event-driven worker publishes this stable event to Google Cloud Pub/Sub, streaming into BigQuery without duplicate counting."*

---

### [2:30 - 3:00] Community Impact & Analytics Correctness
- **Visual**: Navigate to `/community`. Toggle between Sample Demo Data and Live BigQuery Feed.
- **Narrator**:
  > *"Finally, we view our Community Impact Dashboard. Unlike apps that generate fabricated CO₂ savings, ReLoop enforces strict analytics correctness: Disposal is never counted as diversion, absent weights are treated as unknown rather than zero, and demo data is strictly excluded from live BigQuery views.*
  > *With Gemini on Vertex AI, Cloud Storage, Firestore, Cloud Run, Pub/Sub, and BigQuery, ReLoop transforms sustainability from confusing rules into verifiable circular impact."*
