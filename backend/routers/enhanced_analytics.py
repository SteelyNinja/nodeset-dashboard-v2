#!/usr/bin/env python3
"""
Enhanced Analytics API endpoints
Serves MEV, sync committee, and proposal data for individual operators
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import json
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter()

class EnhancedAnalyticsService:
    """Service to load and serve enhanced analytics data"""
    
    def __init__(self):
        self.data_paths = {
            "proposals": [
                "../json_data/proposals.json",
                "/home/gary/git/nodeset-sw-validator-summary/proposals.json",
                "proposals.json"
            ],
            "sync_committee": [
                "../json_data/sync_committee_participation.json",
                "/home/gary/git/nodeset-sw-validator-summary/sync_committee_participation.json",
                "sync_committee_participation.json"
            ],
            "mev_analysis": [
                "../json_data/mev_analysis_results.json",
                "/home/gary/git/nodeset-sw-validator-summary/mev_analysis_results.json",
                "mev_analysis_results.json"
            ],
            "missed_proposals": [
                "../json_data/missed_proposals_cache.json",
                "/home/gary/git/nodeset-sw-validator-summary/missed_proposals_cache.json",
                "missed_proposals_cache.json"
            ]
        }
        self._cache = {}
        self._last_loaded = {}
    
    def _find_data_file(self, data_type: str) -> Optional[str]:
        """Find the data file in possible locations"""
        for path in self.data_paths.get(data_type, []):
            if os.path.exists(path):
                return path
        return None
    
    def _load_data(self, data_type: str, force_reload: bool = False) -> Dict:
        """Load data with automatic refresh"""
        data_path = self._find_data_file(data_type)
        if not data_path:
            logger.warning(f"{data_type} data file not found")
            return {}
        
        try:
            file_mtime = os.path.getmtime(data_path)
            if not force_reload and data_type in self._cache and data_type in self._last_loaded and file_mtime <= self._last_loaded[data_type]:
                return self._cache[data_type]
            
            with open(data_path, 'r') as f:
                self._cache[data_type] = json.load(f)
                self._last_loaded[data_type] = file_mtime
                logger.debug(f"Loaded {data_type} data from {data_path}")
                return self._cache[data_type]
                
        except Exception as e:
            logger.error(f"Failed to load {data_type} data: {e}")
            return {}
    
    def get_operator_mev_analytics(self, operator: str) -> Dict[str, Any]:
        """Get MEV analytics for a specific operator"""
        proposals_data = self._load_data("proposals")
        mev_data = self._load_data("mev_analysis")
        
        operator_summary = proposals_data.get("operator_summary", {}).get(operator, {})
        
        # Get MEV relay coverage for this operator's validators
        mev_coverage = 0
        relay_details = {}
        
        if mev_data and "operator_analysis" in mev_data:
            operator_mev = mev_data.get("operator_analysis", {}).get(operator, {})
            mev_coverage = operator_mev.get("mev_coverage_percent", 0)
            relay_details = operator_mev.get("relay_registrations", {})
        
        return {
            "operator": operator,
            "proposal_count": operator_summary.get("proposal_count", 0),
            "total_value_eth": operator_summary.get("total_value_eth", 0),
            "average_value_eth": operator_summary.get("average_value_eth", 0),
            "consensus_rewards_eth": operator_summary.get("consensus_rewards_eth", 0),
            "execution_rewards_eth": operator_summary.get("execution_rewards_eth", 0),
            "mev_rewards_eth": operator_summary.get("mev_rewards_eth", 0),
            "mev_blocks_count": operator_summary.get("mev_blocks_count", 0),
            "mev_blocks_percentage": operator_summary.get("mev_blocks_percentage", 0),
            "mev_coverage_percentage": mev_coverage,
            "relay_registrations": relay_details,
            "proposal_success_rate": self._calculate_proposal_success_rate(operator)
        }
    
    def get_operator_sync_committee_analytics(self, operator: str) -> Dict[str, Any]:
        """Get sync committee analytics for a specific operator"""
        sync_data = self._load_data("sync_committee")
        
        if not sync_data:
            return {
                "operator": operator,
                "participation_rate": 0,
                "periods_participated": 0,
                "total_attestations": 0,
                "successful_attestations": 0,
                "missed_attestations": 0
            }
        
        operator_summary = sync_data.get("operator_summary", {}).get(operator, {})
        
        return {
            "operator": operator,
            "participation_rate": operator_summary.get("participation_rate", 0),
            "periods_participated": operator_summary.get("total_periods", 0),
            "total_attestations": operator_summary.get("total_slots", 0),
            "successful_attestations": operator_summary.get("total_successful", 0),
            "missed_attestations": operator_summary.get("total_missed", 0),
            "recent_periods": self._get_recent_sync_periods(operator, sync_data)
        }
    
    def _calculate_proposal_success_rate(self, operator: str) -> float:
        """Calculate proposal success rate by checking missed proposals"""
        missed_data = self._load_data("missed_proposals")
        proposals_data = self._load_data("proposals")
        
        if not missed_data or not proposals_data:
            return 100.0
        
        total_proposals = proposals_data.get("operator_summary", {}).get(operator, {}).get("proposal_count", 0)
        missed_proposals = len([
            p for p in missed_data.get("missed_proposals", [])
            if p.get("operator") == operator
        ])
        
        if total_proposals + missed_proposals == 0:
            return 100.0
            
        return ((total_proposals / (total_proposals + missed_proposals)) * 100)
    
    def _get_recent_sync_periods(self, operator: str, sync_data: Dict) -> List[Dict]:
        """Get recent sync committee periods for an operator"""
        detailed_stats = sync_data.get("detailed_stats", [])
        operator_periods = []
        
        for validator_data in detailed_stats:
            if validator_data.get("operator") == operator:
                operator_periods.append({
                    "period": validator_data.get("period"),
                    "participation_rate": validator_data.get("participation_rate", 0),
                    "successful": validator_data.get("successful_attestations", 0),
                    "missed": validator_data.get("missed_attestations", 0)
                })
        
        # Return last 5 periods
        return sorted(operator_periods, key=lambda x: int(x["period"]), reverse=True)[:5]

# Global service instance
enhanced_analytics_service = EnhancedAnalyticsService()

@router.get("/operator/{operator}/mev-analytics")
async def get_operator_mev_analytics(operator: str) -> Dict[str, Any]:
    """Get MEV analytics for a specific operator"""
    try:
        data = enhanced_analytics_service.get_operator_mev_analytics(operator)
        return {
            "success": True,
            "data": data,
            "operator": operator,
            "source": "proposals.json + mev_analysis_results.json"
        }
    except Exception as e:
        logger.error(f"Failed to get MEV analytics for {operator}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get MEV analytics: {str(e)}")

@router.get("/operator/{operator}/sync-committee")
async def get_operator_sync_committee(operator: str) -> Dict[str, Any]:
    """Get sync committee analytics for a specific operator"""
    try:
        data = enhanced_analytics_service.get_operator_sync_committee_analytics(operator)
        return {
            "success": True,
            "data": data,
            "operator": operator,
            "source": "sync_committee_participation.json"
        }
    except Exception as e:
        logger.error(f"Failed to get sync committee analytics for {operator}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sync committee analytics: {str(e)}")

@router.get("/operator/{operator}/comprehensive")
async def get_operator_comprehensive_analytics(
    operator: str,
    days: Optional[int] = Query(None, description="Limit daily performance to last N days", ge=1, le=90)
) -> Dict[str, Any]:
    """Get comprehensive enhanced analytics for a specific operator"""
    try:
        mev_data = enhanced_analytics_service.get_operator_mev_analytics(operator)
        sync_data = enhanced_analytics_service.get_operator_sync_committee_analytics(operator)
        
        # Import and get daily performance data
        from .operator_performance import operator_performance_service
        performance_data = operator_performance_service.get_operator_performance(operator, days)
        
        return {
            "success": True,
            "data": {
                "mev_analytics": mev_data,
                "sync_committee": sync_data,
                "daily_performance": performance_data.get("daily_performance", []) if performance_data else [],
                "composite_score": {
                    "mev_health": min(100, mev_data.get("mev_coverage_percentage", 0) + mev_data.get("proposal_success_rate", 100) - 100),
                    "sync_health": sync_data.get("participation_rate", 0),
                    "overall_health": (
                        (mev_data.get("mev_coverage_percentage", 0) * 0.3) +
                        (mev_data.get("proposal_success_rate", 100) * 0.3) +
                        (sync_data.get("participation_rate", 0) * 0.4)
                    )
                }
            },
            "operator": operator,
            "source": "multiple_enhanced_sources"
        }
    except Exception as e:
        logger.error(f"Failed to get comprehensive analytics for {operator}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get comprehensive analytics: {str(e)}")

@router.get("/network/mev-summary")
async def get_network_mev_summary() -> Dict[str, Any]:
    """Get network-wide MEV analytics summary"""
    try:
        proposals_data = enhanced_analytics_service._load_data("proposals")
        mev_data = enhanced_analytics_service._load_data("mev_analysis")
        
        return {
            "success": True,
            "data": {
                "metadata": proposals_data.get("metadata", {}),
                "mev_summary": mev_data.get("summary", {}),
                "relay_performance": mev_data.get("relay_performance", {})
            },
            "source": "proposals.json + mev_analysis_results.json"
        }
    except Exception as e:
        logger.error(f"Failed to get network MEV summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get network MEV summary: {str(e)}")