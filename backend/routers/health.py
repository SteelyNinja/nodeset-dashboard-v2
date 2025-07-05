"""
Health check endpoints for monitoring API status
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import psutil
import os
import sys
from datetime import datetime
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data_loader_api import clear_cache

router = APIRouter()

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: datetime
    uptime: float
    memory_usage: Dict[str, Any]
    data_files: Dict[str, bool]

@router.get("/", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns API status, memory usage, and data file availability
    """
    try:
        # Get memory usage
        memory = psutil.virtual_memory()
        process = psutil.Process(os.getpid())
        
        # Check data files (check multiple possible locations)
        def file_exists_anywhere(filename):
            locations = [
                f"./{filename}",
                f"./json_data/{filename}",
                f"./data/{filename}", 
                f"../{filename}",
                f"../json_data/{filename}"
            ]
            return any(os.path.exists(path) for path in locations)
        
        data_files = {
            "nodeset_validator_tracker_cache.json": file_exists_anywhere("nodeset_validator_tracker_cache.json"),
            "validator_performance_cache.json": file_exists_anywhere("validator_performance_cache.json"),
            "proposals.json": file_exists_anywhere("proposals.json"),
            "sync_committee_participation.json": file_exists_anywhere("sync_committee_participation.json"),
            "mev_analysis_results.json": file_exists_anywhere("mev_analysis_results.json"),
            "missed_proposals_cache.json": file_exists_anywhere("missed_proposals_cache.json"),
            "dashboard_exit_data.json": file_exists_anywhere("dashboard_exit_data.json"),
            "manual_ens_names.json": file_exists_anywhere("manual_ens_names.json")
        }
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.now(),
            uptime=0.0,  # Will implement proper uptime tracking
            memory_usage={
                "total_mb": round(memory.total / (1024**2), 2),
                "available_mb": round(memory.available / (1024**2), 2),
                "percent": memory.percent,
                "process_mb": round(process.memory_info().rss / (1024**2), 2)
            },
            data_files=data_files
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.get("/data-files")
async def check_data_files():
    """
    Check availability of all required data files
    """
    try:
        # Helper function to check if file exists in any location
        def file_exists_anywhere(filename):
            locations = [
                f"./{filename}",
                f"./json_data/{filename}",
                f"./data/{filename}", 
                f"../{filename}",
                f"../json_data/{filename}"
            ]
            return any(os.path.exists(path) for path in locations)
        
        data_files = {
            "nodeset_validator_tracker_cache.json": file_exists_anywhere("nodeset_validator_tracker_cache.json"),
            "validator_performance_cache.json": file_exists_anywhere("validator_performance_cache.json"),
            "proposals.json": file_exists_anywhere("proposals.json"),
            "sync_committee_participation.json": file_exists_anywhere("sync_committee_participation.json"),
            "mev_analysis_results.json": file_exists_anywhere("mev_analysis_results.json"),
            "missed_proposals_cache.json": file_exists_anywhere("missed_proposals_cache.json"),
            "dashboard_exit_data.json": file_exists_anywhere("dashboard_exit_data.json"),
            "manual_ens_names.json": file_exists_anywhere("manual_ens_names.json")
        }
        
        missing_files = [file for file, exists in data_files.items() if not exists]
        
        return {
            "data_files": data_files,
            "all_present": len(missing_files) == 0,
            "missing_files": missing_files,
            "total_files": len(data_files),
            "present_files": len(data_files) - len(missing_files)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data file check failed: {str(e)}")

@router.post("/clear-cache")
async def clear_data_cache():
    """
    Manually clear all cached data
    Useful for forcing immediate reload of JSON files
    """
    try:
        clear_cache()
        return {
            "status": "success",
            "message": "All cached data cleared successfully",
            "timestamp": datetime.now(),
            "note": "Next API calls will reload fresh data from JSON files"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")