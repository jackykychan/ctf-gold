-- The UNIQUE(price_code, update_date) constraint already creates an index that
-- serves every query (price_code equality + update_date range/order), so this
-- explicit duplicate index just doubles write and storage cost. Drop it.
DROP INDEX IF EXISTS idx_code_update;
