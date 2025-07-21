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
    
    def _get_operator_performance_by_period(self, performance_data: Dict, period: str) -> Tuple[Dict[str, float], Dict[str, float]]:
        """Extract operator performance data and calculate relative scores using identical table logic"""
        if not performance_data or "validators" not in performance_data:
            return {}, {}
        
        # Map period parameter to performance field names and lookback days
        period_config = {
            "1d": {"field": "performance_1d", "min_active_days": 1, "lookback_days": None},
            "7d": {"field": "performance_7d", "min_active_days": 7, "lookback_days": 10}, 
            "31d": {"field": "performance_31d", "min_active_days": 32, "lookback_days": 34}
        }
        
        if period not in period_config:
            return {}, {}
        
        config = period_config[period]
        performance_field = config["field"]
        
        # For periods without relative score calculation (1d), use simple averaging
        if config["lookback_days"] is None:
            return self._calculate_simple_operator_performance(performance_data, performance_field)
        
        # Load additional data needed for exclusions (7d and 31d only)
        proposals_data, _ = load_proposals_data()
        sync_committee_data, _ = load_sync_committee_data()
        
        # Calculate timestamps for exclusions
        import time
        current_timestamp = time.time()
        lookback_timestamp = current_timestamp - (config["lookback_days"] * 24 * 60 * 60)
        min_activation_timestamp = current_timestamp - (config["min_active_days"] * 24 * 60 * 60)
        
        # Get excluded validators (with proposals or sync duties in lookback period)
        excluded_validators = self._get_excluded_validators(proposals_data, sync_committee_data, lookback_timestamp)
        
        # Calculate attestation-only performance per operator using identical table logic
        operator_performance, operator_relative_scores = self._calculate_attestation_only_performance(
            performance_data, performance_field, excluded_validators, min_activation_timestamp
        )
        
        return operator_performance, operator_relative_scores
    
    def _calculate_simple_operator_performance(self, performance_data: Dict, performance_field: str) -> Tuple[Dict[str, float], Dict[str, float]]:
        """Simple performance calculation for periods without relative scoring"""
        operator_performance = {}
        operator_totals = {}
        operator_counts = {}
        
        for validator_id, validator_info in performance_data["validators"].items():
            operator = validator_info.get("operator", "Unknown")
            performance_metrics = validator_info.get("performance_metrics", {})
            
            if performance_field in performance_metrics:
                performance_value = performance_metrics[performance_field]
                
                if operator not in operator_totals:
                    operator_totals[operator] = 0
                    operator_counts[operator] = 0
                
                operator_totals[operator] += performance_value
                operator_counts[operator] += 1
        
        # Calculate average performance per operator
        for operator in operator_totals:
            if operator_counts[operator] > 0:
                operator_performance[operator] = operator_totals[operator] / operator_counts[operator]
            else:
                operator_performance[operator] = 0
        
        return operator_performance, {}
    
    def _get_excluded_validators(self, proposals_data: Optional[Dict], sync_committee_data: Optional[Dict], lookback_timestamp: float) -> set:
        """Get validators to exclude based on proposals and sync committee duties"""
        excluded_validators = set()
        
        # Exclude validators with proposals in lookback period
        if proposals_data and "proposals" in proposals_data:
            for proposal in proposals_data["proposals"]:
                proposal_timestamp = proposal.get("timestamp", 0)
                if proposal_timestamp >= lookback_timestamp:
                    validator_index = proposal.get("validator_index") or proposal.get("proposer_index")
                    if validator_index:
                        excluded_validators.add(validator_index)
        
        # Exclude validators with sync committee duties in lookback period  
        if sync_committee_data and "detailed_stats" in sync_committee_data:
            GENESIS_TIME = 1606824023  # Ethereum beacon chain genesis time
            for stat in sync_committee_data["detailed_stats"]:
                if stat.get("validator_index") and stat.get("actual_end_slot"):
                    end_timestamp = GENESIS_TIME + (stat["actual_end_slot"] * 12)  # Genesis + slot * 12 seconds
                    if end_timestamp >= lookback_timestamp:
                        excluded_validators.add(stat["validator_index"])
        
        return excluded_validators
    
    def _calculate_attestation_only_performance(self, performance_data: Dict, performance_field: str, excluded_validators: set, min_activation_timestamp: float) -> Tuple[Dict[str, float], Dict[str, float]]:
        """Calculate attestation-only performance using identical table logic"""
        operator_data = {}
        
        for validator_id, validator_info in performance_data["validators"].items():
            operator = validator_info.get("operator", "Unknown")
            validator_index = validator_info.get("validator_index")
            performance_metrics = validator_info.get("performance_metrics", {})
            activation_data = validator_info.get("activation_data", {})
            
            # Check minimum activity requirement
            activation_timestamp = activation_data.get("activation_timestamp", 0)
            if activation_timestamp > min_activation_timestamp:
                continue  # Skip validators that haven't been active long enough
            
            if performance_field in performance_metrics and validator_index is not None:
                performance_gwei = performance_metrics[performance_field]
                
                if operator not in operator_data:
                    operator_data[operator] = {
                        "total_validators": 0,
                        "attestation_only_validators": 0,
                        "excluded_validators": 0,
                        "regular_performances": []
                    }
                
                operator_data[operator]["total_validators"] += 1
                
                if validator_index in excluded_validators:
                    operator_data[operator]["excluded_validators"] += 1
                elif performance_gwei > 0:
                    # This is an attestation-only validator with positive performance
                    operator_data[operator]["attestation_only_validators"] += 1
                    operator_data[operator]["regular_performances"].append(performance_gwei)
        
        # Calculate average performance per operator
        operator_performance = {}
        operator_averages = []
        
        for operator, data in operator_data.items():
            if len(data["regular_performances"]) > 0:
                avg_performance = sum(data["regular_performances"]) / len(data["regular_performances"])
                operator_performance[operator] = avg_performance
                operator_averages.append(avg_performance)
            else:
                operator_performance[operator] = 0
        
        # Calculate relative scores (top performer = 100%)
        highest_performance = max(operator_averages) if operator_averages else 1
        operator_relative_scores = {}
        
        for operator, performance in operator_performance.items():
            if highest_performance > 0:
                operator_relative_scores[operator] = (performance / highest_performance) * 100
            else:
                operator_relative_scores[operator] = 0
        
        return operator_performance, operator_relative_scores
    
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
    
    def create_performance_analysis(self, period: Optional[str] = None) -> Dict[str, Any]:
        """Create performance analysis data, optionally filtered by performance period"""
        try:
            validator_data, _ = load_validator_data()
            performance_data, _ = load_validator_performance_data()
            ens_names, _ = load_ens_names()
            
            if not validator_data:
                return {"error": "Validator data not available"}
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            
            # If period is specified, use period-specific performance data
            if period and performance_data:
                operator_performance, operator_ranks = self._get_operator_performance_by_period(performance_data, period)
            else:
                operator_performance = self._get_operator_performance_from_data(validator_data, performance_data)
                operator_ranks = {}
            
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
                    operator_data = {
                        'operator': display_name,
                        'full_address': addr,
                        'performance': performance,
                        'validator_count': validator_count,
                        'performance_category': category
                    }
                    
                    # Add rank information if available
                    if addr in operator_ranks:
                        operator_data['relative_score'] = operator_ranks[addr]
                    
                    perf_data.append(operator_data)

            # Calculate percentages
            performance_distribution = {}
            if total_validators > 0:
                performance_distribution = {
                    "excellent": round((performance_counts["excellent"] / total_validators) * 100, 1),
                    "good": round((performance_counts["good"] / total_validators) * 100, 1),
                    "average": round((performance_counts["average"] / total_validators) * 100, 1),
                    "poor": round((performance_counts["poor"] / total_validators) * 100, 1)
                }

            result = {
                'excellent_count': performance_counts["excellent"],
                'good_count': performance_counts["good"],
                'average_count': performance_counts["average"],
                'poor_count': performance_counts["poor"],
                'total_validators': total_validators,
                'performance_distribution': performance_distribution,
                'operator_details': sorted(perf_data, key=lambda x: x['performance'], reverse=True)  # All operators sorted by performance
            }
            
            # Add period information if specified
            if period:
                result['period'] = period
                result['performance_field'] = f"performance_{period}"
                
            return result
            
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
                'graffiti_coverage_percent': graffiti_coverage,
                'operator_details': analysis_result.get('operator_details', {})
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
            exited_validators = validator_data.get('exited_validators', {})
            total_validators = sum(operator_validators.values())
            
            # Sort operators by validator count
            sorted_operators = sorted(operator_validators.items(), key=lambda x: x[1], reverse=True)
            
            top_operators = []
            for i, (operator_addr, total_count) in enumerate(sorted_operators[:limit]):
                display_name = format_operator_display_plain(operator_addr, ens_names or {})
                exited_count = exited_validators.get(operator_addr, 0)
                active_count = total_count - exited_count
                percentage = (total_count / total_validators) * 100 if total_validators > 0 else 0
                exit_rate = (exited_count / total_count) * 100 if total_count > 0 else 0
                
                top_operators.append({
                    'rank': i + 1,
                    'operator': display_name,
                    'full_address': operator_addr,
                    'validator_count': total_count,
                    'active_count': active_count,
                    'exited_count': exited_count,
                    'exit_rate': round(exit_rate, 2),
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
            
            # Get the correct counts from the data structure
            total_validators = validator_data.get("total_validators", 0)
            total_exited = validator_data.get("total_exited", 0)
            pending_count = len(validator_data.get("pending_pubkeys", []))
            
            # Calculate viable validators (total - exited)
            viable_validators = total_validators - total_exited
            
            # Calculate activated validators (viable - queue)
            validators_in_queue = pending_count
            active_validators = viable_validators - validators_in_queue
            
            # Calculate correct percentages that add up to 100% (based on viable validators)
            activation_rate = round((active_validators / viable_validators) * 100, 1) if viable_validators > 0 else 0
            queue_rate = round((validators_in_queue / viable_validators) * 100, 1) if viable_validators > 0 else 0
            
            operator_validators = self._get_operator_validators_from_data(validator_data)
            total_operators = len(operator_validators)
            
            # Proposals statistics
            proposals_stats = {"total_proposals": 0, "successful_proposals": 0, "missed_proposals": 0}
            if proposals_data:
                proposals = proposals_data.get("proposals", [])
                proposals_stats["total_proposals"] = len(proposals)
                proposals_stats["successful_proposals"] = sum(1 for p in proposals if p.get("status") == "proposed")
                proposals_stats["missed_proposals"] = proposals_stats["total_proposals"] - proposals_stats["successful_proposals"]
            
            # Calculate network health score
            proposal_success_rate = (proposals_stats["successful_proposals"] / proposals_stats["total_proposals"]) * 100 if proposals_stats["total_proposals"] > 0 else 100
            active_rate = (active_validators / total_validators) * 100 if total_validators > 0 else 100
            network_health_score = (proposal_success_rate + active_rate) / 2
            
            return {
                'total_validators': total_validators,
                'active_validators': active_validators,
                'validators_in_queue': validators_in_queue,
                'activation_rate': activation_rate,
                'queue_rate': queue_rate,
                'total_operators': total_operators,
                **proposals_stats,
                'network_health_score': round(network_health_score, 1)
            }
            
        except Exception as e:
            return {"error": f"Failed to get network overview: {str(e)}"}
    
    def get_all_exit_records(self):
        """Extract all individual exit records from validator data exit_details and active_exiting_details"""
        try:
            # Load validator data which contains complete exit details
            validator_data, _ = load_validator_data()
            if not validator_data:
                return {"error": "Validator data not available"}
            
            # Load ENS names for operator display
            ens_names_data, _ = load_ens_names()
            ens_names = ens_names_data or {}
            
            # Get all exit details from validator data (completed exits)
            exit_details = validator_data.get('exit_details', {})
            # Get active exiting details (validators currently in exit process)
            active_exiting_details = validator_data.get('active_exiting_details', {})
            
            if not exit_details and not active_exiting_details:
                return {"error": "No exit details found in validator data"}
            
            # Convert all exit details to individual records
            all_exit_records = []
            
            # Process completed exits from exit_details
            for validator_pubkey, exit_info in exit_details.items():
                exit_record = self._create_exit_record(validator_pubkey, exit_info, ens_names)
                all_exit_records.append(exit_record)
            
            # Process active exiting validators from active_exiting_details
            for validator_pubkey, exit_info in active_exiting_details.items():
                # For active_exiting, use active_exiting_timestamp as exit_timestamp
                # and active_exiting_epoch as exit_epoch for consistency
                if 'active_exiting_timestamp' in exit_info:
                    exit_info['exit_timestamp'] = exit_info['active_exiting_timestamp']
                if 'active_exiting_epoch' in exit_info:
                    exit_info['exit_epoch'] = exit_info['active_exiting_epoch']
                
                exit_record = self._create_exit_record(validator_pubkey, exit_info, ens_names)
                all_exit_records.append(exit_record)
            
            # Sort by exit timestamp (most recent first), then by validator index
            all_exit_records.sort(key=lambda x: (
                -(x.get('exit_timestamp', 0) or 0),  # Newest first
                x.get('validator_index', 0) if isinstance(x.get('validator_index'), int) else 0
            ))
            
            return {
                'recent_exits': all_exit_records,
                'total_count': len(all_exit_records)
            }
            
        except Exception as e:
            return {"error": f"Failed to get all exit records: {str(e)}"}
    
    def _create_exit_record(self, validator_pubkey, exit_info, ens_names):
        """Helper method to create a standardized exit record"""
        # Extract exit information
        validator_index = exit_info.get('validator_index', 'N/A')
        operator = exit_info.get('operator', '')
        operator_name = exit_info.get('operator_name', '')
        if not operator_name and operator:
            operator_name = ens_names.get(operator, f"{operator[:8]}...{operator[-6:]}")
        
        status = exit_info.get('status', 'unknown')
        exit_epoch = exit_info.get('exit_epoch', 'N/A')
        exit_timestamp = exit_info.get('exit_timestamp')
        slashed = exit_info.get('slashed', False)
        balance_gwei = exit_info.get('balance')
        
        # Convert timestamp to formatted date if available
        exit_date = 'N/A'
        if exit_timestamp:
            try:
                from datetime import datetime
                exit_date = datetime.fromtimestamp(exit_timestamp).strftime('%Y-%m-%d %H:%M:%S')
            except:
                exit_date = 'N/A'
        
        # Create exit record with all available data
        return {
            'validator_index': validator_index,
            'validator_pubkey': validator_pubkey,
            'operator': operator,
            'operator_name': operator_name,
            'exit_timestamp': exit_timestamp,
            'exit_date': exit_date,
            'status': status,
            'slashed': slashed,
            'balance_gwei': balance_gwei,
            'exit_epoch': exit_epoch
        }
    
    def get_enhanced_exit_data(self):
        """Generate enhanced exit data that includes both exited and active_exiting validators"""
        try:
            # Load validator data
            validator_data, _ = load_validator_data()
            if not validator_data:
                return {"error": "Validator data not available"}
            
            # Load ENS names
            ens_names_data, _ = load_ens_names()
            ens_names = ens_names_data or {}
            
            # Get both completed exits and active exiting validators
            exit_details = validator_data.get('exit_details', {})
            active_exiting_details = validator_data.get('active_exiting_details', {})
            
            # Track operators and their exit statistics
            operator_stats = {}
            all_exit_records = []
            
            # Process completed exits
            for validator_pubkey, exit_info in exit_details.items():
                operator = exit_info.get('operator', '')
                if not operator:
                    continue
                    
                # Initialize operator stats if not exists
                if operator not in operator_stats:
                    operator_name = exit_info.get('operator_name', '')
                    if not operator_name:
                        operator_name = ens_names.get(operator, f"{operator[:8]}...{operator[-6:]}")
                    operator_stats[operator] = {
                        'operator': operator,
                        'operator_name': operator_name,
                        'exits': 0,
                        'active_exiting': 0,
                        'still_active': 0,
                        'total_ever': 0,
                        'latest_exit_timestamp': 0,
                        'latest_exit_date': ''
                    }
                
                # Count completed exit
                operator_stats[operator]['exits'] += 1
                
                # Update latest exit info
                exit_timestamp = exit_info.get('exit_timestamp', 0) or 0
                if exit_timestamp > operator_stats[operator]['latest_exit_timestamp']:
                    operator_stats[operator]['latest_exit_timestamp'] = exit_timestamp
                    try:
                        from datetime import datetime
                        operator_stats[operator]['latest_exit_date'] = datetime.fromtimestamp(exit_timestamp).strftime('%Y-%m-%d')
                    except:
                        operator_stats[operator]['latest_exit_date'] = 'N/A'
                
                # Add to all records
                exit_record = self._create_exit_record(validator_pubkey, exit_info, ens_names)
                all_exit_records.append(exit_record)
            
            # Process active exiting validators
            for validator_pubkey, exit_info in active_exiting_details.items():
                operator = exit_info.get('operator', '')
                if not operator:
                    continue
                    
                # Initialize operator stats if not exists
                if operator not in operator_stats:
                    operator_name = exit_info.get('operator_name', '')
                    if not operator_name:
                        operator_name = ens_names.get(operator, f"{operator[:8]}...{operator[-6:]}")
                    operator_stats[operator] = {
                        'operator': operator,
                        'operator_name': operator_name,
                        'exits': 0,
                        'active_exiting': 0,
                        'still_active': 0,
                        'total_ever': 0,
                        'latest_exit_timestamp': 0,
                        'latest_exit_date': ''
                    }
                
                # Count active exiting
                operator_stats[operator]['active_exiting'] += 1
                
                # Update latest exit info with active_exiting timestamp
                exit_timestamp = exit_info.get('active_exiting_timestamp', 0) or 0
                if exit_timestamp > operator_stats[operator]['latest_exit_timestamp']:
                    operator_stats[operator]['latest_exit_timestamp'] = exit_timestamp
                    try:
                        from datetime import datetime
                        operator_stats[operator]['latest_exit_date'] = datetime.fromtimestamp(exit_timestamp).strftime('%Y-%m-%d')
                    except:
                        operator_stats[operator]['latest_exit_date'] = 'N/A'
                
                # Add to all records (normalize field names)
                if 'active_exiting_timestamp' in exit_info:
                    exit_info['exit_timestamp'] = exit_info['active_exiting_timestamp']
                if 'active_exiting_epoch' in exit_info:
                    exit_info['exit_epoch'] = exit_info['active_exiting_epoch']
                
                exit_record = self._create_exit_record(validator_pubkey, exit_info, ens_names)
                all_exit_records.append(exit_record)
            
            # Get operator validator counts from main validator data
            operator_validators = validator_data.get('operator_validators', {})
            
            # Finalize operator statistics
            operators_with_exits = []
            for operator, stats in operator_stats.items():
                total_validators = operator_validators.get(operator, 0)
                total_exits_and_exiting = stats['exits'] + stats['active_exiting']
                stats['still_active'] = max(0, total_validators - stats['exits'])  # Only subtract completed exits
                stats['total_ever'] = total_validators
                stats['exit_rate'] = (total_exits_and_exiting / total_validators * 100) if total_validators > 0 else 0.0
                
                # Only include operators that have exits or active_exiting
                if total_exits_and_exiting > 0:
                    operators_with_exits.append(stats)
            
            # Sort operators by total exits + active_exiting (descending)
            operators_with_exits.sort(key=lambda x: (x['exits'] + x['active_exiting']), reverse=True)
            
            # Calculate summary statistics
            total_exited = sum(op['exits'] for op in operators_with_exits)
            total_active_exiting = sum(op['active_exiting'] for op in operators_with_exits)
            total_active = sum(op['still_active'] for op in operators_with_exits)
            total_validators = total_exited + total_active_exiting + total_active
            exit_rate_percent = ((total_exited + total_active_exiting) / total_validators * 100) if total_validators > 0 else 0.0
            
            # Sort all exit records by timestamp
            all_exit_records.sort(key=lambda x: -(x.get('exit_timestamp', 0) or 0))
            
            # Create enhanced exit data structure
            enhanced_exit_data = {
                'exit_summary': {
                    'total_exited': total_exited,
                    'total_active_exiting': total_active_exiting,
                    'total_active': total_active,
                    'exit_rate_percent': exit_rate_percent,
                    'last_updated': int(validator_data.get('last_block_timestamp', 0)) or int(__import__('time').time())
                },
                'operators_with_exits': operators_with_exits,
                'recent_exits': all_exit_records[:100],  # Limit to most recent 100
                'total_operators_with_exits': len(operators_with_exits)
            }
            
            return enhanced_exit_data
            
        except Exception as e:
            return {"error": f"Failed to generate enhanced exit data: {str(e)}"}

# Create singleton instance
analytics_service = AnalyticsService()