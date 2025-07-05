"""
Data API endpoints for raw data access
"""

from fastapi import APIRouter, HTTPException
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
    get_logo_base64,
    clear_cache,
    get_cache_info
)

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
async def get_validator_performance_data():
    """Get validator performance data"""
    try:
        data, source_file = load_validator_performance_data()
        if data is None:
            raise HTTPException(status_code=404, detail="Validator performance data not found")
        
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