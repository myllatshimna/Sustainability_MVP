# Google Cloud Deployment & Architecture Guide

This guide details the setup and deployment commands for all 8 Google Cloud technologies utilized by ReLoop.

---

## 1. Required Google Cloud APIs
Enable the required APIs in your GCP project:
```bash
gcloud services enable \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Least-Privilege IAM Guidance
Create a dedicated service account for the ReLoop Cloud Run service:
```bash
# Create service account
gcloud iam service-accounts create reloop-app-sa \
  --display-name="ReLoop Web & Worker Service Account"

# 1. Gemini on Vertex AI User
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 2. Cloud Storage Object User (Scoped to private bucket)
gcloud storage buckets add-iam-policy-binding gs://reloop-item-assessments-bucket \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectUser"

# 3. Cloud Datastore / Firestore User
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# 4. Pub/Sub Publisher
gcloud pubsub topics add-iam-policy-binding reloop-outcomes-topic \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# 5. BigQuery Data Viewer & Job User (Read-only analytics from backend)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"
```

---

## 3. Storage & Bucket Lifecycle Setup
Create the private bucket and set a 30-day automatic deletion policy for uploaded item photos:
```bash
# Create private bucket with Uniform Bucket-Level Access
gcloud storage buckets create gs://reloop-item-assessments-bucket \
  --location=us-central1 \
  --uniform-bucket-level-access

# Create lifecycle policy (delete objects older than 30 days)
cat << 'EOF' > lifecycle.json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }
  ]
}
EOF
gcloud storage buckets update gs://reloop-item-assessments-bucket --lifecycle-file=lifecycle.json
```

---

## 4. Pub/Sub Topic & BigQuery Subscription
Set up the event streaming pipeline:
```bash
# Create Pub/Sub Topic
gcloud pubsub topics create reloop-outcomes-topic

# Initialize BigQuery Table using the SQL in src/data/bigquery_schema.sql:
bq query --use_legacy_sql=false < src/data/bigquery_schema.sql

# Create Pub/Sub to BigQuery Subscription with Dead Letter Topic
gcloud pubsub subscriptions create reloop-bigquery-sub \
  --topic=reloop-outcomes-topic \
  --bigquery-table=YOUR_PROJECT_ID.reloop_analytics.outcome_events_raw \
  --use-topic-schema=false \
  --write-metadata
```

---

## 5. Cloud Run Application Deployment
Deploy the containerized Next.js web application to Cloud Run:
```bash
# Build and deploy with Google Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/reloop:latest

# Deploy to Cloud Run
gcloud run deploy reloop \
  --image gcr.io/YOUR_PROJECT_ID/reloop:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account=reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="DEMO_MODE=false,GEMINI_MODEL_ID=gemini-1.5-flash,GCS_BUCKET_NAME=reloop-item-assessments-bucket,PUBSUB_TOPIC_NAME=reloop-outcomes-topic,BIGQUERY_DATASET=reloop_analytics,BIGQUERY_TABLE=outcome_events_raw"
```

---

## 6. Cloud Run Outbox Worker / Cloud Scheduler
To continuously or periodically trigger the outbox dispatcher:
```bash
# Set up a Cloud Scheduler job to trigger the outbox worker every 2 minutes
gcloud scheduler jobs create http reloop-outbox-worker-job \
  --schedule="*/2 * * * *" \
  --uri="https://reloop-YOUR_SERVICE_URL.a.run.app/api/worker/dispatch" \
  --http-method=POST \
  --oidc-service-account-email="reloop-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

---

## 7. Firebase Authentication & Google Maps Platform
1. **Firebase Authentication**:
   - In the Firebase Console, enable **Google Sign-In** under Authentication &rarr; Sign-in method.
   - Add your authorized domain (e.g. `localhost` and your Cloud Run domain).
2. **Google Maps Platform**:
   - In the Google Cloud Console &rarr; Google Maps Platform &rarr; Credentials:
   - Create an API key restricted to **Maps JavaScript API** and restrict HTTP referrers to your web application URL.
