# ReLoop — Complete Technical & User Guide

**Project**: ReLoop — Circular Economy Sustainability Web Application  
**Target**: Google AI Builder Challenge in Sustainability & Social Impact  
**Pilot City**: Seattle, WA  

---

## 1. What Changes Were Done (Architecture & Implementation Overview)

We designed and built the complete, production-grade ReLoop application from scratch. Below is the breakdown of everything created in the codebase:

### A. Core Architecture & Backend Engine
1. **Domain Data Models & Zod Schemas** (`src/types/models.ts`):
   - Defined strict data contracts for `Organization`, `LocalRule`, `Assessment`, `Outcome`, and `AnalyticsEvent`.
2. **Deterministic Matching Engine** (`src/lib/matchingEngine.ts`):
   - Backend logic that filters organizations and municipal rules by pilot city, item category, user-confirmed condition, and accepted materials.
3. **Anti-Hallucination Citation Validator** (`src/lib/matchingEngine.ts`):
   - Verifies all organization and rule IDs generated in AI responses against the pre-filtered deterministic evidence set. **Any unknown ID is immediately stripped or rejected**.
4. **Curated Datasets for Seattle Pilot** (`src/data/curatedSeattle.ts`):
   - Curated non-profits (Seattle Goodwill Capitol Hill, Ballard Tool Library Fixers Collective, Lifelong Thrift, The RE Store, Seattle Special Recycling Depot).
   - Official municipal disposal instructions (corrugated cardboard, plastic film drop-offs, rigid containers, damaged textiles Threadcycle, bulky furniture).
5. **Gemini on Vertex AI Integration** (`src/lib/geminiService.ts`):
   - Integrated the official `@google/genai` SDK with prompt safety (treating inputs strictly as data).
   - Generates structured preliminary observations and clarifying condition questions.
   - Includes high-fidelity deterministic responses for local `DEMO_MODE`.
6. **Cloud Storage Pipeline** (`src/lib/storageService.ts`):
   - Magic-number validation for JPEG, PNG, and WebP; enforces 8MB limit.
   - Generates 15-minute signed URLs; documents 30-day auto-deletion policy.
7. **Firestore Repository & Outbox Pattern** (`src/lib/repository.ts`):
   - Atomically persists user outcomes alongside pending outbox analytics events in a single transaction.
   - Worker dispatcher flushes pending events with stable event IDs (`event_outcome_<outcomeId>`).
8. **BigQuery Analytics Schema** (`src/data/bigquery_schema.sql`):
   - Raw ingestion table partitioned by date and clustered by city, category, action.
   - Deduplication view (`v_deduped_live_outcomes`) that excludes demo data, counts diversion strictly for `repair`, `reuse`, `donate`, and `recycle` (excluding `dispose`), and treats absent weights as unknown (never zero).
9. **Authentication & Token Verifier** (`src/lib/authVerifier.ts` & `src/context/AuthContext.tsx`):
   - Google Sign-In with client token transmission and server-side verification with user ownership enforcement.

### B. Mobile-First User Interface
1. **Home Page** (`src/app/page.tsx`):
   - Explains ReLoop's circular mission, highlights evidence grounding, and includes a 1-click sample chair walkthrough.
2. **Assessment Page** (`src/app/assess/page.tsx`):
   - Photo upload and text description inputs, pilot city selector, visual observation feedback, and condition disambiguation questions.
3. **Results Page** (`src/app/results/page.tsx`):
   - Ranked cards (`Repair` > `Reuse` > `Donate` > `Recycle` > `Dispose`), municipal citations, matching locations, interactive map, and outcome recording with self-reported kg.
4. **Directory & Map** (`src/app/directory/page.tsx` & `src/components/DirectoryMap.tsx`):
   - Interactive category filters, map pinboard synchronized with directory cards, and external directions links without background GPS tracking.
5. **My Outcomes** (`src/app/outcomes/page.tsx`):
   - Private personal diversion log showing completed actions, dates, and self-reported weights.
6. **Community Impact** (`src/app/community/page.tsx`):
   - Aggregated diversion metrics, action and category distributions, and a live vs. demo toggle.

### C. Testing, Build & Deployment Assets
- **Unit & Integration Test Suite** (`src/tests/reloop.test.ts`): 9 comprehensive tests covering matching, citation integrity, upload validation, stable outbox IDs, and analytics correctness.
- **Production Dockerfile** (`Dockerfile`): Multi-stage container build for Google Cloud Run.
- **Deployment Guides & Demo Script** (`docs/cloud_deployment_guide.md`, `docs/demo_script.md`, `docs/templates.md`).

---

## 2. How Does It Work for Any User (End-to-End User Experience)

Here is the exact journey any user experiences when using ReLoop:

```
[ Step 1: Input ]        User uploads photo or describes unwanted item (e.g., chair with loose leg)
       │
[ Step 2: Gemini AI ]    Gemini analyzes attributes and asks clarifying condition questions
       │
[ Step 3: Confirmation ] User verifies facts (e.g., confirms "Minor wobble or loose joint")
       │
[ Step 4: Grounding ]    Backend deterministically matches Seattle rules & curated non-profits
       │
[ Step 5: Recommendations] Ranked action cards with official municipal citations & map pins
       │
[ Step 6: Completion ]   User repairs or hands off item, records completion with optional weight (kg)
       │
[ Step 7: Impact ]       Personal log updates immediately; community diversion metrics stream to BigQuery
```

### Detailed User Flow:

### Step 1: Starting an Assessment
1. The user visits the homepage and clicks **"Assess an Item Now"** (or clicks the **"Try Sample Chair Walkthrough"**).
2. On the Assessment screen (`/assess`), the user selects their pilot city (**Seattle, WA**).
3. The user either:
   - Takes or uploads a photo (JPEG, PNG, WebP up to 8MB), or
   - Enters a text description (e.g., *"Vintage oak dining chair with a loose leg joint"*).
4. The user clicks **"Run Initial Assessment"**.

### Step 2: Preliminary AI Observations & Human Confirmation
1. Gemini on Vertex AI analyzes the item and returns structured visual observations (e.g., Category: Furniture, Materials: Wood, Condition: Good/Usable).
2. The user sees a clear note: **"Visual observations are separated from confirmed facts."**
3. The app presents targeted follow-up questions to disambiguate the item's true state:
   - *"Are there any broken joints, missing screws, or severe structural wobbles?"*
   - Options: *"Completely solid and sturdy"*, *"Minor wobble or loose joint"*, *"Broken part needing hardware repair"*.
4. The user selects the answer and clicks **"Synthesize Verified Recommendations"**.

### Step 3: Viewing Grounded Recommendations & Citations
1. The user is redirected to the **Results** screen (`/results`).
2. The circular hierarchy ranks actions logically:
   - **#1 Repair**: Recommends Ballard Tool Library Fixers Collective with workshop guidance.
   - **#2 Reuse / Bulky Disposal**: Explains Seattle Public Utilities Bulky Item Collection rules if repair isn't possible.
3. Every recommendation shows:
   - **Municipal Rule Citation**: Exact text from the city guidelines and a link to the official municipal source.
   - **Curated Organizations**: Only verified non-profits from the directory with their address, verification date, and acceptance criteria.
   - **Synchronized Map & Directions**: Clicking an organization highlights it on the map and provides an external **"Get Directions"** link.

### Step 4: Recording a Completed Outcome
1. Choosing an option is clearly distinguished from completing it. When the user has actually repaired, donated, or recycled the item, they scroll to **"Record Completed Outcome"**.
2. The user optionally inputs the item's weight in kilograms (e.g., `6.5` kg).
   - If left blank, it is recorded as *unspecified* (never as zero, preserving statistical integrity).
3. The user clicks **"Record Completion"**.

### Step 5: Personal & Community Dashboards
1. **My Outcomes (`/outcomes`)**:
   - The user sees their personal circular timeline with item category, action taken, completion date, and weight diverted from landfill.
2. **Community Impact (`/community`)**:
   - The user views city-wide statistics.
   - Shows total completed actions, breakdown by category and action, and self-reported kilograms diverted.
   - **Integrity Rule**: Landfill disposal items are **never** counted toward diversion numbers. Users can toggle between demo sample data and the live BigQuery stream.

---

## 3. How to Run and Verify Locally

Run these commands in PowerShell:

```powershell
# Run the local development server (with hot reload)
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm.cmd run dev

# Run automated unit tests
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm.cmd test

# Run optimized production build
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm.cmd run build
npm.cmd start
```

Open your browser at: **`http://localhost:3000`**
- All sample data and deterministic AI pathways work immediately out-of-the-box in `DEMO_MODE=true` without requiring cloud credentials.
- When ready to connect to Google Cloud, set `DEMO_MODE=false` in `.env.local` following [docs/cloud_deployment_guide.md](file:///c:/Users/mylla/OneDrive/Desktop/AI_BuilderCup2.0/docs/cloud_deployment_guide.md).
