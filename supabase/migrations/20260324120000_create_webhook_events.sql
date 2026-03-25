-- Create webhook_events table for Stripe webhook idempotency and audit trail
-- Phase 1: Webhook Hardening & Foundation (STRP-01, RESIL-01)

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'processed', 'failed')),
    payload JSONB,
    processing_error TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ
);

-- Index for deduplication lookups (primary use case)
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events (stripe_event_id);

-- Index for status-based queries (superadmin monitoring in Phase 2)
CREATE INDEX idx_webhook_events_status ON webhook_events (status);

-- Index for event type filtering
CREATE INDEX idx_webhook_events_event_type ON webhook_events (event_type);

-- Index for chronological listing (newest first)
CREATE INDEX idx_webhook_events_created_at ON webhook_events (created_at DESC);

-- No RLS policy needed: accessed only via service-role by webhook handler and superadmin
COMMENT ON TABLE webhook_events IS 'Stripe webhook event log for idempotency and audit trail';
