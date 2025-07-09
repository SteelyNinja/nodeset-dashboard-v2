#!/usr/bin/env python3
"""
NodeSet API Router
Endpoints for NodeSet-specific validator operations and monitoring
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional, Union
import logging
from services.clickhouse_service import clickhouse_service
from corrected_theoretical_performance import calculate_corrected_theoretical_performance

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/validators_down")
async def get_validators_down(
    limit: int = Query(100, description="Maximum number of validators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get NodeSet validators that have missed attestations for the last 3 epochs in a row.
    Excludes exited validators and those in withdrawal process.
    
    Returns:
        List of active validators with operator and validator_id that have missed 3 consecutive attestations
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        start_epoch = latest_epoch - 2  # 3 epochs total: latest, latest-1, latest-2
        
        # Query to find validators that missed attestations in all 3 epochs
        # Exclude exited validators by checking their status in the latest epoch
        query = f"""
        WITH validator_epochs AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                val_status,
                CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
        ),
        active_validators AS (
            SELECT DISTINCT val_id
            FROM validator_epochs
            WHERE epoch = {latest_epoch}
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        ),
        consecutive_misses AS (
            SELECT 
                ve.val_id,
                ve.val_nos_name,
                COUNT(*) as total_epochs,
                SUM(ve.missed_attestation) as missed_epochs
            FROM validator_epochs ve
            INNER JOIN active_validators av ON ve.val_id = av.val_id
            GROUP BY ve.val_id, ve.val_nos_name
            HAVING COUNT(*) = 3 AND SUM(ve.missed_attestation) = 3
        )
        SELECT 
            val_nos_name as operator,
            val_id as validator_id,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch
        FROM consecutive_misses
        ORDER BY val_nos_name, val_id
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 4:
                results.append({
                    'operator': row[0],
                    'validator_id': int(row[1]),
                    'latest_epoch': int(row[2]),
                    'start_epoch': int(row[3]),
                    'consecutive_misses': 3
                })
        
        logger.info(f"Found {len(results)} validators with 3 consecutive missed attestations")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get validators down: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/validators_down/extended")
async def get_validators_down_extended(
    epochs_back: int = Query(2, description="Number of consecutive epochs to check", ge=2, le=10),
    limit: int = Query(100, description="Maximum number of validators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get NodeSet validators that have missed attestations for N consecutive epochs.
    Excludes exited validators and those in withdrawal process.
    
    Args:
        epochs_back: Number of consecutive epochs to check (default: 2)
        limit: Maximum number of validators to return
        
    Returns:
        List of active validators with operator and validator_id that have missed N consecutive attestations
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        start_epoch = latest_epoch - epochs_back + 1
        
        # Build query to find validators that missed attestations in all specified epochs
        # Exclude exited validators by checking their status in the latest epoch
        query = f"""
        WITH validator_epochs AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                val_status,
                CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
        ),
        active_validators AS (
            SELECT DISTINCT val_id
            FROM validator_epochs
            WHERE epoch = {latest_epoch}
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        ),
        consecutive_misses AS (
            SELECT 
                ve.val_id,
                ve.val_nos_name,
                COUNT(*) as total_epochs,
                SUM(ve.missed_attestation) as missed_epochs
            FROM validator_epochs ve
            INNER JOIN active_validators av ON ve.val_id = av.val_id
            GROUP BY ve.val_id, ve.val_nos_name
            HAVING COUNT(*) = {epochs_back} AND SUM(ve.missed_attestation) = {epochs_back}
        )
        SELECT 
            val_nos_name as operator,
            val_id as validator_id,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch,
            {epochs_back} as consecutive_misses
        FROM consecutive_misses
        ORDER BY val_nos_name, val_id
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 5:
                results.append({
                    'operator': row[0],
                    'validator_id': int(row[1]),
                    'latest_epoch': int(row[2]),
                    'start_epoch': int(row[3]),
                    'consecutive_misses': int(row[4])
                })
        
        logger.info(f"Found {len(results)} validators with {epochs_back} consecutive missed attestations")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get validators down extended: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/validators_down/summary")
async def get_validators_down_summary() -> Dict[str, Any]:
    """
    Get summary statistics about validators that have missed recent attestations.
    Excludes exited validators and those in withdrawal process.
    
    Returns:
        Summary statistics about active validator downtime (3 consecutive epochs)
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        start_epoch = latest_epoch - 2  # 3 epochs total
        
        # Get summary statistics for 3 consecutive epochs
        query = f"""
        WITH latest_epoch_stats AS (
            SELECT 
                COUNT(*) as total_validators,
                SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as missed_latest,
                COUNT(DISTINCT val_nos_name) as total_operators
            FROM validators_summary 
            WHERE epoch = {latest_epoch} AND val_nos_name IS NOT NULL
        ),
        three_epoch_consecutive AS (
            SELECT COUNT(*) as consecutive_down_3
            FROM (
                WITH validator_epochs AS (
                    SELECT 
                        val_id,
                        val_nos_name,
                        epoch,
                        val_status,
                        CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
                    FROM validators_summary 
                    WHERE epoch >= {start_epoch} 
                    AND epoch <= {latest_epoch}
                    AND val_nos_name IS NOT NULL
                ),
                active_validators AS (
                    SELECT DISTINCT val_id
                    FROM validator_epochs
                    WHERE epoch = {latest_epoch}
                    AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
                ),
                consecutive_misses AS (
                    SELECT 
                        ve.val_id,
                        ve.val_nos_name,
                        COUNT(*) as total_epochs,
                        SUM(ve.missed_attestation) as missed_epochs
                    FROM validator_epochs ve
                    INNER JOIN active_validators av ON ve.val_id = av.val_id
                    GROUP BY ve.val_id, ve.val_nos_name
                    HAVING COUNT(*) = 3 AND SUM(ve.missed_attestation) = 3
                )
                SELECT val_id FROM consecutive_misses
            ) as consecutive
        ),
        epoch_breakdown AS (
            SELECT 
                epoch,
                COUNT(*) as total_validators_epoch,
                SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as missed_epoch
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
            GROUP BY epoch
            ORDER BY epoch DESC
        )
        SELECT 
            l.total_validators,
            l.total_operators,
            l.missed_latest,
            c.consecutive_down_3,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch,
            -- Get breakdown for each epoch
            (SELECT missed_epoch FROM epoch_breakdown WHERE epoch = {latest_epoch}) as missed_epoch_latest,
            (SELECT missed_epoch FROM epoch_breakdown WHERE epoch = {latest_epoch - 1}) as missed_epoch_minus_1,
            (SELECT missed_epoch FROM epoch_breakdown WHERE epoch = {latest_epoch - 2}) as missed_epoch_minus_2
        FROM latest_epoch_stats l
        CROSS JOIN three_epoch_consecutive c
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        if not raw_data or len(raw_data[0]) < 9:
            raise HTTPException(status_code=404, detail="No summary data found")
        
        row = raw_data[0]
        result = {
            'total_validators': int(row[0]),
            'total_operators': int(row[1]),
            'missed_latest_epoch': int(row[2]),
            'consecutive_down_3_epochs': int(row[3]),
            'latest_epoch': int(row[4]),
            'start_epoch': int(row[5]),
            'epoch_breakdown': {
                'latest_epoch': {
                    'epoch': int(row[4]),
                    'missed': int(row[6]) if row[6] else 0
                },
                'epoch_minus_1': {
                    'epoch': int(row[4]) - 1,
                    'missed': int(row[7]) if row[7] else 0
                },
                'epoch_minus_2': {
                    'epoch': int(row[4]) - 2,
                    'missed': int(row[8]) if row[8] else 0
                }
            },
            'latest_epoch_participation_rate': round(((int(row[0]) - int(row[2])) / int(row[0])) * 100, 2) if int(row[0]) > 0 else 0,
            'three_epoch_consecutive_failure_rate': round((int(row[3]) / int(row[0])) * 100, 2) if int(row[0]) > 0 else 0
        }
        
        logger.info(f"Generated validators down summary for 3 consecutive epochs {start_epoch}-{latest_epoch}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get validators down summary: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/below_threshold")
async def get_below_threshold(
    limit: int = Query(100, description="Maximum number of validators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get NodeSet validators that are below 97% of theoretical maximum attestation rewards over a 1 day period (225 epochs).
    
    Theoretical maximum attestation rewards = (att_earned_reward + att_missed_reward).
    This represents what a validator could have earned with perfect attestation performance.
    
    Returns:
        List of validators with their attestation reward performance below the 97% threshold
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        start_epoch = latest_epoch - 224  # 225 epochs total (1 day)
        threshold = 97.0  # 97% threshold
        
        # Check if we have sufficient data availability
        min_epoch_query = "SELECT MIN(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        min_epoch_data = clickhouse_service.execute_query(min_epoch_query)
        
        if not min_epoch_data or not min_epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No minimum epoch data found")
        
        min_available_epoch = int(min_epoch_data[0][0])
        epochs_requested = 225
        
        # Check if we have enough historical data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            return {
                "error": "Insufficient data available",
                "message": f"Not enough historical data to perform {epochs_requested} epoch analysis",
                "epochs_requested": epochs_requested,
                "epochs_available": epochs_available,
                "latest_epoch": latest_epoch,
                "min_available_epoch": min_available_epoch,
                "requested_start_epoch": start_epoch,
                "data_completeness_percentage": round((epochs_available / epochs_requested) * 100, 2)
            }
        
        # Query to find validators below threshold
        # Calculate theoretical maximum rewards vs actual rewards
        query = f"""
        WITH validator_rewards AS (
            SELECT 
                val_id,
                val_nos_name,
                COUNT(*) as total_epochs,
                -- Actual attestation rewards earned
                SUM(COALESCE(att_earned_reward, 0)) as actual_rewards,
                -- Theoretical maximum attestation rewards (earned + missed)
                SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) as theoretical_max_rewards,
                -- Performance metrics
                SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
                SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
                SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
                SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as blocks_missed,
                AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
            GROUP BY val_id, val_nos_name
            HAVING COUNT(*) >= 1  -- Must have at least some data
        ),
        performance_analysis AS (
            SELECT 
                val_id,
                val_nos_name,
                total_epochs,
                actual_rewards,
                theoretical_max_rewards,
                attestations_made,
                attestations_missed,
                blocks_proposed,
                blocks_missed,
                avg_sync_performance,
                -- Calculate reward percentage
                CASE 
                    WHEN theoretical_max_rewards > 0 THEN (actual_rewards * 100.0 / theoretical_max_rewards)
                    ELSE 0.0
                END as reward_percentage
            FROM validator_rewards
        )
        SELECT 
            val_nos_name as operator,
            val_id as validator_id,
            total_epochs,
            actual_rewards,
            theoretical_max_rewards,
            reward_percentage,
            attestations_made,
            attestations_missed,
            blocks_proposed,
            blocks_missed,
            avg_sync_performance,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch,
            {threshold} as threshold_percentage
        FROM performance_analysis
        WHERE reward_percentage < {threshold}
        ORDER BY reward_percentage ASC, val_nos_name, val_id
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 14:
                results.append({
                    'operator': row[0],
                    'validator_id': int(row[1]),
                    'total_epochs': int(row[2]),
                    'actual_rewards': int(row[3]),
                    'theoretical_max_rewards': int(row[4]),
                    'reward_percentage': float(row[5]),
                    'attestations_made': int(row[6]),
                    'attestations_missed': int(row[7]),
                    'blocks_proposed': int(row[8]),
                    'blocks_missed': int(row[9]),
                    'avg_sync_performance': float(row[10]) if row[10] not in ['\\N', None, ''] else 0.0,
                    'latest_epoch': int(row[11]),
                    'start_epoch': int(row[12]),
                    'threshold_percentage': float(row[13])
                })
        
        logger.info(f"Found {len(results)} validators below {threshold}% reward threshold for 1 day period")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get below threshold validators: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/below_threshold/extended")
async def get_below_threshold_extended(
    days: int = Query(1, description="Number of days to analyze (1-31)", ge=1, le=31),
    threshold: float = Query(97.0, description="Reward percentage threshold (90-99%)", ge=90.0, le=99.0),
    limit: int = Query(100, description="Maximum number of validators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get NodeSet validators that are below the specified attestation reward percentage threshold over a configurable time period.
    Each day is counted as 225 epochs, with the first day back from the latest epoch stored.
    
    Theoretical maximum attestation rewards = (att_earned_reward + att_missed_reward).
    This represents what a validator could have earned with perfect attestation performance.
    
    Args:
        days: Number of days to analyze (1-31)
        threshold: Reward percentage threshold (90-99%)
        limit: Maximum number of validators to return
        
    Returns:
        List of validators with their attestation reward performance below the specified threshold
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        total_epochs = days * 225  # 225 epochs per day
        start_epoch = latest_epoch - total_epochs + 1
        
        # Check if we have sufficient data availability
        min_epoch_query = "SELECT MIN(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        min_epoch_data = clickhouse_service.execute_query(min_epoch_query)
        
        if not min_epoch_data or not min_epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No minimum epoch data found")
        
        min_available_epoch = int(min_epoch_data[0][0])
        
        # Check if we have enough historical data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            return {
                "error": "Insufficient data available",
                "message": f"Not enough historical data to perform {total_epochs} epoch analysis ({days} days)",
                "epochs_requested": total_epochs,
                "epochs_available": epochs_available,
                "days_requested": days,
                "days_available": round(epochs_available / 225, 2),
                "latest_epoch": latest_epoch,
                "min_available_epoch": min_available_epoch,
                "requested_start_epoch": start_epoch,
                "data_completeness_percentage": round((epochs_available / total_epochs) * 100, 2)
            }
        
        # Query to find validators below threshold
        # Calculate theoretical maximum rewards vs actual rewards
        query = f"""
        WITH validator_rewards AS (
            SELECT 
                val_id,
                val_nos_name,
                COUNT(*) as total_epochs,
                -- Actual attestation rewards earned
                SUM(COALESCE(att_earned_reward, 0)) as actual_rewards,
                -- Theoretical maximum attestation rewards (earned + missed)
                SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) as theoretical_max_rewards,
                -- Performance metrics
                SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
                SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
                SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
                SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as blocks_missed,
                AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance,
                -- Daily breakdown for most recent day
                SUM(CASE WHEN epoch > {latest_epoch} - 225 THEN COALESCE(att_earned_reward, 0) ELSE 0 END) as day_1_actual,
                SUM(CASE WHEN epoch > {latest_epoch} - 225 THEN COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0) ELSE 0 END) as day_1_theoretical
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
            GROUP BY val_id, val_nos_name
            HAVING COUNT(*) >= 1  -- Must have at least some data
        ),
        performance_analysis AS (
            SELECT 
                val_id,
                val_nos_name,
                total_epochs,
                actual_rewards,
                theoretical_max_rewards,
                attestations_made,
                attestations_missed,
                blocks_proposed,
                blocks_missed,
                avg_sync_performance,
                day_1_actual,
                day_1_theoretical,
                -- Calculate reward percentage
                CASE 
                    WHEN theoretical_max_rewards > 0 THEN (actual_rewards * 100.0 / theoretical_max_rewards)
                    ELSE 0.0
                END as reward_percentage,
                -- Calculate day 1 percentage
                CASE 
                    WHEN day_1_theoretical > 0 THEN (day_1_actual * 100.0 / day_1_theoretical)
                    ELSE 0.0
                END as day_1_percentage
            FROM validator_rewards
        )
        SELECT 
            val_nos_name as operator,
            val_id as validator_id,
            total_epochs,
            actual_rewards,
            theoretical_max_rewards,
            reward_percentage,
            attestations_made,
            attestations_missed,
            blocks_proposed,
            blocks_missed,
            avg_sync_performance,
            day_1_actual,
            day_1_theoretical,
            day_1_percentage,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch,
            {days} as days_analyzed,
            {threshold} as threshold_percentage
        FROM performance_analysis
        WHERE reward_percentage < {threshold}
        ORDER BY reward_percentage ASC, val_nos_name, val_id
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 18:
                results.append({
                    'operator': row[0],
                    'validator_id': int(row[1]),
                    'total_epochs': int(row[2]),
                    'actual_rewards': int(row[3]),
                    'theoretical_max_rewards': int(row[4]),
                    'reward_percentage': float(row[5]),
                    'attestations_made': int(row[6]),
                    'attestations_missed': int(row[7]),
                    'blocks_proposed': int(row[8]),
                    'blocks_missed': int(row[9]),
                    'avg_sync_performance': float(row[10]) if row[10] not in ['\\N', None, ''] else 0.0,
                    'day_1_actual_rewards': int(row[11]),
                    'day_1_theoretical_rewards': int(row[12]),
                    'day_1_percentage': float(row[13]),
                    'latest_epoch': int(row[14]),
                    'start_epoch': int(row[15]),
                    'days_analyzed': int(row[16]),
                    'threshold_percentage': float(row[17])
                })
        
        logger.info(f"Found {len(results)} validators below {threshold}% reward threshold for {days} day(s) period")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get below threshold validators extended: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/theoretical_performance")
async def get_theoretical_performance(
    limit: int = Query(100, description="Maximum number of operators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get corrected theoretical attestation performance analysis for NodeSet operators over a 1 day period (225 epochs).
    
    CORRECTED CALCULATION:
    - Uses net rewards (actual rewards - penalties) vs theoretical maximum
    - Properly handles missing data points and pending validators
    - Includes penalties in the performance calculation
    - Distinguishes between data coverage issues and actual performance problems
    
    Returns:
        List of operators with their corrected theoretical attestation performance metrics
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        start_epoch = latest_epoch - 224  # 225 epochs total (1 day)
        
        # Check if we have sufficient data availability
        min_epoch_query = "SELECT MIN(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        min_epoch_data = clickhouse_service.execute_query(min_epoch_query)
        
        if not min_epoch_data or not min_epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No minimum epoch data found")
        
        min_available_epoch = int(min_epoch_data[0][0])
        epochs_requested = 225
        
        # Check if we have enough historical data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            return {
                "error": "Insufficient data available",
                "message": f"Not enough historical data to perform {epochs_requested} epoch analysis",
                "epochs_requested": epochs_requested,
                "epochs_available": epochs_available,
                "latest_epoch": latest_epoch,
                "min_available_epoch": min_available_epoch,
                "requested_start_epoch": start_epoch,
                "data_completeness_percentage": round((epochs_available / epochs_requested) * 100, 2)
            }
        
        # Get list of all operators first
        operators_query = f"""
        SELECT DISTINCT val_nos_name
        FROM validators_summary 
        WHERE epoch >= {start_epoch} 
        AND epoch <= {latest_epoch}
        AND val_nos_name IS NOT NULL
        AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        ORDER BY val_nos_name
        LIMIT {limit}
        """
        
        operators_data = clickhouse_service.execute_query(operators_query)
        
        # Calculate corrected performance for each operator
        results = []
        for operator_row in operators_data:
            operator_name = operator_row[0]
            
            # Get corrected calculation for this operator
            corrected_result = calculate_corrected_theoretical_performance(
                operator_name=operator_name,
                start_epoch=start_epoch,
                end_epoch=latest_epoch
            )
            
            if 'error' not in corrected_result:
                results.append({
                    'operator': corrected_result['operator'],
                    'validator_count': corrected_result['validator_count'],
                    'total_actual_rewards': corrected_result['total_actual_rewards'],
                    'total_penalties': corrected_result['total_penalties'],
                    'net_rewards': corrected_result['net_rewards'],
                    'max_possible_rewards': corrected_result['max_possible_rewards'],
                    'corrected_theoretical_performance': corrected_result['corrected_theoretical_performance'],
                    'attestation_success_rate': corrected_result['attestation_success_rate'],
                    'data_coverage_percentage': corrected_result['data_coverage_percentage'],
                    'active_duty_periods': corrected_result['active_duty_periods'],
                    'successful_attestations': corrected_result['successful_attestations'],
                    'missed_attestations': corrected_result['missed_attestations'],
                    'pending_periods': corrected_result['pending_periods'],
                    'missing_data_points': corrected_result['missing_data_points'],
                    'avg_reward_per_attestation': corrected_result['avg_reward_per_attestation'],
                    'latest_epoch': corrected_result['end_epoch'],
                    'start_epoch': corrected_result['start_epoch'],
                    'epochs_analyzed': corrected_result['epochs_analyzed'],
                    # Include original calculation for comparison
                    'original_flawed_percentage': corrected_result.get('original_flawed_percentage', 0.0),
                    'improvement_vs_original': corrected_result.get('improvement_vs_original', 0.0)
                })
        
        # Sort by corrected performance (descending)
        results.sort(key=lambda x: x['corrected_theoretical_performance'], reverse=True)
        
        logger.info(f"Found corrected theoretical performance data for {len(results)} operators over 1 day period")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get theoretical performance: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/theoretical_performance/extended")
async def get_theoretical_performance_extended(
    days: int = Query(1, description="Number of days to analyze (1-31)", ge=1, le=31),
    limit: int = Query(100, description="Maximum number of operators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get theoretical attestation performance analysis for NodeSet operators over a configurable time period.
    Shows the percentage of attestation rewards operators have vs theoretical maximum, averaged across all validators they control.
    Each day is counted as 225 epochs, with the first day back from the latest epoch stored.
    
    Theoretical maximum attestation rewards = (att_earned_reward + att_missed_reward).
    Results are aggregated by operator (val_nos_name) and averaged across all their validators.
    
    Args:
        days: Number of days to analyze (1-31)
        limit: Maximum number of operators to return
        
    Returns:
        List of operators with their averaged theoretical attestation performance metrics
    """
    try:
        if not clickhouse_service.is_available():
            raise HTTPException(status_code=503, detail="ClickHouse service unavailable")
        
        # Get the latest epoch first
        epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        epoch_data = clickhouse_service.execute_query(epoch_query)
        
        if not epoch_data or not epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No epoch data found")
        
        latest_epoch = int(epoch_data[0][0])
        total_epochs = days * 225  # 225 epochs per day
        start_epoch = latest_epoch - total_epochs + 1
        
        # Check if we have sufficient data availability
        min_epoch_query = "SELECT MIN(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
        min_epoch_data = clickhouse_service.execute_query(min_epoch_query)
        
        if not min_epoch_data or not min_epoch_data[0][0]:
            raise HTTPException(status_code=404, detail="No minimum epoch data found")
        
        min_available_epoch = int(min_epoch_data[0][0])
        
        # Check if we have enough historical data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            return {
                "error": "Insufficient data available",
                "message": f"Not enough historical data to perform {total_epochs} epoch analysis ({days} days)",
                "epochs_requested": total_epochs,
                "epochs_available": epochs_available,
                "days_requested": days,
                "days_available": round(epochs_available / 225, 2),
                "latest_epoch": latest_epoch,
                "min_available_epoch": min_available_epoch,
                "requested_start_epoch": start_epoch,
                "data_completeness_percentage": round((epochs_available / total_epochs) * 100, 2)
            }
        
        # Query to get operator-level theoretical performance
        query = f"""
        WITH validator_rewards AS (
            SELECT 
                val_id,
                val_nos_name,
                COUNT(*) as total_epochs,
                -- Actual attestation rewards earned per validator
                SUM(COALESCE(att_earned_reward, 0)) as actual_rewards,
                -- Theoretical maximum attestation rewards per validator
                SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) as theoretical_max_rewards,
                -- Performance metrics per validator
                SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
                SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
                SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
                SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as blocks_missed,
                AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance,
                -- Recent day performance (most recent 225 epochs)
                SUM(CASE WHEN epoch > {latest_epoch} - 225 THEN COALESCE(att_earned_reward, 0) ELSE 0 END) as recent_day_actual,
                SUM(CASE WHEN epoch > {latest_epoch} - 225 THEN COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0) ELSE 0 END) as recent_day_theoretical,
                -- Calculate per-validator reward percentage
                CASE 
                    WHEN SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) > 0 
                    THEN (SUM(COALESCE(att_earned_reward, 0)) * 100.0 / SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)))
                    ELSE 0.0
                END as validator_reward_percentage
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
            GROUP BY val_id, val_nos_name
            HAVING COUNT(*) >= 1  -- Must have at least some data
        ),
        operator_performance AS (
            SELECT 
                val_nos_name as operator,
                COUNT(*) as validator_count,
                -- Aggregate totals across all validators for this operator
                SUM(total_epochs) as total_epochs_all_validators,
                SUM(actual_rewards) as total_actual_rewards,
                SUM(theoretical_max_rewards) as total_theoretical_max_rewards,
                SUM(attestations_made) as total_attestations_made,
                SUM(attestations_missed) as total_attestations_missed,
                SUM(blocks_proposed) as total_blocks_proposed,
                SUM(blocks_missed) as total_blocks_missed,
                AVG(avg_sync_performance) as avg_sync_performance_all_validators,
                -- Recent day totals
                SUM(recent_day_actual) as total_recent_day_actual,
                SUM(recent_day_theoretical) as total_recent_day_theoretical,
                -- Average reward percentage across all validators for this operator
                AVG(validator_reward_percentage) as avg_reward_percentage,
                -- Calculate operator-level reward percentage using totals
                CASE 
                    WHEN SUM(theoretical_max_rewards) > 0 THEN (SUM(actual_rewards) * 100.0 / SUM(theoretical_max_rewards))
                    ELSE 0.0
                END as operator_reward_percentage,
                -- Calculate recent day operator percentage
                CASE 
                    WHEN SUM(recent_day_theoretical) > 0 THEN (SUM(recent_day_actual) * 100.0 / SUM(recent_day_theoretical))
                    ELSE 0.0
                END as recent_day_percentage
            FROM validator_rewards
            GROUP BY val_nos_name
        )
        SELECT 
            operator,
            validator_count,
            total_actual_rewards,
            total_theoretical_max_rewards,
            operator_reward_percentage,
            avg_reward_percentage,
            total_attestations_made,
            total_attestations_missed,
            total_blocks_proposed,
            total_blocks_missed,
            avg_sync_performance_all_validators,
            total_recent_day_actual,
            total_recent_day_theoretical,
            recent_day_percentage,
            {latest_epoch} as latest_epoch,
            {start_epoch} as start_epoch,
            {days} as days_analyzed,
            {total_epochs} as total_epochs_analyzed
        FROM operator_performance
        ORDER BY operator_reward_percentage DESC
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 18:
                results.append({
                    'operator': row[0],
                    'validator_count': int(row[1]),
                    'total_actual_rewards': int(row[2]),
                    'total_theoretical_max_rewards': int(row[3]),
                    'operator_reward_percentage': float(row[4]),
                    'avg_validator_reward_percentage': float(row[5]),
                    'total_attestations_made': int(row[6]),
                    'total_attestations_missed': int(row[7]),
                    'total_blocks_proposed': int(row[8]),
                    'total_blocks_missed': int(row[9]),
                    'avg_sync_performance': float(row[10]) if row[10] not in ['\\N', None, ''] else 0.0,
                    'recent_day_actual_rewards': int(row[11]),
                    'recent_day_theoretical_rewards': int(row[12]),
                    'recent_day_percentage': float(row[13]),
                    'latest_epoch': int(row[14]),
                    'start_epoch': int(row[15]),
                    'days_analyzed': int(row[16]),
                    'total_epochs_analyzed': int(row[17])
                })
        
        logger.info(f"Found theoretical performance data for {len(results)} operators over {days} day(s) period")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get theoretical performance extended: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")