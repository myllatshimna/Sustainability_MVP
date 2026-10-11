# ReLoop — Circular Sustainability & AI Assessment Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.0-black)](https://nextjs.org/)
[![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Vertex%20AI%20%7C%20BigQuery%20%7C%20PubSub-blue)](https://cloud.google.com/)

**ReLoop** is a production-ready, mobile-first circular economy web application developed for the **Google AI Builder Challenge** in *Sustainability & Social Impact*.

It combines photo and description assessment powered by **Gemini on Vertex AI** with **verified municipal disposal rules** and a **curated non-profit directory** for the pilot city of **Seattle, WA**. Users evaluate items, confirm condition and materials, receive ranked circular recommendations, and record completed outcomes with self-reported diversion metrics.

---

## 🌟 Google Technologies Integration

| Technology | Purpose in ReLoop | Implementation Details |
| :--- | :--- | :--- |
| **1. Gemini on Vertex AI** | AI photo & description analysis; circular action synthesis | Uses current `@google/genai` SDK with configurable `GEMINI_MODEL_ID`. Enforces strict prompt safety, separates visual observations from user facts, and asks condition disambiguation questions. |
| **2. Cloud Storage** | Private image uploads & short-lived access | Validates image buffers (JPEG, PNG, WebP) and 8MB limit. Generates 15-minute signed URLs. Documented 30-day lifecycle deletion policy. |
| **3. Firestore** | Private assessments, directory, outcomes, & outbox | Isolates private user records. Uses atomic transactions to store completed outcomes alongside outbox events. |
| **4. Cloud Run** | Web application & outbox worker hosting | Production multi-stage `Dockerfile` with least-privilege non-root execution. Ready for automated Cloud Build deployment. |
| **5. Pub/Sub** | Reliable asynchronous analytics event publishing | Outbox pattern: worker flushes pending events with stable `eventId` (`event_outcome_<outcomeId>`), preventing duplicate publishing. |
| **6. BigQuery** | Event ingestion, deduplication view & metric aggregation | Pub/Sub BigQuery subscription routes to `outcome_events_raw`. Deduplication view partitions by `eventId`. Excludes demo data and calculates diversion (repair, reuse, donate, recycle; excludes disposal). |
| **7. Google Maps Platform** | Curated drop-off & repair center map | Displays verified coordinates without background GPS tracking. Synchronized with directory list view and external directions links. |
| **8. Firebase Authentication** | Google Sign-In & token verification | Client AuthContext supports Google Sign-In. Server-side token verification with ownership enforcement on private records. |

---

## 🏗️ Architecture & Grounding Rules

```
[ User Device ] ── (Photo/Description) ──> [ Next.js App on Cloud Run ]
                                                  │
                 ┌────────────────────────────────┼──────────────────────────────┐
                 ▼                                ▼                              ▼
     [ Gemini on Vertex AI ]          [ Deterministic Matching ]       [ Cloud Storage ]
     • Visual observations             • Seattle Municipal Rules         • 8MB / MIME check
     • Disambiguation questions        • Curated Non-Profit Orgs         • 15-min Signed URLs
                 │                                │
                 └────────────────┬───────────────┘
                                  ▼
                     [ Citation Verification ]
                     • Strips ungrounded org/rule IDs
                                  │
                                  ▼
                 [ Firestore Atomic Transaction ]
                     ├── Outcome Record (User Private)
                     └── Outbox Event (Pending Status)
                                  │
                                  ▼
                   [ Pub/Sub / BigQuery Pipeline ]
                     ├── Pub/Sub Topic: reloop-outcomes-topic
                     ├── BigQuery Subscription: outcome_events_raw
                     └── Deduplicated View: v_deduped_live_outcomes
```

---

## 🚀 Quick Start (Local Demo Mode)

ReLoop features a built-in zero-cloud **Demo Mode** (`DEMO_MODE=true`) which runs locally without active GCP credentials.

### Prerequisites
- Node.js 20+ (Node.js 24 LTS supported)
- npm 10+

### Installation & Run
```bash
# 1. Clone repository & install dependencies
git clone <repo-url>
cd AI_BuilderCup2.0
npm install

# 2. Configure environment (Demo mode enabled by default)
cp .env.example .env.local

# 3. Run unit tests
npm test

# 4. Run production build & start
npm run build
npm start
```

Visit **`http://localhost:3000`** in your browser.

---

## 🧪 Verified Test Suite

ReLoop includes unit and integration tests covering:
- **Deterministic backend matching** (Seattle pilot rules, categories, conditions)
- **Anti-hallucination citation validator** (rejection of ungrounded org/rule IDs)
- **Upload security** (magic number inspection, MIME type validation, 8MB limit)
- **Analytics correctness** (diversion calculation excluding disposal, self-reported weight accounting)
- **Stable outbox event IDs** across transactions

Run tests at any time with:
```bash
npm test
```

---

## ☁️ Live Google Cloud Setup

To transition from Demo Mode to Live Cloud Mode:

1. **Set up GCP Project & APIs**:
   Follow instructions in [docs/cloud_deployment_guide.md](file:///c:/Users/mylla/OneDrive/Desktop/AI_BuilderCup2.0/docs/cloud_deployment_guide.md).
2. **Initialize BigQuery Table & Views**:
   ```bash
   bq query --use_legacy_sql=false < src/data/bigquery_schema.sql
   ```
3. **Deploy Container to Cloud Run**:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/reloop:latest
   gcloud run deploy reloop --image gcr.io/YOUR_PROJECT_ID/reloop:latest --platform managed
   ```
4. **Switch `.env.local` or Cloud Run environment**:
   Set `DEMO_MODE=false`.

---

## 🎬 3-Minute Challenge Demo Script
For pitching or recording your presentation, follow the step-by-step walkthrough in [docs/demo_script.md](file:///c:/Users/mylla/OneDrive/Desktop/AI_BuilderCup2.0/docs/demo_script.md).
