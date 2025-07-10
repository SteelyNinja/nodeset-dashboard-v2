#!/usr/bin/env python3
"""
NodeSet API Router
Endpoints for NodeSet-specific validator operations and monitoring
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional, Union
import logging
from services.clickhouse_service import clickhouse_service

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
    limit: int = Query(100, description="Maximum number of validators to return"),
    test_operator: Optional[str] = Query(None, description="Operator address for test data generation")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get NodeSet validators that have missed attestations for N consecutive epochs.
    Excludes exited validators and those in withdrawal process.
    
    Args:
        epochs_back: Number of consecutive epochs to check (default: 2)
        limit: Maximum number of validators to return
        test_operator: Operator address for test data generation (optional)
        
    Returns:
        List of active validators with operator and validator_id that have missed N consecutive attestations
    """
    try:
        # If test_operator is provided, return mock test data
        if test_operator:
            if not clickhouse_service.is_available():
                raise HTTPException(status_code=503, detail="ClickHouse service unavailable for test data")
            
            # Get current epoch for realistic test data
            epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
            epoch_data = clickhouse_service.execute_query(epoch_query)
            
            if not epoch_data or not epoch_data[0][0]:
                raise HTTPException(status_code=404, detail="No epoch data found for test data")
            
            latest_epoch = int(epoch_data[0][0])
            start_epoch = latest_epoch - epochs_back + 1
            
            # Get real validator IDs for the test operator
            validator_query = f"""
            SELECT DISTINCT val_id
            FROM validators_summary 
            WHERE val_nos_name = '{test_operator}'
            AND epoch = {latest_epoch}
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
            ORDER BY val_id
            LIMIT {limit}
            """
            
            validator_data = clickhouse_service.execute_query(validator_query)
            
            if not validator_data:
                raise HTTPException(status_code=404, detail=f"No active validators found for operator {test_operator}")
            
            # Generate test data using real validator IDs
            test_results = []
            for row in validator_data:
                validator_id = int(row[0])
                test_results.append({
                    'operator': test_operator,
                    'validator_id': validator_id,
                    'latest_epoch': latest_epoch,
                    'start_epoch': start_epoch,
                    'consecutive_misses': epochs_back
                })
            
            logger.info(f"Generated {len(test_results)} test validators for operator {test_operator} using real validator IDs")
            return test_results
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
        
        # Check if we have enough historical data, if not use available data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            # Use available data instead of returning error
            start_epoch = min_available_epoch
            total_epochs = epochs_available
            days_actual = round(epochs_available / 225, 2)
            days = max(1, int(epochs_available / 225))  # Ensure days is an integer, minimum 1
            logger.info(f"Using {epochs_available} epochs ({days_actual} days actual) instead of requested due to insufficient data")
        
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

@router.get("/validator-accuracy")
async def get_validator_accuracy(
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)"),
    operator: Optional[str] = Query(None, description="Filter by specific NodeSet operator address")
) -> Dict[str, Any]:
    """Get comprehensive validator accuracy metrics for NodeSet operators only"""
    
    if not clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = clickhouse_service.get_nodeset_validator_accuracy(start_epoch, end_epoch, operator)
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "filters": {
                "start_epoch": start_epoch,
                "end_epoch": end_epoch,
                "operator": operator
            },
            "source": "clickhouse",
            "scope": "nodeset_validators_only"
        }
        
    except Exception as e:
        logger.error(f"Failed to get NodeSet validator accuracy: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/performance-trends")
async def get_performance_trends(
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)")
) -> Dict[str, Any]:
    """Get NodeSet performance trends across epochs"""
    
    if not clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = clickhouse_service.get_nodeset_performance_trends(start_epoch, end_epoch)
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "filters": {
                "start_epoch": start_epoch,
                "end_epoch": end_epoch
            },
            "source": "clickhouse",
            "scope": "nodeset_validators_only"
        }
        
    except Exception as e:
        logger.error(f"Failed to get NodeSet performance trends: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/validator-details")
async def get_validator_details(
    validator_id: Optional[int] = Query(None, description="Specific NodeSet validator ID"),
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)"),
    limit: int = Query(1000, description="Maximum number of records to return", le=10000)
) -> Dict[str, Any]:
    """Get detailed NodeSet validator performance data only"""
    
    if not clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = clickhouse_service.get_nodeset_validator_details(validator_id, start_epoch, end_epoch, limit)
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "filters": {
                "validator_id": validator_id,
                "start_epoch": start_epoch,
                "end_epoch": end_epoch,
                "limit": limit
            },
            "source": "clickhouse",
            "scope": "nodeset_validators_only"
        }
        
    except Exception as e:
        logger.error(f"Failed to get NodeSet validator details: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/theoretical_performance")
async def get_theoretical_performance(
    limit: int = Query(100, description="Maximum number of operators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get theoretical attestation performance analysis for NodeSet operators over a 1 day period (225 epochs).
    
    Performance calculation:
    - Uses net rewards (actual rewards - penalties) vs theoretical maximum
    - Properly handles missing data points and pending validators
    - Includes penalties in the performance calculation
    - Distinguishes between data coverage issues and actual performance problems
    
    Returns:
        List of operators with their theoretical attestation performance metrics
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
        
        # Check if we have enough historical data, if not use available data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            # Use available data instead of returning error
            start_epoch = min_available_epoch
            epochs_requested = epochs_available
            logger.info(f"Using {epochs_available} epochs instead of 225 due to insufficient data")
        
        # Single bulk query for all operators with fixed calculation
        query = f"""
        WITH validator_data AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                val_status,
                att_happened,
                att_earned_reward,
                att_missed_reward,
                att_penalty,
                -- Flag active duty periods
                CASE WHEN val_status = 'active_ongoing' THEN 1 ELSE 0 END as is_active_duty,
                -- Flag pending periods
                CASE WHEN val_status IN ('pending_initialized', 'pending_queued') THEN 1 ELSE 0 END as is_pending,
                -- Flag successful attestations
                CASE WHEN val_status = 'active_ongoing' AND att_happened = 1 THEN 1 ELSE 0 END as successful_attestation,
                -- Flag missed attestations (active but no attestation)
                CASE WHEN val_status = 'active_ongoing' AND (att_happened = 0 OR att_happened IS NULL) THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary
            WHERE epoch >= {start_epoch}
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        ),
        operator_performance AS (
            SELECT 
                val_nos_name as operator,
                COUNT(DISTINCT val_id) as validator_count,
                -- Count duty periods and attestations
                SUM(is_active_duty) as active_duty_periods,
                SUM(successful_attestation) as successful_attestations,
                SUM(missed_attestation) as missed_attestations,
                SUM(is_pending) as pending_periods,
                -- Sum rewards and penalties for active periods only
                SUM(CASE WHEN is_active_duty = 1 THEN COALESCE(att_earned_reward, 0) ELSE 0 END) as total_actual_rewards,
                SUM(CASE WHEN is_active_duty = 1 THEN COALESCE(att_penalty, 0) ELSE 0 END) as total_penalties,
                -- Calculate theoretical maximum using actual reward structure
                SUM(CASE WHEN is_active_duty = 1 THEN COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0) ELSE 0 END) as total_theoretical_max_rewards,
                -- Calculate validator coverage
                COUNT(*) as total_data_points,
                ({latest_epoch} - {start_epoch} + 1) as epochs_in_period
            FROM validator_data
            GROUP BY val_nos_name
        )
        SELECT 
            operator,
            validator_count,
            active_duty_periods,
            successful_attestations,
            missed_attestations,
            pending_periods,
            total_actual_rewards,
            total_penalties,
            total_theoretical_max_rewards,
            total_data_points,
            epochs_in_period,
            -- Calculate expected total epochs for all validators
            (validator_count * epochs_in_period) as expected_total_epochs,
            -- Net rewards after penalties
            (total_actual_rewards - total_penalties) as net_rewards,
            -- Theoretical performance using actual reward structure
            CASE 
                WHEN total_theoretical_max_rewards > 0 
                THEN ((total_actual_rewards - total_penalties) * 100.0 / total_theoretical_max_rewards)
                ELSE 0.0
            END as theoretical_performance,
            -- Attestation success rate
            CASE 
                WHEN active_duty_periods > 0 
                THEN (successful_attestations * 100.0 / active_duty_periods)
                ELSE 0.0
            END as attestation_success_rate,
            -- Data coverage
            CASE 
                WHEN (validator_count * epochs_in_period) > 0 
                THEN (total_data_points * 100.0 / (validator_count * epochs_in_period))
                ELSE 0.0
            END as data_coverage_percentage
        FROM operator_performance
        ORDER BY theoretical_performance DESC
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 16:
                try:
                    expected_total_epochs = int(float(row[11])) if row[11] is not None else 0
                    total_data_points = int(float(row[9])) if row[9] is not None else 0
                    missing_data_points = expected_total_epochs - total_data_points
                    
                    results.append({
                        'operator': str(row[0]),
                        'validator_count': int(float(row[1])) if row[1] is not None else 0,
                        'total_actual_rewards': int(float(row[6])) if row[6] is not None else 0,
                        'total_theoretical_max_rewards': int(float(row[8])) if row[8] is not None else 0,
                        'operator_reward_percentage': float(row[13]) if row[13] is not None else 0.0,
                        'avg_validator_reward_percentage': float(row[13]) if row[13] is not None else 0.0,
                        'total_attestations_made': int(float(row[3])) if row[3] is not None else 0,
                        'total_attestations_missed': int(float(row[4])) if row[4] is not None else 0,
                        'total_blocks_proposed': 0,  # Not calculated in this query
                        'total_blocks_missed': 0,    # Not calculated in this query
                        'avg_sync_performance': 0.0, # Not calculated in this query
                        'latest_epoch': latest_epoch,
                        'start_epoch': start_epoch,
                        'epochs_analyzed': int(float(row[10])) if row[10] is not None else 0,
                        # Additional fields for debugging/monitoring
                        'active_duty_periods': int(float(row[2])) if row[2] is not None else 0,
                        'successful_attestations': int(float(row[3])) if row[3] is not None else 0,
                        'missed_attestations': int(float(row[4])) if row[4] is not None else 0,
                        'pending_periods': int(float(row[5])) if row[5] is not None else 0,
                        'total_penalties': int(float(row[7])) if row[7] is not None else 0,
                        'net_rewards': int(float(row[12])) if row[12] is not None else 0,
                        'max_possible_rewards': int(float(row[8])) if row[8] is not None else 0,
                        'attestation_success_rate': float(row[14]) if row[14] is not None else 0.0,
                        'data_coverage_percentage': float(row[15]) if row[15] is not None else 0.0,
                        'missing_data_points': missing_data_points
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse row for operator {row[0]}: {e}")
                    continue
        
        logger.info(f"Found theoretical performance data for {len(results)} operators over 1 day period")
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
@router.get("/theoretical_performance_all")
async def get_theoretical_performance_all(
    limit: int = Query(100, description="Maximum number of operators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get comprehensive validator efficiency analysis using enhanced methodology.
    
    Calculates overall efficiency using the formula:
    efficiency = (attester_actualReward + proposer_actualReward + sync_actualReward) / 
                 (attester_idealReward + proposer_idealReward + sync_idealReward)
    
    Component calculations:
    - Attester efficiency: Uses consensus layer attestation rewards only
    - Proposer efficiency: Uses consensus layer proposal rewards with ideal calculation
    - Sync efficiency: Uses consensus layer sync committee rewards only
    
    Enhanced with comprehensive efficiency breakdown showing individual component efficiencies
    for attestation, block proposal, and sync committee duties.
    
    When a validator did not participate in a sync committee and/or did not propose a block,
    the respective rewards & ideal rewards are set to 0.
    
    Returns:
        List of operators with their comprehensive efficiency metrics over 1 day period (225 epochs)
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
        
        # Check if we have enough historical data, if not use available data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            start_epoch = min_available_epoch
            epochs_requested = epochs_available
            logger.info(f"Using {epochs_available} epochs instead of 225 due to insufficient data")
        
        # Calculate the period-wide average proposal reward for baseline comparison
        baseline_query = f"""
        SELECT AVG(propose_earned_reward) as period_avg_proposal_reward
        FROM validators_summary
        WHERE epoch >= {start_epoch} AND epoch <= {latest_epoch}
        AND is_proposer = 1 AND block_proposed = 1
        AND propose_earned_reward > 0
        """
        
        baseline_data = clickhouse_service.execute_query(baseline_query)
        period_avg_reward = float(baseline_data[0][0]) if baseline_data and baseline_data[0][0] else 47000000  # Fallback average
        
        # Query for comprehensive efficiency analysis with corrected proposer calculation
        query = f"""
        SELECT 
            val_nos_name as operator,
            COUNT(DISTINCT val_id) as validator_count,
            -- Attestation rewards (unchanged)
            SUM(COALESCE(att_earned_reward, 0)) as total_attester_actual_reward,
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) as total_attester_ideal_reward,
            -- Proposer rewards (corrected with baseline comparison)
            SUM(CASE WHEN is_proposer = 1 THEN COALESCE(propose_earned_reward, 0) ELSE 0 END) as total_proposer_actual_reward,
            SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) as total_proposer_ideal_reward,
            -- Sync committee rewards (unchanged)
            SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) ELSE 0 END) as total_sync_actual_reward,
            SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END) as total_sync_ideal_reward,
            -- Performance metrics
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as successful_attestations,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as missed_attestations,
            SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as successful_proposals,
            SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as missed_proposals,
            SUM(CASE WHEN is_proposer = 1 THEN 1 ELSE 0 END) as total_proposer_duties,
            SUM(CASE WHEN is_sync = 1 THEN 1 ELSE 0 END) as total_sync_duties,
            AVG(CASE WHEN is_sync = 1 AND sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_participation,
            COUNT(*) as total_epochs_data
        FROM validators_summary
        WHERE epoch >= {start_epoch}
        AND epoch <= {latest_epoch}
        AND val_nos_name IS NOT NULL
        AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        GROUP BY val_nos_name
        ORDER BY (
            CASE 
                WHEN (SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) + 
                      SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) + 
                      SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END)) > 0 
                THEN ((SUM(COALESCE(att_earned_reward, 0)) + 
                       SUM(CASE WHEN is_proposer = 1 THEN COALESCE(propose_earned_reward, 0) ELSE 0 END) + 
                       SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) ELSE 0 END)) * 100.0 / 
                      (SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) + 
                       SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) + 
                       SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END)))
                ELSE 0.0
            END
        ) DESC
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 16:
                try:
                    # Calculate efficiencies from raw data
                    attester_actual = int(float(row[2])) if row[2] is not None else 0
                    attester_ideal = int(float(row[3])) if row[3] is not None else 0
                    proposer_actual = int(float(row[4])) if row[4] is not None else 0
                    proposer_ideal = int(float(row[5])) if row[5] is not None else 0
                    sync_actual = int(float(row[6])) if row[6] is not None else 0
                    sync_ideal = int(float(row[7])) if row[7] is not None else 0
                    
                    # Calculate individual efficiencies
                    attester_efficiency = (attester_actual * 100.0 / attester_ideal) if attester_ideal > 0 else 0.0
                    proposer_efficiency = min(100.0, (proposer_actual * 100.0 / proposer_ideal)) if proposer_ideal > 0 else 0.0
                    sync_efficiency = (sync_actual * 100.0 / sync_ideal) if sync_ideal > 0 else 0.0
                    
                    # Calculate capped proposer actual for overall efficiency (cap at baseline)
                    proposer_actual_capped = min(proposer_actual, proposer_ideal) if proposer_ideal > 0 else proposer_actual
                    total_actual_capped = attester_actual + proposer_actual_capped + sync_actual
                    total_ideal = attester_ideal + proposer_ideal + sync_ideal
                    
                    overall_efficiency = (total_actual_capped * 100.0 / total_ideal) if total_ideal > 0 else 0.0
                    
                    results.append({
                        'operator': str(row[0]),
                        'validator_count': int(float(row[1])) if row[1] is not None else 0,
                        # Reward components
                        'attester_actual_reward': attester_actual,
                        'proposer_actual_reward': proposer_actual,
                        'sync_actual_reward': sync_actual,
                        'attester_ideal_reward': attester_ideal,
                        'proposer_ideal_reward': proposer_ideal,
                        'sync_ideal_reward': sync_ideal,
                        'total_actual_reward': total_actual_capped,
                        'total_ideal_reward': total_ideal,
                        # Efficiency metrics
                        'overall_efficiency': overall_efficiency,
                        'attester_efficiency': attester_efficiency,
                        'proposer_efficiency': proposer_efficiency,
                        'sync_efficiency': sync_efficiency,
                        # Performance metrics
                        'successful_attestations': int(float(row[8])) if row[8] is not None else 0,
                        'missed_attestations': int(float(row[9])) if row[9] is not None else 0,
                        'successful_proposals': int(float(row[10])) if row[10] is not None else 0,
                        'missed_proposals': int(float(row[11])) if row[11] is not None else 0,
                        'total_proposer_duties': int(float(row[12])) if row[12] is not None else 0,
                        'total_sync_duties': int(float(row[13])) if row[13] is not None else 0,
                        'avg_sync_participation': float(row[14]) if row[14] not in ['\\N', None, ''] else 0.0,
                        'total_epochs_data': int(float(row[15])) if row[15] is not None else 0,
                        'latest_epoch': latest_epoch,
                        'start_epoch': start_epoch,
                        'epochs_analyzed': epochs_requested
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse row for operator {row[0]}: {e}")
                    continue
        
        logger.info(f"Found comprehensive efficiency data for {len(results)} operators over {epochs_requested} epochs")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get comprehensive theoretical performance: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@router.get("/theoretical_performance_all/extended")
async def get_theoretical_performance_all_extended(
    days: int = Query(1, description="Number of days to analyze (1-31)", ge=1, le=31),
    limit: int = Query(100, description="Maximum number of operators to return")
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Get comprehensive validator efficiency analysis using industry-standard methodology over configurable time period.
    
    Calculates overall efficiency using the formula:
    efficiency = (attester_actualReward + proposer_actualReward + sync_actualReward) / 
                 (attester_idealReward + proposer_idealReward + sync_idealReward)
    
    Component calculations:
    - Attester efficiency: Uses consensus layer attestation rewards only
    - Proposer efficiency: Uses max(actual_reward, epoch_median_reward) for ideal calculation  
    - Sync efficiency: Uses consensus layer sync committee rewards only
    
    When a validator did not participate in a sync committee and/or did not propose a block,
    the respective rewards & ideal rewards are set to 0.
    
    Args:
        days: Number of days to analyze (1-31), each day = 225 epochs
        limit: Maximum number of operators to return
    
    Returns:
        List of operators with their comprehensive efficiency metrics over specified time period
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
        
        # Check if we have enough historical data, if not use available data
        if start_epoch < min_available_epoch:
            epochs_available = latest_epoch - min_available_epoch + 1
            start_epoch = min_available_epoch
            total_epochs = epochs_available
            days_actual = round(epochs_available / 225, 2)
            logger.info(f"Using {epochs_available} epochs ({days_actual} days) instead of requested {days} days due to insufficient data")
        
        # Calculate the period-wide average proposal reward for baseline comparison
        baseline_query = f"""
        SELECT AVG(propose_earned_reward) as period_avg_proposal_reward
        FROM validators_summary
        WHERE epoch >= {start_epoch} AND epoch <= {latest_epoch}
        AND is_proposer = 1 AND block_proposed = 1
        AND propose_earned_reward > 0
        """
        
        baseline_data = clickhouse_service.execute_query(baseline_query)
        period_avg_reward = float(baseline_data[0][0]) if baseline_data and baseline_data[0][0] else 47000000  # Fallback average
        
        # Query with corrected proposer calculation (same as regular _all endpoint but with configurable days)
        query = f"""
        SELECT 
            val_nos_name as operator,
            COUNT(DISTINCT val_id) as validator_count,
            -- Attestation rewards (unchanged)
            SUM(COALESCE(att_earned_reward, 0)) as total_attester_actual_reward,
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) as total_attester_ideal_reward,
            -- Proposer rewards (corrected with baseline comparison)
            SUM(CASE WHEN is_proposer = 1 THEN COALESCE(propose_earned_reward, 0) ELSE 0 END) as total_proposer_actual_reward,
            SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) as total_proposer_ideal_reward,
            -- Sync committee rewards (only when is_sync = 1)
            SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) ELSE 0 END) as total_sync_actual_reward,
            SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END) as total_sync_ideal_reward,
            -- Performance metrics
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as successful_attestations,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as missed_attestations,
            SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as successful_proposals,
            SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as missed_proposals,
            SUM(CASE WHEN is_proposer = 1 THEN 1 ELSE 0 END) as total_proposer_duties,
            SUM(CASE WHEN is_sync = 1 THEN 1 ELSE 0 END) as total_sync_duties,
            AVG(CASE WHEN is_sync = 1 AND sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_participation,
            COUNT(*) as total_epochs_data
        FROM validators_summary
        WHERE epoch >= {start_epoch}
        AND epoch <= {latest_epoch}
        AND val_nos_name IS NOT NULL
        AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        GROUP BY val_nos_name
        ORDER BY (
            CASE 
                WHEN (SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) + 
                      SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) + 
                      SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END)) > 0 
                THEN ((SUM(COALESCE(att_earned_reward, 0)) + 
                       SUM(CASE WHEN is_proposer = 1 THEN COALESCE(propose_earned_reward, 0) ELSE 0 END) + 
                       SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) ELSE 0 END)) * 100.0 / 
                      (SUM(COALESCE(att_earned_reward, 0) + COALESCE(att_missed_reward, 0)) + 
                       SUM(CASE WHEN is_proposer = 1 THEN {period_avg_reward} ELSE 0 END) + 
                       SUM(CASE WHEN is_sync = 1 THEN COALESCE(sync_earned_reward, 0) + COALESCE(sync_missed_reward, 0) ELSE 0 END)))
                ELSE 0.0
            END
        ) DESC
        LIMIT {limit}
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        # Transform to structured format
        results = []
        for row in raw_data:
            if len(row) >= 16:
                try:
                    # Calculate efficiencies from raw data (same as regular _all endpoint)
                    attester_actual = int(float(row[2])) if row[2] is not None else 0
                    attester_ideal = int(float(row[3])) if row[3] is not None else 0
                    proposer_actual = int(float(row[4])) if row[4] is not None else 0
                    proposer_ideal = int(float(row[5])) if row[5] is not None else 0
                    sync_actual = int(float(row[6])) if row[6] is not None else 0
                    sync_ideal = int(float(row[7])) if row[7] is not None else 0
                    
                    # Calculate individual efficiencies
                    attester_efficiency = (attester_actual * 100.0 / attester_ideal) if attester_ideal > 0 else 0.0
                    proposer_efficiency = min(100.0, (proposer_actual * 100.0 / proposer_ideal)) if proposer_ideal > 0 else 0.0
                    sync_efficiency = (sync_actual * 100.0 / sync_ideal) if sync_ideal > 0 else 0.0
                    
                    # Calculate capped proposer actual for overall efficiency (cap at baseline)
                    proposer_actual_capped = min(proposer_actual, proposer_ideal) if proposer_ideal > 0 else proposer_actual
                    total_actual_capped = attester_actual + proposer_actual_capped + sync_actual
                    total_ideal = attester_ideal + proposer_ideal + sync_ideal
                    
                    overall_efficiency = (total_actual_capped * 100.0 / total_ideal) if total_ideal > 0 else 0.0
                    
                    results.append({
                        'operator': str(row[0]),
                        'validator_count': int(float(row[1])) if row[1] is not None else 0,
                        # Reward components
                        'attester_actual_reward': attester_actual,
                        'proposer_actual_reward': proposer_actual,
                        'sync_actual_reward': sync_actual,
                        'attester_ideal_reward': attester_ideal,
                        'proposer_ideal_reward': proposer_ideal,
                        'sync_ideal_reward': sync_ideal,
                        'total_actual_reward': total_actual_capped,
                        'total_ideal_reward': total_ideal,
                        # Efficiency metrics
                        'overall_efficiency': overall_efficiency,
                        'attester_efficiency': attester_efficiency,
                        'proposer_efficiency': proposer_efficiency,
                        'sync_efficiency': sync_efficiency,
                        # Performance metrics
                        'successful_attestations': int(float(row[8])) if row[8] is not None else 0,
                        'missed_attestations': int(float(row[9])) if row[9] is not None else 0,
                        'successful_proposals': int(float(row[10])) if row[10] is not None else 0,
                        'missed_proposals': int(float(row[11])) if row[11] is not None else 0,
                        'total_proposer_duties': int(float(row[12])) if row[12] is not None else 0,
                        'total_sync_duties': int(float(row[13])) if row[13] is not None else 0,
                        'avg_sync_participation': float(row[14]) if row[14] not in ['\\N', None, ''] else 0.0,
                        'total_epochs_data': int(float(row[15])) if row[15] is not None else 0,
                        'latest_epoch': latest_epoch,
                        'start_epoch': start_epoch,
                        'days_analyzed': days,
                        'epochs_analyzed': total_epochs
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse row for operator {row[0]}: {e}")
                    continue
        
        logger.info(f"Found comprehensive efficiency data for {len(results)} operators over {days} day(s) period")
        return results
        
    except Exception as e:
        logger.error(f"Failed to get comprehensive theoretical performance extended: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

