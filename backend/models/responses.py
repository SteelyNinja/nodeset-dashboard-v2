"""
Pydantic models for API responses
"""

from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime

class BaseResponse(BaseModel):
    """Base response model"""
    success: bool
    message: str
    timestamp: Optional[datetime] = None

class DataResponse(BaseResponse):
    """Response model for data endpoints"""
    data: Optional[Dict[str, Any]] = None
    source_file: Optional[str] = None

class AnalysisResponse(BaseResponse):
    """Response model for analysis endpoints"""
    data: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    message: str
    type: str
    timestamp: Optional[datetime] = None

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: datetime
    uptime: float
    memory_usage: Dict[str, Any]
    data_files: Dict[str, bool]

class CacheInfoResponse(BaseModel):
    """Cache information response model"""
    cached_items: List[str]
    cache_timestamps: Dict[str, float]
    cache_size: int

class ConcentrationMetrics(BaseModel):
    """Concentration metrics model"""
    gini_coefficient: float
    top_1_percent: float
    top_5_percent: float
    top_10_percent: float
    top_20_percent: float
    herfindahl_index: float
    total_validators: int
    total_operators: int

class ConcentrationMetricsResponse(AnalysisResponse):
    """Response model for concentration metrics"""
    data: Optional[ConcentrationMetrics] = None

class PerformanceDistribution(BaseModel):
    """Performance distribution model"""
    excellent: float
    good: float
    average: float
    poor: float

class OperatorDetail(BaseModel):
    """Operator detail model"""
    operator: str
    full_address: str
    performance: Optional[float] = None
    validator_count: Optional[int] = None
    performance_category: Optional[str] = None

class PerformanceAnalysis(BaseModel):
    """Performance analysis model"""
    excellent_count: int
    good_count: int
    average_count: int
    poor_count: int
    total_validators: int
    performance_distribution: PerformanceDistribution
    operator_details: Optional[List[OperatorDetail]] = None

class PerformanceAnalysisResponse(AnalysisResponse):
    """Response model for performance analysis"""
    data: Optional[PerformanceAnalysis] = None

class Operator(BaseModel):
    """Operator model"""
    operator: str
    validator_count: int
    percentage: float
    performance_score: Optional[float] = None

class NetworkOverview(BaseModel):
    """Network overview model"""
    total_validators: int
    active_validators: int
    total_operators: int
    total_proposals: int
    successful_proposals: int
    missed_proposals: int
    exit_rate: float
    activation_rate: float
    network_health_score: float

class GasAnalysis(BaseModel):
    """Gas analysis model"""
    strategies: Dict[str, int]
    average_gas_limit: int
    median_gas_limit: int
    gas_limit_range: Dict[str, int]

class ClientDiversity(BaseModel):
    """Client diversity model"""
    consensus_clients: Dict[str, float]
    execution_clients: Dict[str, float]
    diversity_score: float