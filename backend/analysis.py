import numpy as np
import pandas as pd
from utils import format_operator_display_plain, get_performance_category
from collections import Counter
import time
from typing import Dict, List, Any, Optional

def calculate_concentration_metrics(operator_validators):
    """Calculate concentration metrics including Gini coefficient"""
    if not operator_validators:
        return {}

    total_validators = sum(operator_validators.values())
    operator_counts = list(operator_validators.values())

    operator_counts.sort()

    n = len(operator_counts)
    if n == 0 or total_validators == 0:
        return {}

    index = np.arange(1, n + 1)
    gini = (2 * np.sum(index * operator_counts)) / (n * total_validators) - (n + 1) / n

    gini = max(0, min(1, gini))

    operator_counts_desc = sorted(operator_counts, reverse=True)

    top_1_pct = (operator_counts_desc[0] / total_validators) * 100 if operator_counts_desc else 0
    top_5_pct = (sum(operator_counts_desc[:min(5, len(operator_counts_desc))]) / total_validators) * 100
    top_10_pct = (sum(operator_counts_desc[:min(10, len(operator_counts_desc))]) / total_validators) * 100

    return {
        'gini_coefficient': gini,
        'top_1_concentration': top_1_pct,
        'top_5_concentration': top_5_pct,
        'top_10_concentration': top_10_pct,
        'total_operators': len(operator_validators),
        'total_validators': total_validators
    }

def create_performance_analysis(operator_performance, operator_validators, ens_names):
    """Create performance analysis data and charts"""
    if not operator_performance:
        return None, None, None

    perf_data = []
    for addr, performance in operator_performance.items():
        validator_count = operator_validators.get(addr, 0)
        if validator_count > 0:
            display_name = format_operator_display_plain(addr, ens_names)
            perf_data.append({
                'operator': display_name,
                'full_address': addr,
                'performance': performance,
                'validator_count': validator_count,
                'performance_category': get_performance_category(performance)
            })

    if not perf_data:
        return None, None, None

    df = pd.DataFrame(perf_data)

    df['performance_category'] = pd.Categorical(df['performance_category'],
                                              categories=['Excellent', 'Good', 'Average', 'Poor'],
                                              ordered=True)

    return df

def analyze_gas_limits_by_operator(mev_data, ens_names):
    """Analyze gas limit choices by operator"""
    if not mev_data:
        return []
    
    operator_analysis = mev_data.get('operator_analysis', {})
    gas_data = []
    
    for operator_addr, data in operator_analysis.items():
        gas_limits = data.get('gas_limits', [])
        if gas_limits:
            # Calculate gas limit statistics for this operator
            unique_limits = list(set(gas_limits))
            avg_gas = data.get('average_gas_limit', 0)
            
            # Determine operator's gas strategy
            if len(unique_limits) == 1:
                strategy = "Consistent"
                consistency_score = 100.0
            else:
                strategy = "Mixed"
                # Calculate consistency as percentage of validators using most common limit
                most_common_limit = max(set(gas_limits), key=gas_limits.count)
                consistency_score = (gas_limits.count(most_common_limit) / len(gas_limits)) * 100
            
            # Categorize gas limit approach
            max_gas = max(gas_limits)
            if max_gas >= 60000000:
                gas_category = "Ultra (60M+)"
                gas_emoji = "🔥🔥🔥🔥"
            elif max_gas >= 45000000:
                gas_category = "High (45M)"
                gas_emoji = "🔥🔥🔥"
            elif max_gas >= 36000000:
                gas_category = "Normal (36M)"
                gas_emoji = "🔥🔥"
            elif max_gas >= 30000000:
                gas_category = "Low (30M)"
                gas_emoji = "🔥"
            else:
                gas_category = "Conservative"
                gas_emoji = "❄️"
            
            # Get display name
            ens_name = ens_names.get(operator_addr, "")
            if ens_name:
                display_name = f"{ens_name} ({operator_addr[:8]}...{operator_addr[-6:]})"
            else:
                display_name = f"{operator_addr[:8]}...{operator_addr[-6:]}"
            
            gas_data.append({
                'operator': operator_addr,
                'display_name': display_name,
                'ens_name': ens_name,
                'total_validators': len(gas_limits),
                'gas_limits': gas_limits,
                'unique_limits': unique_limits,
                'average_gas_limit': avg_gas,
                'max_gas_limit': max_gas,
                'min_gas_limit': min(gas_limits),
                'strategy': strategy,
                'consistency_score': consistency_score,
                'gas_category': gas_category,
                'gas_emoji': gas_emoji
            })
    
    return sorted(gas_data, key=lambda x: x['max_gas_limit'], reverse=True)

def analyze_client_diversity(proposals_data, cache_data, ens_names):
    """Analyze client diversity from proposal graffiti data"""
    if not proposals_data or not cache_data:
        return None
    
    # Get validator to operator mapping
    validator_pubkeys = cache_data.get('validator_pubkeys', {})
    operator_validators = cache_data.get('operator_validators', {})
    
    # Reverse the mapping: validator_pubkey -> operator_address
    pubkey_to_operator = {}
    for operator, pubkeys in validator_pubkeys.items():
        for pubkey in pubkeys:
            pubkey_to_operator[pubkey] = operator
    
    # Process proposals to find latest for each operator
    operator_proposals = {}
    proposals = proposals_data.get('proposals', [])
    
    for proposal in proposals:
        validator_pubkey = proposal.get('validator_pubkey')
        timestamp = proposal.get('timestamp', 0)
        graffiti_text = proposal.get('graffiti_text', '')
        
        if not validator_pubkey or not graffiti_text:
            continue
            
        operator = pubkey_to_operator.get(validator_pubkey)
        if not operator:
            continue
            
        # Parse graffiti text - expect format like "NSNNX v1.2.1" 
        if not graffiti_text.startswith('NS') or len(graffiti_text) < 5:
            continue
            
        # Extract client codes (3rd, 4th, 5th characters)
        try:
            execution_client = graffiti_text[2]  # 3rd character
            consensus_client = graffiti_text[3]  # 4th character
            setup_type = graffiti_text[4]       # 5th character
        except IndexError:
            continue
            
        # Validate client codes
        valid_execution = execution_client in ['G', 'N', 'B', 'R']
        valid_consensus = consensus_client in ['L', 'S', 'N', 'P', 'T']
        valid_setup = setup_type in ['L', 'X']
        
        if not (valid_execution and valid_consensus and valid_setup):
            continue
            
        # Keep only the latest proposal per operator
        if operator not in operator_proposals or timestamp > operator_proposals[operator]['timestamp']:
            operator_proposals[operator] = {
                'timestamp': timestamp,
                'execution_client': execution_client,
                'consensus_client': consensus_client,
                'setup_type': setup_type,
                'graffiti_text': graffiti_text
            }
    
    if not operator_proposals:
        return None
    
    # Client mappings for display
    execution_names = {
        'G': 'Geth',
        'N': 'Nethermind', 
        'B': 'Besu',
        'R': 'Reth'
    }
    
    consensus_names = {
        'L': 'Lighthouse',
        'S': 'Lodestar',
        'N': 'Nimbus',
        'P': 'Prysm',
        'T': 'Teku'
    }
    
    setup_names = {
        'L': 'Local',
        'X': 'External'
    }
    
    # Count distributions
    execution_counts = {}
    consensus_counts = {}
    setup_counts = {}
    combination_counts = {}
    
    for operator, data in operator_proposals.items():
        exec_client = data['execution_client']
        cons_client = data['consensus_client']
        setup_type = data['setup_type']
        
        # Count individual client types
        exec_name = execution_names.get(exec_client, exec_client)
        cons_name = consensus_names.get(cons_client, cons_client)
        setup_name = setup_names.get(setup_type, setup_type)
        
        execution_counts[exec_name] = execution_counts.get(exec_name, 0) + 1
        consensus_counts[cons_name] = consensus_counts.get(cons_name, 0) + 1
        setup_counts[setup_name] = setup_counts.get(setup_name, 0) + 1
        
        # Count execution + consensus combinations (ignore setup type)
        combination = f"{exec_name} + {cons_name}"
        combination_counts[combination] = combination_counts.get(combination, 0) + 1
    
    # Calculate statistics
    total_operators = len(operator_validators) if operator_validators else 0
    operators_with_proposals = len(operator_proposals)
    
    return {
        'total_operators': total_operators,
        'operators_with_proposals': operators_with_proposals,
        'execution_counts': execution_counts,
        'consensus_counts': consensus_counts,
        'setup_counts': setup_counts,
        'combination_counts': combination_counts,
        'operator_details': operator_proposals
    }

def analyze_missed_proposals_stats(missed_proposals_data, proposals_data):
    """Analyze missed proposals statistics"""
    if not missed_proposals_data:
        return {}
    
    missed_proposals = missed_proposals_data.get('missed_proposals', [])
    if not missed_proposals:
        return {}
    
    # Count missed proposals by operator
    operator_missed_counts = Counter()
    for missed in missed_proposals:
        operator_missed_counts[missed['operator']] += 1
    
    # Get successful proposals count
    successful_proposals = proposals_data.get('metadata', {}).get('total_proposals', 0) if proposals_data else 0
    total_missed = len(missed_proposals)
    
    # Calculate overall statistics
    total_all_proposals = successful_proposals + total_missed
    overall_missed_rate = (total_missed / total_all_proposals * 100) if total_all_proposals > 0 else 0
    
    return {
        'total_missed': total_missed,
        'total_successful': successful_proposals,
        'total_all_proposals': total_all_proposals,
        'overall_missed_rate': overall_missed_rate,
        'unique_operators_with_misses': len(operator_missed_counts),
        'operator_missed_counts': dict(operator_missed_counts),
        'avg_missed_per_operator': total_missed / len(operator_missed_counts) if operator_missed_counts else 0
    }

def calculate_attestation_performance(
    validators_data: Dict[str, Any],
    proposals_data: Dict[str, Any],
    sync_committee_data: Dict[str, Any],
    validator_data: Dict[str, Any],
    exit_data: Dict[str, Any],
    days: int
) -> List[Dict[str, Any]]:
    """
    Calculate attestation-only performance analysis matching original Streamlit logic exactly.
    
    Args:
        validators_data: Validator performance data
        proposals_data: Block proposals data
        sync_committee_data: Sync committee participation data
        validator_data: Main validator data (for ENS names)
        exit_data: Exit data to exclude exited validators
        days: Analysis period (7 or 31 days)
    
    Returns:
        List of operator performance data with attestation-only metrics
    """
    if not validators_data or not validators_data.get('validators'):
        return []
    
    now = time.time()
    lookback_days = 10 if days == 7 else 34  # 10 days for 7-day analysis, 34 for 31-day
    lookback_timestamp = now - (lookback_days * 24 * 60 * 60)
    
    # Activity requirement timestamps (matching original logic)
    activity_days = 7 if days == 7 else 31  # Must be active for 7+ days for 7-day analysis, 31+ days for 31-day
    activity_timestamp = now - (activity_days * 24 * 60 * 60)
    
    print(f"Calculating {days}-day attestation performance, excluding proposals/sync from last {lookback_days} days")
    
    # Get validators with proposals in lookback window
    validators_with_proposals = set()
    if proposals_data and proposals_data.get('proposals'):
        for proposal in proposals_data['proposals']:
            proposal_timestamp = proposal.get('timestamp', 0)
            if proposal_timestamp >= lookback_timestamp:
                validator_index = proposal.get('validator_index') or proposal.get('proposer_index')
                if validator_index:
                    validators_with_proposals.add(validator_index)
    
    # Get validators with sync committee duties in lookback window (using end_slot as per original)
    validators_with_sync_duties = set()
    if sync_committee_data and sync_committee_data.get('detailed_stats'):
        GENESIS_TIME = 1606824023  # Ethereum beacon chain genesis time
        
        for stat in sync_committee_data['detailed_stats']:
            if stat.get('validator_index') and stat.get('end_slot'):
                end_timestamp = GENESIS_TIME + (stat['end_slot'] * 12)  # Genesis + slot * 12 seconds
                if end_timestamp >= lookback_timestamp:
                    validators_with_sync_duties.add(stat['validator_index'])
    
    # Get exited validators
    exited_validators = set()
    if exit_data and exit_data.get('exited_validators'):
        for exit_info in exit_data['exited_validators']:
            validator_index = exit_info.get('validator_index')
            if validator_index:
                exited_validators.add(validator_index)
    
    # Combine excluded validators (those with proposals, sync duties, or exits)
    excluded_validators = validators_with_proposals.union(validators_with_sync_duties).union(exited_validators)
    
    print(f"Found {len(validators_with_proposals)} validators with proposals, {len(validators_with_sync_duties)} with sync duties, {len(exited_validators)} exited")
    print(f"Total excluded validators: {len(excluded_validators)}")
    
    # Get ENS names from main validator data
    ens_names = {}
    if validator_data and validator_data.get('ens_names'):
        ens_names = validator_data['ens_names']
    
    # Group validators by operator and calculate attestation performance
    operator_data = {}
    validators = validators_data.get('validators', {})
    
    for validator_id, validator_info in validators.items():
        try:
            validator_index = validator_info.get('validator_index')
            operator = validator_info.get('operator')
            
            if not validator_index or not operator:
                continue
            
            # Check if validator meets activity requirements (matching frontend logic exactly)
            activation_data = validator_info.get('activation_data', {})
            activation_timestamp = activation_data.get('activation_timestamp', 0)
            if activation_timestamp and activation_timestamp > activity_timestamp:
                continue  # Validator hasn't been active long enough
            
            # Get performance data (matching frontend access pattern exactly)
            performance_metrics = validator_info.get('performance_metrics', {})
            
            # Use the appropriate period's performance data (matching frontend logic)
            if days == 7:
                performance_gwei = performance_metrics.get('performance_7d', 0) or 0
            else:  # 31 days
                performance_gwei = performance_metrics.get('performance_31d', 0) or 0
            
            # Initialize operator data if not exists
            if operator not in operator_data:
                operator_data[operator] = {
                    'operator': operator,
                    'ens_name': ens_names.get(operator, ''),
                    'total_validators': 0,
                    'attestation_validators': 0,
                    'excluded_validators': 0,
                    'regular_performances': []  # Track individual performances like frontend
                }
            
            # Count total validators for this operator
            operator_data[operator]['total_validators'] += 1
            
            # Check if validator is excluded from attestation-only analysis (matching frontend logic)
            if validator_index in excluded_validators:
                operator_data[operator]['excluded_validators'] += 1
            elif performance_gwei > 0:  # Only include validators with positive performance (matching frontend)
                # This is an attestation-only validator with positive performance
                operator_data[operator]['attestation_validators'] += 1
                operator_data[operator]['regular_performances'].append(performance_gwei)
        
        except Exception as e:
            print(f"Error processing validator {validator_id}: {e}")
            continue
    
    # Calculate final metrics and create preliminary results (matching frontend logic exactly)
    preliminary_results = []
    for operator, data in operator_data.items():
        # Only include operators with attestation-only validators with positive performance (matching frontend filter)
        if len(data['regular_performances']) == 0:
            continue
        
        # Calculate average performance excluding zero rewards (matching frontend logic)
        regular_performances = [p for p in data['regular_performances'] if p > 0]
        avg_attestation_performance = (
            sum(regular_performances) / len(regular_performances) 
            if len(regular_performances) > 0 else 0
        )
        
        preliminary_results.append({
            'operator': operator,
            'ens_name': data['ens_name'],
            'total_validators': data['total_validators'],
            'attestation_validators': data['attestation_validators'],
            'excluded_validators': data['excluded_validators'],
            'regular_performance_gwei': avg_attestation_performance,
            'avg_performance': avg_attestation_performance
        })
    
    # Sort by average performance (descending) to find highest performer
    preliminary_results.sort(key=lambda x: x['avg_performance'], reverse=True)
    
    # Calculate relative scores as percentage of highest performer (matching frontend logic)
    highest_performance = preliminary_results[0]['avg_performance'] if preliminary_results else 1
    
    results = []
    for result in preliminary_results:
        relative_score = (result['avg_performance'] / highest_performance) * 100 if highest_performance > 0 else 0
        
        results.append({
            'operator': result['operator'],
            'ens_name': result['ens_name'],
            'total_validators': result['total_validators'],
            'attestation_validators': result['attestation_validators'],
            'excluded_validators': result['excluded_validators'],
            'regular_performance_gwei': result['regular_performance_gwei'],
            'relative_score': relative_score
        })
    
    print(f"Generated {len(results)} operator records for {days}-day attestation analysis")
    
    return results