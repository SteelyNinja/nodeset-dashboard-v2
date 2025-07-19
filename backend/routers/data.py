"""
Data API endpoints for raw data access
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_loader_api import (
    load_validator_data,
    load_proposals_data,
    load_missed_proposals_data,
    load_mev_analysis_data,
    load_sync_committee_data,
    load_exit_data,
    load_validator_performance_data,
    load_ens_names,
    load_vault_events_data,
    get_logo_base64,
    clear_cache,
    get_cache_info
)
from analysis import calculate_attestation_performance

router = APIRouter()

class DataResponse(BaseModel):
    """Base response model for data endpoints"""
    data: Optional[Dict[str, Any]] = None
    source_file: Optional[str] = None
    success: bool
    message: str

class CacheInfoResponse(BaseModel):
    """Cache information response model"""
    cached_items: list
    cache_timestamps: Dict[str, float]
    cache_size: int

@router.get("/validator-data", response_model=DataResponse)
async def get_validator_data():
    """Get main validator data"""
    try:
        data, source_file = load_validator_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Validator data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Validator data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load validator data: {str(e)}")

@router.get("/proposals", response_model=DataResponse)
async def get_proposals_data():
    """Get proposals data"""
    try:
        data, source_file = load_proposals_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Proposals data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Proposals data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load proposals data: {str(e)}")

@router.get("/missed-proposals", response_model=DataResponse)
async def get_missed_proposals_data():
    """Get missed proposals data"""
    try:
        data, source_file = load_missed_proposals_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Missed proposals data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Missed proposals data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load missed proposals data: {str(e)}")

@router.get("/mev-analysis", response_model=DataResponse)
async def get_mev_analysis_data():
    """Get MEV analysis data"""
    try:
        data, source_file = load_mev_analysis_data()
        if data is None:
            raise HTTPException(status_code=404, detail="MEV analysis data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="MEV analysis data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load MEV analysis data: {str(e)}")

@router.get("/sync-committee", response_model=DataResponse)
async def get_sync_committee_data():
    """Get sync committee data"""
    try:
        data, source_file = load_sync_committee_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Sync committee data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Sync committee data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load sync committee data: {str(e)}")

@router.get("/exit-data", response_model=DataResponse)
async def get_exit_data():
    """Get exit data"""
    try:
        data, source_file = load_exit_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Exit data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Exit data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load exit data: {str(e)}")

@router.get("/validator-performance", response_model=DataResponse)
async def get_validator_performance_data(
    period: Optional[str] = Query(None, description="Performance period: '1d', '7d', '31d'")
):
    """Get validator performance data, optionally filtered by performance period"""
    try:
        data, source_file = load_validator_performance_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Validator performance data not found")
        
        # If period is specified, filter the performance data
        if period and "validators" in data:
            # Map period parameter to performance field names
            period_field_map = {
                "1d": "performance_1d", 
                "7d": "performance_7d",
                "31d": "performance_31d"
            }
            
            if period in period_field_map:
                performance_field = period_field_map[period]
                
                # Create a simplified structure focused on the specific period
                operators_performance = {}
                
                for validator_id, validator_info in data["validators"].items():
                    operator = validator_info.get("operator", "Unknown")
                    performance_metrics = validator_info.get("performance_metrics", {})
                    
                    if performance_field in performance_metrics:
                        performance_value = performance_metrics[performance_field]
                        
                        if operator not in operators_performance:
                            operators_performance[operator] = {
                                "validators": [],
                                "total_performance": 0,
                                "count": 0
                            }
                        
                        operators_performance[operator]["validators"].append({
                            "validator_index": validator_info.get("validator_index"),
                            "performance": performance_value
                        })
                        operators_performance[operator]["total_performance"] += performance_value
                        operators_performance[operator]["count"] += 1
                
                # Calculate average performance per operator
                for operator, data_info in operators_performance.items():
                    if data_info["count"] > 0:
                        data_info["average_performance"] = data_info["total_performance"] / data_info["count"]
                    else:
                        data_info["average_performance"] = 0
                
                # Create filtered response with operators performance
                filtered_data = {
                    "last_updated": data.get("last_updated"),
                    "total_validators": data.get("total_validators"),
                    "period": period,
                    "performance_field": performance_field,
                    "operators_performance": operators_performance,
                    "operator_count": len(operators_performance)
                }
                
                return DataResponse(
                    data=filtered_data,
                    source_file=source_file,
                    success=True,
                    message=f"Validator performance data ({period}) loaded successfully"
                )
            else:
                raise HTTPException(status_code=400, detail=f"Invalid period '{period}'. Valid periods are: 1d, 7d, 31d")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Validator performance data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load validator performance data: {str(e)}")

@router.get("/ens-names", response_model=DataResponse)
async def get_ens_names():
    """Get ENS names data"""
    try:
        data, source_file = load_ens_names()
        if data is None:
            raise HTTPException(status_code=404, detail="ENS names data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="ENS names data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load ENS names data: {str(e)}")

@router.get("/vault-events", response_model=DataResponse)
async def get_vault_events():
    """Get vault events data"""
    try:
        data, source_file = load_vault_events_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Vault events data not found")
        
        return DataResponse(
            data=data,
            source_file=source_file,
            success=True,
            message="Vault events data loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load vault events data: {str(e)}")

@router.get("/logo")
async def get_logo(dark_mode: bool = False):
    """Get logo as base64 string"""
    try:
        logo_b64 = get_logo_base64(dark_mode)
        if logo_b64 is None:
            raise HTTPException(status_code=404, detail="Logo not found")
        
        return {
            "logo": logo_b64,
            "dark_mode": dark_mode,
            "format": "png",
            "encoding": "base64"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load logo: {str(e)}")

@router.post("/clear-cache")
async def clear_data_cache():
    """Clear all cached data"""
    try:
        clear_cache()
        return {"message": "Cache cleared successfully", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

@router.get("/cache-info", response_model=CacheInfoResponse)
async def get_cache_information():
    """Get cache information"""
    try:
        cache_info = get_cache_info()
        return CacheInfoResponse(**cache_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache info: {str(e)}")

@router.get("/ens-sources", response_model=DataResponse)
async def get_ens_sources():
    """Get ENS sources breakdown (on-chain vs manual)"""
    try:
        data, source_file = load_validator_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Validator data not found")
        
        # Extract ENS sources data
        ens_sources = data.get("ens_sources", {})
        
        # Count on-chain vs manual
        on_chain_count = sum(1 for source in ens_sources.values() if source == "on-chain")
        manual_count = sum(1 for source in ens_sources.values() if source == "manual")
        total_count = len(ens_sources)
        
        # Calculate percentages
        on_chain_percentage = (on_chain_count / total_count * 100) if total_count > 0 else 0
        manual_percentage = (manual_count / total_count * 100) if total_count > 0 else 0
        
        response_data = {
            "total_ens_names": total_count,
            "on_chain_count": on_chain_count,
            "manual_count": manual_count,
            "on_chain_percentage": on_chain_percentage,
            "manual_percentage": manual_percentage,
            "breakdown": {
                "on_chain": on_chain_count,
                "manual": manual_count
            },
            "raw_sources": ens_sources
        }
        
        return DataResponse(
            data=response_data,
            source_file=source_file,
            success=True,
            message="ENS sources breakdown loaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load ENS sources: {str(e)}")

@router.get("/relative-performance", response_model=DataResponse)
async def get_relative_performance(
    period: str = Query(..., description="Performance period: '7d' or '31d'")
):
    """Get relative performance data for attestation-only analysis"""
    try:
        # Validate period parameter
        if period not in ['7d', '31d']:
            raise HTTPException(status_code=400, detail="Period must be '7d' or '31d'")
        
        # Convert period to days
        days = 7 if period == '7d' else 31
        
        # Load required data
        validator_performance_data, perf_source = load_validator_performance_data()
        if not validator_performance_data:
            raise HTTPException(status_code=404, detail="Validator performance data not found")
        
        proposals_data, proposals_source = load_proposals_data()
        if not proposals_data:
            raise HTTPException(status_code=404, detail="Proposals data not found")
        
        sync_committee_data, sync_source = load_sync_committee_data()
        if not sync_committee_data:
            raise HTTPException(status_code=404, detail="Sync committee data not found")
        
        validator_data, validator_source = load_validator_data()
        if not validator_data:
            raise HTTPException(status_code=404, detail="Validator data not found")
        
        exit_data, exit_source = load_exit_data()
        if not exit_data:
            raise HTTPException(status_code=404, detail="Exit data not found")
        
        # Calculate attestation performance
        performance_results = calculate_attestation_performance(
            validator_performance_data,
            proposals_data,
            sync_committee_data,
            validator_data,
            exit_data,
            days
        )
        
        # Create response data
        response_data = {
            "period": period,
            "days": days,
            "lookback_days": 10 if days == 7 else 34,
            "activity_days": 7 if days == 7 else 32,
            "total_operators": len(performance_results),
            "operators": performance_results,
            "metadata": {
                "description": f"Attestation-only performance analysis for {period} period",
                "exclusion_criteria": "Validators with proposals or sync committee duties in lookback window are excluded",
                "activity_requirement": f"Validators must be active for {7 if days == 7 else 31}+ days"
            }
        }
        
        return DataResponse(
            data=response_data,
            source_file=f"Combined: {perf_source}, {proposals_source}, {sync_source}, {validator_source}, {exit_source}",
            success=True,
            message=f"Relative performance data ({period}) calculated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate relative performance: {str(e)}")