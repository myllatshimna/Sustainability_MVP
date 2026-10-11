-- ========================================================================
-- ReLoop BigQuery Analytics Schema & Deduplication View
-- Project: ReLoop Sustainability Circular Economy Pilot
-- ========================================================================

-- 1. Create Analytics Dataset (Run once in your GCP Project)
CREATE SCHEMA IF NOT EXISTS `reloop_analytics`
OPTIONS (
  location = 'us-central1',
  description = 'ReLoop Circular Sustainability Event Analytics'
);

-- 2. Raw Events Ingestion Table
-- Populated automatically via Pub/Sub BigQuery Subscription
CREATE TABLE IF NOT EXISTS `reloop_analytics.outcome_events_raw` (
  eventId STRING NOT NULL OPTIONS(description="Stable idempotent UUID of the outbox event"),
  schemaVersion STRING NOT NULL OPTIONS(description="Schema version, e.g. 1.0.0"),
  eventType STRING NOT NULL OPTIONS(description="Event type name, e.g. outcome.completed"),
  outcomeId STRING NOT NULL OPTIONS(description="Unique identifier of completed outcome"),
  category STRING NOT NULL OPTIONS(description="Item category, e.g. furniture, clothing, packaging"),
  action STRING NOT NULL OPTIONS(description="Circular action: repair, reuse, donate, recycle, dispose"),
  city STRING NOT NULL OPTIONS(description="Pilot city, e.g. Seattle"),
  completedAt TIMESTAMP NOT NULL OPTIONS(description="ISO timestamp when user recorded completion"),
  selfReportedWeightKg FLOAT64 OPTIONS(description="Optional user self-reported weight in kg"),
  isDemo BOOL NOT NULL OPTIONS(description="Flag identifying demo or mock data"),
  publishedAt TIMESTAMP OPTIONS(description="Timestamp when event was published by outbox worker"),
  ingestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="BigQuery ingestion timestamp")
)
PARTITION BY DATE(completedAt)
CLUSTER BY city, category, action;

-- 3. Deduplicated Analytics View
-- Eliminates duplicate event delivery from Pub/Sub and excludes demo records
CREATE OR REPLACE VIEW `reloop_analytics.v_deduped_live_outcomes` AS
WITH ranked_events AS (
  SELECT
    eventId,
    schemaVersion,
    eventType,
    outcomeId,
    category,
    action,
    city,
    completedAt,
    selfReportedWeightKg,
    isDemo,
    publishedAt,
    ingestedAt,
    ROW_NUMBER() OVER(
      PARTITION BY eventId 
      ORDER BY ingestedAt DESC
    ) as row_num
  FROM
    `reloop_analytics.outcome_events_raw`
  WHERE
    isDemo = FALSE  -- Strictly exclude demo/mock events from live metrics
)
SELECT
  eventId,
  outcomeId,
  category,
  action,
  city,
  completedAt,
  selfReportedWeightKg,
  -- Diversion classification: repair, reuse, donate, recycle count as diversion; disposal does not
  CASE 
    WHEN action IN ('repair', 'reuse', 'donate', 'recycle') THEN TRUE 
    ELSE FALSE 
  END AS isDivertedFromDisposal
FROM
  ranked_events
WHERE
  row_num = 1;

-- 4. Daily Aggregated Circular Metrics Query
-- Used by backend reporting & dashboard aggregation
CREATE OR REPLACE VIEW `reloop_analytics.v_daily_city_metrics` AS
SELECT
  city,
  DATE(completedAt) AS metric_date,
  category,
  action,
  COUNT(outcomeId) AS total_actions_count,
  COUNTIF(isDivertedFromDisposal) AS diverted_actions_count,
  -- Calculate sum only for reported weights, treating null as unknown (not zero)
  ROUND(SUM(CASE WHEN isDivertedFromDisposal THEN selfReportedWeightKg ELSE NULL END), 2) AS total_diverted_kg_reported,
  COUNT(selfReportedWeightKg) AS items_with_weight_count
FROM
  `reloop_analytics.v_deduped_live_outcomes`
GROUP BY
  city, metric_date, category, action;
