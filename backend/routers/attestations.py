#!/usr/bin/env python3
"""
Comprehensive Attestation Data API endpoints using ClickHouse
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from services.clickhouse_service import clickhouse_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/epoch-range")
async def get_epoch_range() -> Dict[str, Any]:
    """Get the available epoch range in the database"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        result = await clickhouse_service.get_epoch_range()
        return {
            "success": True,
            "data": result,
            "source": "clickhouse"
        }
        
    except Exception as e:
        logger.error(f"Failed to get epoch range: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )


@router.get("/validator-accuracy")
async def get_validator_accuracy(
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)"),
    operator: Optional[str] = Query(None, description="Filter by specific operator address")
) -> Dict[str, Any]:
    """Get comprehensive validator accuracy metrics by operator with optional filtering (ALL validators)"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = await clickhouse_service.get_validator_accuracy(start_epoch, end_epoch, operator)
        
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
            "scope": "all_validators_network_wide"
        }
        
    except Exception as e:
        logger.error(f"Failed to get validator accuracy: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/nodeset-epoch-summary/{epoch}")
async def get_nodeset_epoch_summary(epoch: int) -> Dict[str, Any]:
    """Get comprehensive summary statistics for NodeSet validators only in a specific epoch"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        result = await clickhouse_service.get_nodeset_epoch_summary(epoch)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"No NodeSet validator data found for epoch {epoch}"
            )
        
        return {
            "success": True,
            "data": result,
            "source": "clickhouse",
            "scope": "nodeset_validators_only"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get NodeSet epoch summary: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/epoch-summary/{epoch}")
async def get_epoch_summary(epoch: int) -> Dict[str, Any]:
    """Get comprehensive summary statistics for ALL validators in a specific epoch (network-wide)"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        result = await clickhouse_service.get_epoch_summary(epoch)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for epoch {epoch}"
            )
        
        return {
            "success": True,
            "data": result,
            "source": "clickhouse",
            "scope": "all_validators_network_wide"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get epoch summary: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )



@router.get("/validator-details")
async def get_validator_details(
    validator_id: Optional[int] = Query(None, description="Specific validator ID"),
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)"),
    limit: int = Query(1000, description="Maximum number of records to return", le=10000)
) -> Dict[str, Any]:
    """Get detailed validator performance data with comprehensive metrics (ALL validators)"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = await clickhouse_service.get_validator_details(validator_id, start_epoch, end_epoch, limit)
        
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
            "scope": "all_validators_network_wide"
        }
        
    except Exception as e:
        logger.error(f"Failed to get validator details: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/operator-epoch-performance")
async def get_operator_epoch_performance(
    operator: str = Query(..., description="Operator address (required)"),
    start_epoch: Optional[int] = Query(None, description="Start epoch (inclusive)"),
    end_epoch: Optional[int] = Query(None, description="End epoch (inclusive)")
) -> Dict[str, Any]:
    """Get epoch-by-epoch performance metrics for a specific operator"""
    
    if not await clickhouse_service.is_available():
        raise HTTPException(
            status_code=503, 
            detail="ClickHouse service is not available"
        )
    
    try:
        results = await clickhouse_service.get_operator_epoch_performance(operator, start_epoch, end_epoch)
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "filters": {
                "operator": operator,
                "start_epoch": start_epoch,
                "end_epoch": end_epoch
            },
            "source": "clickhouse"
        }
        
    except Exception as e:
        logger.error(f"Failed to get operator epoch performance: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database query failed: {str(e)}"
        )


@router.get("/health")
async def clickhouse_health() -> Dict[str, Any]:
    """Check ClickHouse connection health and get database info"""
    
    is_available = await clickhouse_service.is_available()
    result = {
        "clickhouse_available": is_available,
        "enabled": clickhouse_service.enabled,
        "status": "healthy" if is_available else "unavailable"
        # NOTE: URL deliberately omitted to prevent IP address leakage
    }
    
    if is_available:
        try:
            epoch_info = await clickhouse_service.get_epoch_range()
            result["epoch_range"] = epoch_info
        except Exception as e:
            logger.warning(f"Could not get epoch range: {e}")
    
    return result