-- Provenance for each price point: 'auto' (poller) or 'manual' (Google Sheet import).
ALTER TABLE price_points ADD COLUMN source TEXT NOT NULL DEFAULT 'auto';
