#!/usr/bin/env python3
"""
Operator Daily Performance API endpoints
Serves daily attestation performance data for NodeSet operators
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import json
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter()

class OperatorPerformanceService:
    """Service to load and serve operator daily performance data"""
    
    def __init__(self, cache_file: str = "operator_daily_performance_cache.json"):
        self.cache_file = cache_file
        self.cache_paths = [
            f"../json_data/{cache_file}",  # JSON data directory (priority)
            f"/home/gary/git/nodeset-sw-validator-summary/{cache_file}",  # Script directory
            f"../nodeset-sw-validator-summary/{cache_file}",  # Relative to backend
            cache_file  # Current directory (fallback)
        ]
        self._cache = None
        self._last_loaded = None
    
    def _find_cache_file(self) -> Optional[str]:
        """Find the cache file in possible locations"""
        for path in self.cache_paths:
            if os.path.exists(path):
                return path
        return None
    
    def _load_cache(self, force_reload: bool = False) -> Dict:
        """Load operator performance cache with automatic refresh"""
        cache_path = self._find_cache_file()
        if not cache_path:
            logger.warning("Operator daily performance cache file not found")
            return {"last_updated": None, "data_period_days": 90, "operators": {}}
        
        # Check if we need to reload (file modified or force reload)
        try:
            file_mtime = os.path.getmtime(cache_path)
            if not force_reload and self._cache and self._last_loaded and file_mtime <= self._last_loaded:
                return self._cache
            
            with open(cache_path, 'r') as f:
                self._cache = json.load(f)
                self._last_loaded = file_mtime
                logger.debug(f"Loaded operator performance cache from {cache_path}")
                return self._cache
                
        except Exception as e:
            logger.error(f"Failed to load operator performance cache: {e}")
            return {"last_updated": None, "data_period_days": 90, "operators": {}}
    
    def get_cache_info(self) -> Dict[str, Any]:
        """Get information about the cache file"""
        cache = self._load_cache()
        cache_path = self._find_cache_file()
        
        return {
            "cache_available": cache_path is not None,
            "cache_path": cache_path,
            "last_updated": cache.get("last_updated"),
            "data_period_days": cache.get("data_period_days", 90),
            "operators_count": len(cache.get("operators", {})),
            "data_days_available": self._get_available_days_count(cache)
        }
    
    def _get_available_days_count(self, cache: Dict) -> int:
        """Get the number of days with data available"""
        operators = cache.get("operators", {})
        if not operators:
            return 0
        
        # Get days from first operator as representative
        first_operator = next(iter(operators.values()))
        return len(first_operator.get("daily_performance", []))
    
    def get_all_operators(self) -> List[str]:
        """Get list of all operators with daily performance data"""
        cache = self._load_cache()
        return list(cache.get("operators", {}).keys())
    
    def get_operator_performance(self, operator: str, days: Optional[int] = None) -> Dict[str, Any]:
        """Get daily performance data for a specific operator"""
        cache = self._load_cache()
        operators = cache.get("operators", {})
        
        if operator not in operators:
            return None
        
        operator_data = operators[operator].copy()
        
        # Limit days if requested
        if days and days > 0:
            daily_performance = operator_data.get("daily_performance", [])
            operator_data["daily_performance"] = daily_performance[:days]
        
        return operator_data
    
    def get_operators_summary(self, limit_days: Optional[int] = None) -> Dict[str, Any]:
        """Get summary performance data for all operators"""
        cache = self._load_cache()
        operators = cache.get("operators", {})
        
        summaries = {}
        for operator, data in operators.items():
            daily_performance = data.get("daily_performance", [])
            
            if not daily_performance:
                continue
            
            # Limit data if requested
            if limit_days:
                daily_performance = daily_performance[:limit_days]
            
            # Calculate summary metrics using only latest day (24-hour display)
            if daily_performance:
                latest_day = daily_performance[0]  # Newest first
                
                summaries[operator] = {
                    "validator_count": latest_day.get("validator_count", 0),
                    "days_of_data": len(daily_performance),
                    "latest_date": latest_day.get("date"),
                    "avg_participation_rate": round(latest_day.get("participation_rate", 0), 2),
                    "avg_head_accuracy": round(latest_day.get("head_accuracy", 0), 2),
                    "avg_target_accuracy": round(latest_day.get("target_accuracy", 0), 2),
                    "avg_source_accuracy": round(latest_day.get("source_accuracy", 0), 2),
                    "avg_inclusion_delay": round(latest_day.get("avg_inclusion_delay", 0), 3),
                    "avg_attestation_performance": round(latest_day.get("attestation_performance", 0), 6),
                    "latest_performance": latest_day.get("attestation_performance", 0)
                }
        
        return summaries
    
    def get_operators_summary_previous_day(self) -> Dict[str, Any]:
        """Get summary performance data for all operators based on yesterday's 7-day rolling average (overlapping)"""
        cache = self._load_cache()
        operators = cache.get("operators", {})
        
        summaries = {}
        for operator, data in operators.items():
            daily_performance = data.get("daily_performance", [])
            
            if len(daily_performance) < 8:  # Need at least 8 days for yesterday's 7-day average
                continue
            
            # Get yesterday's 7-day window (days 1-7, overlapping 6 days with current period days 0-6)
            yesterday_7_days = daily_performance[1:8]  # Skip today (day 0), take days 1-7 (yesterday's 7-day window)
            
            if len(yesterday_7_days) == 7:
                # Calculate yesterday's 7-day average metrics
                avg_participation = sum(d.get("participation_rate", 0) for d in yesterday_7_days) / 7
                avg_head_accuracy = sum(d.get("head_accuracy", 0) for d in yesterday_7_days) / 7
                avg_target_accuracy = sum(d.get("target_accuracy", 0) for d in yesterday_7_days) / 7
                avg_source_accuracy = sum(d.get("source_accuracy", 0) for d in yesterday_7_days) / 7
                avg_inclusion_delay = sum(d.get("avg_inclusion_delay", 0) for d in yesterday_7_days) / 7
                avg_performance = sum(d.get("attestation_performance", 0) for d in yesterday_7_days) / 7
                
                # Use yesterday (day 1) as the reference date
                reference_day = daily_performance[1]
                
                summaries[operator] = {
                    "validator_count": reference_day.get("validator_count", 0),
                    "days_of_data": 7,
                    "latest_date": reference_day.get("date"),
                    "avg_participation_rate": round(avg_participation, 2),
                    "avg_head_accuracy": round(avg_head_accuracy, 2),
                    "avg_target_accuracy": round(avg_target_accuracy, 2),
                    "avg_source_accuracy": round(avg_source_accuracy, 2),
                    "avg_inclusion_delay": round(avg_inclusion_delay, 3),
                    "avg_attestation_performance": round(avg_performance, 6),
                    "latest_performance": reference_day.get("attestation_performance", 0),
                    "calculation_method": "yesterday_7_day_rolling_average_overlapping"
                }
        
        return summaries
    
    def get_performance_trends(self, days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
        """Get aggregated performance trends across all operators"""
        cache = self._load_cache()
        operators = cache.get("operators", {})
        
        # Collect daily data across all operators
        daily_aggregates = {}
        
        for operator, data in operators.items():
            daily_performance = data.get("daily_performance", [])
            
            for day_data in daily_performance[:days]:  # Limit to requested days
                date = day_data.get("date")
                if not date:
                    continue
                
                if date not in daily_aggregates:
                    daily_aggregates[date] = {
                        "date": date,
                        "operators": [],
                        "total_validators": 0,
                        "participation_rates": [],
                        "head_accuracies": [],
                        "target_accuracies": [],
                        "source_accuracies": [],
                        "inclusion_delays": [],
                        "performances": []
                    }
                
                agg = daily_aggregates[date]
                agg["operators"].append(operator)
                agg["total_validators"] += day_data.get("validator_count", 0)
                agg["participation_rates"].append(day_data.get("participation_rate", 0))
                agg["head_accuracies"].append(day_data.get("head_accuracy", 0))
                agg["target_accuracies"].append(day_data.get("target_accuracy", 0))
                agg["source_accuracies"].append(day_data.get("source_accuracy", 0))
                agg["inclusion_delays"].append(day_data.get("avg_inclusion_delay", 0))
                agg["performances"].append(day_data.get("attestation_performance", 0))
        
        # Calculate averages for each day
        trends = []
        for date in sorted(daily_aggregates.keys(), reverse=True):
            agg = daily_aggregates[date]
            
            trends.append({
                "date": date,
                "operators_count": len(agg["operators"]),
                "total_validators": agg["total_validators"],
                "avg_participation_rate": round(sum(agg["participation_rates"]) / len(agg["participation_rates"]), 2) if agg["participation_rates"] else 0,
                "avg_head_accuracy": round(sum(agg["head_accuracies"]) / len(agg["head_accuracies"]), 2) if agg["head_accuracies"] else 0,
                "avg_target_accuracy": round(sum(agg["target_accuracies"]) / len(agg["target_accuracies"]), 2) if agg["target_accuracies"] else 0,
                "avg_source_accuracy": round(sum(agg["source_accuracies"]) / len(agg["source_accuracies"]), 2) if agg["source_accuracies"] else 0,
                "avg_inclusion_delay": round(sum(agg["inclusion_delays"]) / len(agg["inclusion_delays"]), 3) if agg["inclusion_delays"] else 0,
                "avg_attestation_performance": round(sum(agg["performances"]) / len(agg["performances"]), 6) if agg["performances"] else 0
            })
        
        return {"trends": trends}
    
    def get_operator_rank_history(self, operator: str, days: int = 30) -> Dict[str, Any]:
        """Get rank history for a specific operator using 7-day rolling averages"""
        cache = self._load_cache()
        operators = cache.get("operators", {})
        
        if operator not in operators:
            return None
        
        # Build comprehensive daily data for all operators
        all_operators_daily = {}
        for op_addr, op_data in operators.items():
            daily_performance = op_data.get("daily_performance", [])
            all_operators_daily[op_addr] = daily_performance
        
        rank_history = []
        target_operator_data = operators[operator].get("daily_performance", [])
        
        # Calculate rank for each day using 7-day rolling averages
        for day_index in range(min(days, len(target_operator_data))):
            date = target_operator_data[day_index].get("date")
            if not date:
                continue
            
            # Calculate 7-day rolling averages for all operators as of this date
            operator_averages = []
            for op_addr, op_daily_data in all_operators_daily.items():
                # Find the index for this date in this operator's data
                op_day_index = None
                for i, day_data in enumerate(op_daily_data):
                    if day_data.get("date") == date:
                        op_day_index = i
                        break
                
                if op_day_index is None:
                    continue
                    
                # Calculate 7-day average ending on this date
                # Since data is stored newest-first, we need to go FORWARD in array for older dates
                start_index = op_day_index  # Start from current date
                end_index = min(op_day_index + 7, len(op_daily_data))  # Include up to 7 days ending on current date
                
                recent_days = op_daily_data[start_index:end_index]
                if len(recent_days) > 0:
                    avg_performance = sum(day.get("attestation_performance", 0) for day in recent_days) / len(recent_days)
                    # Use 5 decimal places for precise sorting
                    avg_performance = round(avg_performance, 5)
                    
                    operator_averages.append({
                        "operator": op_addr,
                        "avg_performance": avg_performance,
                        "days_included": len(recent_days)
                    })
            
            # Sort by 7-day average performance (descending) with 4 decimal precision
            operator_averages.sort(key=lambda x: x["avg_performance"], reverse=True)
            
            # Find rank of target operator
            rank = 1
            target_avg_performance = None
            for i, op_avg in enumerate(operator_averages):
                if op_avg["operator"] == operator:
                    rank = i + 1
                    target_avg_performance = op_avg["avg_performance"]
                    break
            
            # Get single-day performance for display (but use 7-day avg for ranking)
            single_day_performance = target_operator_data[day_index].get("attestation_performance", 0)
            
            rank_history.append({
                "date": date,
                "rank": rank,
                "performance": target_avg_performance if target_avg_performance is not None else single_day_performance,
                "single_day_performance": single_day_performance,
                "total_operators": len(operator_averages),
                "ranking_method": "7_day_rolling_average"
            })
        
        # Reverse to get chronological order (oldest first for charting)
        rank_history.reverse()
        
        return {
            "operator": operator,
            "days": days,
            "rank_history": rank_history
        }

# Global service instance
operator_performance_service = OperatorPerformanceService()

@router.get("/cache-info")
async def get_cache_info() -> Dict[str, Any]:
    """Get information about the operator performance cache"""
    try:
        info = operator_performance_service.get_cache_info()
        return {
            "success": True,
            "data": info,
            "source": "operator_daily_performance_cache"
        }
    except Exception as e:
        logger.error(f"Failed to get cache info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache info: {str(e)}")

@router.get("/operators")
async def get_all_operators() -> Dict[str, Any]:
    """Get list of all operators with daily performance data"""
    try:
        operators = operator_performance_service.get_all_operators()
        return {
            "success": True,
            "data": operators,
            "count": len(operators),
            "source": "operator_daily_performance_cache"
        }
    except Exception as e:
        logger.error(f"Failed to get operators list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get operators: {str(e)}")

@router.get("/operators/summary")
async def get_operators_summary(
    days: Optional[int] = Query(None, description="Limit to last N days", ge=1, le=90)
) -> Dict[str, Any]:
    """Get summary performance metrics for all operators"""
    try:
        summaries = operator_performance_service.get_operators_summary(days)
        return {
            "success": True,
            "data": summaries,
            "count": len(summaries),
            "filters": {"days": days},
            "source": "operator_daily_performance_cache"
        }
    except Exception as e:
        logger.error(f"Failed to get operators summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get summary: {str(e)}")

@router.get("/operators/summary/previous-day")
async def get_operators_summary_previous_day() -> Dict[str, Any]:
    """Get summary performance metrics for all operators based on yesterday's 7-day rolling average (overlapping)"""
    try:
        summaries = operator_performance_service.get_operators_summary_previous_day()
        return {
            "success": True,
            "data": summaries,
            "count": len(summaries),
            "calculation_method": "previous_day_7_day_rolling_average",
            "source": "operator_daily_performance_cache"
        }
    except Exception as e:
        logger.error(f"Failed to get previous day operators summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get previous day summary: {str(e)}")

@router.get("/operator/{operator}")
async def get_operator_performance(
    operator: str,
    days: Optional[int] = Query(None, description="Limit to last N days", ge=1, le=90)
) -> Dict[str, Any]:
    """Get daily performance data for a specific operator"""
    try:
        data = operator_performance_service.get_operator_performance(operator, days)
        
        if data is None:
            raise HTTPException(status_code=404, detail=f"Operator {operator} not found")
        
        return {
            "success": True,
            "data": data,
            "operator": operator,
            "filters": {"days": days},
            "source": "operator_daily_performance_cache"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get operator performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance data: {str(e)}")

@router.get("/trends")
async def get_performance_trends(
    days: int = Query(30, description="Number of days to analyze", ge=1, le=90)
) -> Dict[str, Any]:
    """Get aggregated performance trends across all operators"""
    try:
        trends = operator_performance_service.get_performance_trends(days)
        return {
            "success": True,
            "data": trends,
            "filters": {"days": days},
            "source": "operator_daily_performance_cache"
        }
    except Exception as e:
        logger.error(f"Failed to get performance trends: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get trends: {str(e)}")

@router.get("/operator/{operator}/chart-data")
async def get_operator_chart_data(
    operator: str,
    days: Optional[int] = Query(30, description="Number of days for chart", ge=1, le=90)
) -> Dict[str, Any]:
    """Get operator performance data optimized for charting"""
    try:
        data = operator_performance_service.get_operator_performance(operator, days)
        
        if data is None:
            raise HTTPException(status_code=404, detail=f"Operator {operator} not found")
        
        daily_performance = data.get("daily_performance", [])
        
        # Transform for chart consumption
        chart_data = {
            "dates": [],
            "participation_rate": [],
            "head_accuracy": [],
            "target_accuracy": [],
            "source_accuracy": [],
            "inclusion_delay": [],
            "attestation_performance": [],
            "validator_count": []
        }
        
        for day in reversed(daily_performance):  # Reverse for chronological order
            chart_data["dates"].append(day.get("date"))
            chart_data["participation_rate"].append(day.get("participation_rate", 0))
            chart_data["head_accuracy"].append(day.get("head_accuracy", 0))
            chart_data["target_accuracy"].append(day.get("target_accuracy", 0))
            chart_data["source_accuracy"].append(day.get("source_accuracy", 0))
            chart_data["inclusion_delay"].append(day.get("avg_inclusion_delay", 0))
            chart_data["attestation_performance"].append(day.get("attestation_performance", 0))
            chart_data["validator_count"].append(day.get("validator_count", 0))
        
        return {
            "success": True,
            "data": chart_data,
            "operator": operator,
            "days_count": len(daily_performance),
            "filters": {"days": days},
            "source": "operator_daily_performance_cache"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get operator chart data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chart data: {str(e)}")

@router.get("/operator/{operator}/rank-history")
async def get_operator_rank_history(
    operator: str,
    days: Optional[int] = Query(30, description="Number of days for rank history", ge=1, le=90)
) -> Dict[str, Any]:
    """Get daily rank history for a specific operator"""
    try:
        data = operator_performance_service.get_operator_rank_history(operator, days)
        
        if data is None:
            raise HTTPException(status_code=404, detail=f"Operator {operator} not found")
        
        return {
            "success": True,
            "data": data,
            "operator": operator,
            "filters": {"days": days},
            "source": "operator_daily_performance_cache"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get operator rank history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get rank history: {str(e)}")