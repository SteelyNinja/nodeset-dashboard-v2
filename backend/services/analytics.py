"""
Analytics service for processing data and generating insights
Converts existing analysis functions to work with FastAPI backend
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from collections import Counter
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_loader_api import (
    load_validator_data,
    load_proposals_data,
    load_mev_analysis_data,
    load_sync_committee_data,
    load_ens_names,
    load_validator_performance_data,
    load_exit_data
)
from utils import format_operator_display_plain, get_performance_category

class AnalyticsService:
    """Service class for all analytics operations"""
    
    def __init__(self):
        self._cache = {}
    
    def _get_operator_validators_from_data(self, validator_data: Dict) -> Dict[str, int]:
        """Extract operator validator counts from validator data"""
        if not validator_data:
            return {}
        
        # Check if data has operator_validators directly
        if "operator_validators" in validator_data:
            return validator_data["operator_validators"]
        
        # Fallback to parsing validators array
        operator_counts = {}
        validators = validator_data.get("validators", [])
        
        for validator in validators:
            operator = validator.get("operator", "")
            if operator:
                operator_counts[operator] = operator_counts.get(operator, 0) + 1
        
        return operator_counts
    
    def _get_operator_performance_from_data(self, validator_data: Dict, performance_data: Dict) -> Dict[str, float]:
        """Extract operator performance data"""
        if not validator_data:
            return {}
        
        # Check if data has operator_performance directly
        if "operator_performance" in validator_data:
            return validator_data["operator_performance"]
        
        # Fallback to using separate performance data or validator data
        if performance_data and "operator_performance" in performance_data:
            return performance_data["operator_performance"]
        
        # Fallback to parsing validators array
        operator_performance = {}
        validators = validator_data.get("validators", [])
        
        for validator in validators:
            operator = validator.get("operator", "")
            performance = validator.get("performance", 0)
            
            if operator:
                if operator not in operator_performance:
                    operator_performance[operator] = []
                operator_performance[operator].append(performance)
        
        # Average the performance for each operator
        for operator, perfs in operator_performance.items():
            operator_performance[operator] = sum(perfs) / len(perfs) if perfs else 0
        
        return operator_performance
    
    def calculate_concentration_metrics(self) -> Dict[str, Any]:
        """Calculate concentration metrics including Gini coefficient"""
        try:
            validator_data, _ = load_validator_data()
            if not validator_data:
                return {"error": "Validator data not available"}
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            
            if not operator_validators:
                return {"error": "No operator data found"}

            total_validators = sum(operator_validators.values())
            operator_counts = list(operator_validators.values())
            operator_counts.sort()

            n = len(operator_counts)
            if n == 0 or total_validators == 0:
                return {"error": "Invalid data for concentration calculation"}

            # Calculate Gini coefficient
            index = np.arange(1, n + 1)
            gini = (2 * np.sum(index * operator_counts)) / (n * total_validators) - (n + 1) / n
            gini = max(0, min(1, gini))

            # Calculate top operator concentrations
            operator_counts_desc = sorted(operator_counts, reverse=True)
            
            top_1_pct = (operator_counts_desc[0] / total_validators) * 100 if operator_counts_desc else 0
            top_5_pct = (sum(operator_counts_desc[:min(5, len(operator_counts_desc))]) / total_validators) * 100
            top_10_pct = (sum(operator_counts_desc[:min(10, len(operator_counts_desc))]) / total_validators) * 100
            top_20_pct = (sum(operator_counts_desc[:min(20, len(operator_counts_desc))]) / total_validators) * 100
            
            # Calculate Herfindahl index
            market_shares = [count / total_validators for count in operator_counts]
            herfindahl_index = sum(share ** 2 for share in market_shares)

            return {
                'gini_coefficient': round(gini, 4),
                'top_1_percent': round(top_1_pct, 2),
                'top_5_percent': round(top_5_pct, 2),
                'top_10_percent': round(top_10_pct, 2),
                'top_20_percent': round(top_20_pct, 2),
                'herfindahl_index': round(herfindahl_index, 4),
                'total_validators': total_validators,
                'total_operators': len(operator_validators)
            }
            
        except Exception as e:
            return {"error": f"Failed to calculate concentration metrics: {str(e)}"}
    
    def create_performance_analysis(self) -> Dict[str, Any]:
        """Create performance analysis data"""
        try:
            validator_data, _ = load_validator_data()
            performance_data, _ = load_validator_performance_data()
            ens_names, _ = load_ens_names()
            
            if not validator_data:
                return {"error": "Validator data not available"}
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            operator_performance = self._get_operator_performance_from_data(validator_data, performance_data)
            
            if not operator_performance:
                return {"error": "No performance data found"}

            # Count performance categories
            performance_counts = {"excellent": 0, "good": 0, "average": 0, "poor": 0}
            total_validators = 0
            
            perf_data = []
            for addr, performance in operator_performance.items():
                validator_count = operator_validators.get(addr, 0)
                if validator_count > 0:
                    category = get_performance_category(performance)
                    performance_counts[category.lower()] += validator_count
                    total_validators += validator_count
                    
                    display_name = format_operator_display_plain(addr, ens_names or {})
                    perf_data.append({
                        'operator': display_name,
                        'full_address': addr,
                        'performance': performance,
                        'validator_count': validator_count,
                        'performance_category': category
                    })

            # Calculate percentages
            performance_distribution = {}
            if total_validators > 0:
                performance_distribution = {
                    "excellent": round((performance_counts["excellent"] / total_validators) * 100, 1),
                    "good": round((performance_counts["good"] / total_validators) * 100, 1),
                    "average": round((performance_counts["average"] / total_validators) * 100, 1),
                    "poor": round((performance_counts["poor"] / total_validators) * 100, 1)
                }

            return {
                'excellent_count': performance_counts["excellent"],
                'good_count': performance_counts["good"],
                'average_count': performance_counts["average"],
                'poor_count': performance_counts["poor"],
                'total_validators': total_validators,
                'performance_distribution': performance_distribution,
                'operator_details': sorted(perf_data, key=lambda x: x['performance'], reverse=True)  # All operators sorted by performance
            }
            
        except Exception as e:
            return {"error": f"Failed to create performance analysis: {str(e)}"}
    
    def analyze_gas_limits(self) -> Dict[str, Any]:
        """Analyze gas limit strategies by operator"""
        try:
            mev_data, _ = load_mev_analysis_data()
            validator_data, _ = load_validator_data()
            ens_names_manual, _ = load_ens_names()
            
            # Merge ENS data sources - validator data contains reverse ENS lookups
            all_ens_names = {}
            if validator_data and 'ens_names' in validator_data:
                all_ens_names.update(validator_data['ens_names'])  # Reverse ENS lookups
            if ens_names_manual:
                all_ens_names.update(ens_names_manual)  # Manual overrides (takes precedence)
            
            if not mev_data:
                return {"error": "MEV analysis data not available"}
            
            operator_analysis = mev_data.get('operator_analysis', {})
            if not operator_analysis:
                return {"error": "No operator analysis found in MEV data"}
            
            strategy_counts = {"ultra": 0, "high": 0, "normal": 0, "low": 0}
            all_gas_limits = []
            
            gas_data = []
            for operator_addr, data in operator_analysis.items():
                gas_limits = data.get('gas_limits', [])
                if gas_limits:
                    all_gas_limits.extend(gas_limits)
                    
                    # Categorize gas limit approach
                    max_gas = max(gas_limits)
                    if max_gas >= 60000000:
                        strategy = "ultra"
                    elif max_gas >= 45000000:
                        strategy = "high"
                    elif max_gas >= 36000000:
                        strategy = "normal"
                    else:
                        strategy = "low"
                    
                    strategy_counts[strategy] += 1
                    
                    # Get ENS name if available from merged ENS sources
                    ens_name = all_ens_names.get(operator_addr, '')
                    
                    gas_data.append({
                        'operator': operator_addr,  # Raw address
                        'operator_name': ens_name if ens_name and ens_name != operator_addr else None,  # ENS name only
                        'max_gas_limit': max_gas,
                        'avg_gas_limit': data.get('average_gas_limit', 0),
                        'strategy': strategy
                    })
            
            # Calculate overall statistics
            overall_stats = {}
            if all_gas_limits:
                overall_stats = {
                    'average_gas_limit': int(np.mean(all_gas_limits)),
                    'median_gas_limit': int(np.median(all_gas_limits)),
                    'gas_limit_range': {
                        'min': int(np.min(all_gas_limits)),
                        'max': int(np.max(all_gas_limits))
                    }
                }

            return {
                'strategies': strategy_counts,
                **overall_stats,
                'operator_details': gas_data  # Return all operators
            }
            
        except Exception as e:
            return {"error": f"Failed to analyze gas limits: {str(e)}"}
    
    def analyze_client_diversity(self) -> Dict[str, Any]:
        """Analyze client diversity from graffiti data"""
        try:
            from analysis import analyze_client_diversity
            
            validator_data, _ = load_validator_data()
            proposals_data, _ = load_proposals_data()
            ens_names, _ = load_ens_names()
            
            if not validator_data or not proposals_data:
                return {"error": "No data available for client diversity analysis"}
            
            # Use real client diversity analysis
            analysis_result = analyze_client_diversity(proposals_data, validator_data, ens_names or {})
            
            if not analysis_result:
                return {"error": "No client diversity data could be extracted from proposals"}
            
            execution_counts = analysis_result.get('execution_counts', {})
            consensus_counts = analysis_result.get('consensus_counts', {})
            setup_counts = analysis_result.get('setup_counts', {})
            combination_counts = analysis_result.get('combination_counts', {})
            total_operators = analysis_result.get('total_operators', 0)
            operators_with_proposals = analysis_result.get('operators_with_proposals', 0)
            
            # Convert counts to percentages
            if operators_with_proposals > 0:
                execution_clients = {}
                consensus_clients = {}
                setup_types = {}
                
                for client, count in execution_counts.items():
                    execution_clients[client.lower()] = round((count / operators_with_proposals) * 100, 1)
                
                for client, count in consensus_counts.items():
                    consensus_clients[client.lower()] = round((count / operators_with_proposals) * 100, 1)
                
                for setup, count in setup_counts.items():
                    setup_types[setup.lower()] = round((count / operators_with_proposals) * 100, 1)
            else:
                execution_clients = {}
                consensus_clients = {}
                setup_types = {}
            
            # Calculate diversity score using Shannon entropy
            def calculate_entropy(percentages):
                if not percentages:
                    return 0
                entropy = 0
                for p in percentages.values():
                    if p > 0:
                        p_normalized = p / 100
                        entropy -= p_normalized * np.log(p_normalized)
                return entropy
            
            consensus_entropy = calculate_entropy(consensus_clients)
            execution_entropy = calculate_entropy(execution_clients)
            
            # Normalize by maximum possible entropy
            max_consensus_entropy = np.log(len(consensus_clients)) if consensus_clients else 1
            max_execution_entropy = np.log(len(execution_clients)) if execution_clients else 1
            
            normalized_consensus = consensus_entropy / max_consensus_entropy if max_consensus_entropy > 0 else 0
            normalized_execution = execution_entropy / max_execution_entropy if max_execution_entropy > 0 else 0
            
            diversity_score = (normalized_consensus + normalized_execution) / 2
            
            graffiti_coverage = round((operators_with_proposals / total_operators) * 100, 1) if total_operators > 0 else 0
            
            return {
                'consensus_clients': consensus_clients,
                'execution_clients': execution_clients,
                'setup_types': setup_types,
                'client_combinations': combination_counts,
                'diversity_score': round(diversity_score, 3),
                'analysis_note': f'Client diversity analysis based on graffiti patterns from {operators_with_proposals} operators ({graffiti_coverage}% coverage)',
                'total_operators': total_operators,
                'operators_with_proposals': operators_with_proposals,
                'graffiti_coverage_percent': graffiti_coverage
            }
            
        except Exception as e:
            return {"error": f"Failed to analyze client diversity: {str(e)}"}
    
    def get_top_operators(self, limit: int = 20) -> Dict[str, Any]:
        """Get top operators by validator count"""
        try:
            validator_data, _ = load_validator_data()
            ens_names, _ = load_ens_names()
            
            if not validator_data:
                return {"error": "Validator data not available"}
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            total_validators = sum(operator_validators.values())
            
            # Sort operators by validator count
            sorted_operators = sorted(operator_validators.items(), key=lambda x: x[1], reverse=True)
            
            top_operators = []
            for i, (operator_addr, count) in enumerate(sorted_operators[:limit]):
                display_name = format_operator_display_plain(operator_addr, ens_names or {})
                percentage = (count / total_validators) * 100 if total_validators > 0 else 0
                
                top_operators.append({
                    'rank': i + 1,
                    'operator': display_name,
                    'full_address': operator_addr,
                    'validator_count': count,
                    'percentage': round(percentage, 2)
                })
            
            return {
                'operators': top_operators,
                'total_operators': len(operator_validators),
                'total_validators': total_validators
            }
            
        except Exception as e:
            return {"error": f"Failed to get top operators: {str(e)}"}
    
    def get_network_overview(self) -> Dict[str, Any]:
        """Get comprehensive network overview statistics"""
        try:
            validator_data, _ = load_validator_data()
            proposals_data, _ = load_proposals_data()
            exit_data, _ = load_exit_data()
            
            if not validator_data:
                return {"error": "Validator data not available"}
            
            validators = validator_data.get("validators", [])
            total_validators = len(validators)
            active_validators = sum(1 for v in validators if v.get("status") == "active")
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            total_operators = len(operator_validators)
            
            # Proposals statistics
            proposals_stats = {"total_proposals": 0, "successful_proposals": 0, "missed_proposals": 0}
            if proposals_data:
                proposals = proposals_data.get("proposals", [])
                proposals_stats["total_proposals"] = len(proposals)
                proposals_stats["successful_proposals"] = sum(1 for p in proposals if p.get("status") == "proposed")
                proposals_stats["missed_proposals"] = proposals_stats["total_proposals"] - proposals_stats["successful_proposals"]
            
            # Exit statistics
            exit_stats = {"exit_rate": 0.0, "activation_rate": 0.0}
            if exit_data:
                # Would implement based on actual exit data structure
                exit_stats["exit_rate"] = 0.7  # Mock value
                exit_stats["activation_rate"] = 2.1  # Mock value
            
            # Calculate network health score
            proposal_success_rate = (proposals_stats["successful_proposals"] / proposals_stats["total_proposals"]) * 100 if proposals_stats["total_proposals"] > 0 else 100
            active_rate = (active_validators / total_validators) * 100 if total_validators > 0 else 100
            network_health_score = (proposal_success_rate + active_rate) / 2
            
            return {
                'total_validators': total_validators,
                'active_validators': active_validators,
                'total_operators': total_operators,
                **proposals_stats,
                **exit_stats,
                'network_health_score': round(network_health_score, 1)
            }
            
        except Exception as e:
            return {"error": f"Failed to get network overview: {str(e)}"}
    
    def get_all_exit_records(self):
        """Extract all individual exit records from validator data"""
        try:
            # Load main validator data
            validator_data, _ = load_validator_data()
            if not validator_data:
                return {"error": "Validator data not available"}
            
            # Load ENS names for operator display
            ens_names_data, _ = load_ens_names()
            ens_names = ens_names_data or {}
            
            # Get exit details from main validator data
            exit_details = validator_data.get('exit_details', {})
            if not exit_details:
                return {"error": "No exit details found in validator data"}
            
            # Convert exit details to individual records format
            all_exit_records = []
            
            for validator_pubkey, exit_info in exit_details.items():
                # Extract exit information
                validator_index = exit_info.get('validator_index', 'N/A')
                operator = exit_info.get('operator', '')
                operator_name = ens_names.get(operator, f"{operator[:8]}...{operator[-6:]}" if operator else 'N/A')
                status = exit_info.get('status', 'unknown')
                exit_epoch = exit_info.get('exit_epoch', 'N/A')
                
                # Try to determine slashed status from status
                slashed = 'slashed' in status.lower() if isinstance(status, str) else False
                
                # Create exit record in same format as recent_exits
                exit_record = {
                    'validator_index': validator_index,
                    'validator_pubkey': validator_pubkey,
                    'operator': operator,
                    'operator_name': operator_name,
                    'exit_timestamp': None,  # Not available in this data
                    'exit_date': 'N/A',      # Not available in this data
                    'status': status,
                    'slashed': slashed,
                    'balance_gwei': None,    # Not available in this data
                    'exit_epoch': exit_epoch
                }
                
                all_exit_records.append(exit_record)
            
            # Sort by validator index for consistency
            all_exit_records.sort(key=lambda x: x['validator_index'] if isinstance(x['validator_index'], int) else 0)
            
            return {
                'recent_exits': all_exit_records,  # Use same key as original data
                'total_count': len(all_exit_records)
            }
            
        except Exception as e:
            return {"error": f"Failed to get all exit records: {str(e)}"}

# Create singleton instance
analytics_service = AnalyticsService()