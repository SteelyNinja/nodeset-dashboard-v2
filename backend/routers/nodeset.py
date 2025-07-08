#!/usr/bin/env python3
"""
NodeSet API Router
Endpoints for NodeSet-specific validator operations and monitoring
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import logging
from services.clickhouse_service import clickhouse_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/validators_down")
async def get_validators_down(
    limit: int = Query(100, description="Maximum number of validators to return")
) -> List[Dict[str, Any]]:
    """
    Get NodeSet validators that have missed attestations for the last 3 epochs in a row.
    
    Returns:
        List of validators with operator and validator_id that have missed 3 consecutive attestations
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
        query = f"""
        WITH validator_epochs AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
        ),
        consecutive_misses AS (
            SELECT 
                val_id,
                val_nos_name,
                COUNT(*) as total_epochs,
                SUM(missed_attestation) as missed_epochs
            FROM validator_epochs
            GROUP BY val_id, val_nos_name
            HAVING COUNT(*) = 3 AND SUM(missed_attestation) = 3
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
) -> List[Dict[str, Any]]:
    """
    Get NodeSet validators that have missed attestations for N consecutive epochs.
    
    Args:
        epochs_back: Number of consecutive epochs to check (default: 2)
        limit: Maximum number of validators to return
        
    Returns:
        List of validators with operator and validator_id that have missed N consecutive attestations
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
        query = f"""
        WITH validator_epochs AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary 
            WHERE epoch >= {start_epoch} 
            AND epoch <= {latest_epoch}
            AND val_nos_name IS NOT NULL
        ),
        consecutive_misses AS (
            SELECT 
                val_id,
                val_nos_name,
                COUNT(*) as total_epochs,
                SUM(missed_attestation) as missed_epochs
            FROM validator_epochs
            GROUP BY val_id, val_nos_name
            HAVING COUNT(*) = {epochs_back} AND SUM(missed_attestation) = {epochs_back}
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
    
    Returns:
        Summary statistics about validator downtime (3 consecutive epochs)
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
                        CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END as missed_attestation
                    FROM validators_summary 
                    WHERE epoch >= {start_epoch} 
                    AND epoch <= {latest_epoch}
                    AND val_nos_name IS NOT NULL
                ),
                consecutive_misses AS (
                    SELECT 
                        val_id,
                        val_nos_name,
                        COUNT(*) as total_epochs,
                        SUM(missed_attestation) as missed_epochs
                    FROM validator_epochs
                    GROUP BY val_id, val_nos_name
                    HAVING COUNT(*) = 3 AND SUM(missed_attestation) = 3
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