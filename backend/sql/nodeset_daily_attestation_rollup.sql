-- Daily rollup table for fast below-threshold queries.
-- Purpose: reduce scan size from (epochs * validators) to (days * validators).
-- Expected row reduction: ~225x for day-based windows.

CREATE TABLE IF NOT EXISTS validators_daily_attestation_rollup
(
    day_partition Int64,
    val_id Int64,
    val_nos_id Nullable(UInt32),
    val_nos_name Nullable(String),
    active_duty_epochs UInt32,
    actual_rewards UInt64,
    theoretical_max_rewards UInt64,
    attestations_made UInt32,
    blocks_proposed UInt32,
    proposer_slots UInt32,
    sync_percent_sum Float64,
    sync_percent_count UInt32,
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY day_partition
ORDER BY (day_partition, val_id);

-- One-time backfill (can take time on large datasets).
INSERT INTO validators_daily_attestation_rollup
SELECT
    intDiv(epoch, 225) as day_partition,
    val_id,
    anyLast(val_nos_id) as val_nos_id,
    anyLast(val_nos_name) as val_nos_name,
    countIf(val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as active_duty_epochs,
    sumIf(COALESCE(att_earned_reward, 0), val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as actual_rewards,
    sumIf(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0), val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as theoretical_max_rewards,
    sumIf(att_happened = 1, val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as attestations_made,
    sumIf((is_proposer = 1) AND (block_proposed = 1), val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as blocks_proposed,
    sumIf(is_proposer = 1, val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL) as proposer_slots,
    sumIf(COALESCE(sync_percent, 0), val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL AND sync_percent IS NOT NULL) as sync_percent_sum,
    countIf(val_status IN ('active_ongoing', 'active_slashed') AND val_nos_id IS NOT NULL AND sync_percent IS NOT NULL) as sync_percent_count,
    now() as updated_at
FROM validators_summary
GROUP BY day_partition, val_id;

-- Daily refresh pattern:
-- 1) Delete one day partition.
-- 2) Re-insert that partition from validators_summary.
--
-- Example:
-- ALTER TABLE validators_daily_attestation_rollup DELETE WHERE day_partition = 1924;
-- INSERT INTO validators_daily_attestation_rollup
-- SELECT ...same SELECT above...
-- FROM validators_summary
-- WHERE intDiv(epoch, 225) = 1924
-- GROUP BY day_partition, val_id;
