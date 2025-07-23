"""
Dashboard API endpoints for processed data and analytics
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.analytics import analytics_service

router = APIRouter()

class AnalysisResponse(BaseModel):
    """Base response model for analysis endpoints"""
    data: Optional[Dict[str, Any]] = None
    success: bool
    message: str
    timestamp: str

class ConcentrationMetrics(BaseModel):
    """Concentration metrics response model"""
    gini_coefficient: float
    top_1_percent: float
    top_5_percent: float
    top_10_percent: float
    top_20_percent: float
    herfindahl_index: float
    total_validators: int
    total_operators: int

class PerformanceAnalysis(BaseModel):
    """Performance analysis response model"""
    excellent_count: int
    good_count: int
    average_count: int
    poor_count: int
    total_validators: int
    performance_distribution: Dict[str, float]

@router.get("/concentration-metrics")
async def get_concentration_metrics():
    """Get concentration metrics (Gini coefficient, top operator percentages)"""
    try:
        metrics = analytics_service.calculate_concentration_metrics()
        
        if "error" in metrics:
            raise HTTPException(status_code=404, detail=metrics["error"])
        
        return AnalysisResponse(
            data=metrics,
            success=True,
            message="Concentration metrics calculated successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate concentration metrics: {str(e)}")

@router.get("/performance-analysis")
async def get_performance_analysis(
    period: Optional[str] = Query(None, description="Performance period: '1d', '7d', '31d'")
):
    """Get performance analysis (categorization and distribution), optionally filtered by performance period"""
    try:
        # Validate period parameter
        if period and period not in ["1d", "7d", "31d"]:
            raise HTTPException(status_code=400, detail=f"Invalid period '{period}'. Valid periods are: 1d, 7d, 31d")
            
        analysis = analytics_service.create_performance_analysis(period=period)
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        period_msg = f" ({period})" if period else ""
        return AnalysisResponse(
            data=analysis,
            success=True,
            message=f"Performance analysis{period_msg} completed successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform performance analysis: {str(e)}")

@router.get("/gas-analysis")
async def get_gas_analysis():
    """Get gas limit analysis by operator"""
    try:
        analysis = analytics_service.analyze_gas_limits()
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        return AnalysisResponse(
            data=analysis,
            success=True,
            message="Gas analysis completed successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform gas analysis: {str(e)}")

@router.get("/client-diversity")
async def get_client_diversity():
    """Get client diversity analysis"""
    try:
        analysis = analytics_service.analyze_client_diversity()
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        return AnalysisResponse(
            data=analysis,
            success=True,
            message="Client diversity analysis completed successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform client diversity analysis: {str(e)}")

@router.get("/top-operators")
async def get_top_operators(limit: int = 20):
    """Get top operators by validator count"""
    try:
        operators = analytics_service.get_top_operators(limit)
        
        if "error" in operators:
            raise HTTPException(status_code=404, detail=operators["error"])
        
        return AnalysisResponse(
            data=operators,
            success=True,
            message=f"Top {limit} operators retrieved successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get top operators: {str(e)}")

@router.get("/network-overview")
async def get_network_overview():
    """Get network overview statistics"""
    try:
        overview = analytics_service.get_network_overview()
        
        if "error" in overview:
            raise HTTPException(status_code=404, detail=overview["error"])
        
        return AnalysisResponse(
            data=overview,
            success=True,
            message="Network overview retrieved successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get network overview: {str(e)}")

@router.get("/all-exit-records")
async def get_all_exit_records():
    """Get all individual exit records from validator data"""
    try:
        exit_records = analytics_service.get_all_exit_records()
        
        if "error" in exit_records:
            raise HTTPException(status_code=404, detail=exit_records["error"])
        
        return AnalysisResponse(
            data=exit_records,
            success=True,
            message="All exit records retrieved successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get all exit records: {str(e)}")

@router.get("/enhanced-exit-data")
async def get_enhanced_exit_data(
    limit: Optional[int] = Query(100, description="Maximum number of exit records to return (0 for all)")
):
    """Get enhanced exit data that includes both exited and active_exiting validators"""
    try:
        enhanced_data = analytics_service.get_enhanced_exit_data(limit=limit)
        
        if "error" in enhanced_data:
            raise HTTPException(status_code=404, detail=enhanced_data["error"])
        
        return AnalysisResponse(
            data=enhanced_data,
            success=True,
            message="Enhanced exit data retrieved successfully",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get enhanced exit data: {str(e)}")

