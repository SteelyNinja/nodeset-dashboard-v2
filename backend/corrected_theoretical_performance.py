#!/usr/bin/env python3
"""
Corrected Theoretical Performance Calculation

This module provides the correct way to calculate theoretical performance
that addresses the flaws in the original implementation.
"""

from services.clickhouse_service import clickhouse_service
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

def calculate_corrected_theoretical_performance(
    operator_name: str,
    start_epoch: int,
    end_epoch: int
) -> Dict[str, Any]:
    """
    Calculate corrected theoretical performance for a NodeSet operator.
    
    The corrected calculation addresses these issues from the original:
    1. Includes penalties in the performance calculation
    2. Properly handles missing data points (validators not active for full period)
    3. Distinguishes between pending validators and actual performance issues
    4. Uses net rewards (actual - penalties) vs theoretical maximum
    
    Args:
        operator_name: The NodeSet operator name
        start_epoch: Start epoch for the calculation period
        end_epoch: End epoch for the calculation period
        
    Returns:
        Dictionary containing corrected performance metrics
    """
    try:
        # Get comprehensive data for the operator
        query = f"""
        WITH validator_data AS (
            SELECT 
                val_id,
                val_nos_name,
                epoch,
                val_status,
                att_happened,
                att_earned_reward,
                att_missed_reward,
                att_penalty,
                -- Flag active duty periods
                CASE WHEN val_status = 'active_ongoing' THEN 1 ELSE 0 END as is_active_duty,
                -- Flag pending periods
                CASE WHEN val_status IN ('pending_initialized', 'pending_queued') THEN 1 ELSE 0 END as is_pending,
                -- Flag successful attestations
                CASE WHEN val_status = 'active_ongoing' AND att_happened = 1 THEN 1 ELSE 0 END as successful_attestation,
                -- Flag missed attestations (active but no attestation)
                -- IMPORTANT: Only count as missed if validator was active (not pending)
                CASE WHEN val_status = 'active_ongoing' AND (att_happened = 0 OR att_happened IS NULL) THEN 1 ELSE 0 END as missed_attestation
            FROM validators_summary
            WHERE epoch >= {start_epoch}
            AND epoch <= {end_epoch}
            AND val_nos_name = '{operator_name}'
            AND val_status NOT IN ('exited', 'withdrawal_possible', 'withdrawal_done')
        ),
        aggregated_data AS (
            SELECT 
                val_nos_name,
                COUNT(DISTINCT val_id) as validator_count,
                -- Count duty periods and attestations
                SUM(is_active_duty) as active_duty_periods,
                SUM(successful_attestation) as successful_attestations,
                SUM(missed_attestation) as missed_attestations,
                SUM(is_pending) as pending_periods,
                -- Sum rewards and penalties for active periods only
                SUM(CASE WHEN is_active_duty = 1 THEN COALESCE(att_earned_reward, 0) ELSE 0 END) as total_actual_rewards,
                SUM(CASE WHEN is_active_duty = 1 THEN COALESCE(att_penalty, 0) ELSE 0 END) as total_penalties,
                -- Calculate average reward per successful attestation
                AVG(CASE WHEN successful_attestation = 1 AND att_earned_reward IS NOT NULL THEN att_earned_reward END) as avg_reward_per_attestation,
                -- Calculate validator coverage
                COUNT(*) as total_data_points,
                ({end_epoch} - {start_epoch} + 1) as epochs_in_period
            FROM validator_data
            GROUP BY val_nos_name
        )
        SELECT 
            val_nos_name,
            validator_count,
            active_duty_periods,
            successful_attestations,
            missed_attestations,
            pending_periods,
            total_actual_rewards,
            total_penalties,
            avg_reward_per_attestation,
            total_data_points,
            epochs_in_period,
            -- Calculate expected total epochs for all validators
            (validator_count * epochs_in_period) as expected_total_epochs
        FROM aggregated_data
        """
        
        raw_data = clickhouse_service.execute_query(query)
        
        if not raw_data or len(raw_data) == 0:
            return {
                "error": "No data found for operator",
                "operator": operator_name,
                "start_epoch": start_epoch,
                "end_epoch": end_epoch
            }
        
        row = raw_data[0]
        
        # Extract the data
        operator = row[0]
        validator_count = int(row[1])
        active_duty_periods = int(row[2])
        successful_attestations = int(row[3])
        missed_attestations = int(row[4])
        pending_periods = int(row[5])
        total_actual_rewards = int(row[6])
        total_penalties = int(row[7])
        avg_reward_per_attestation = float(row[8]) if row[8] else 0.0
        total_data_points = int(row[9])
        epochs_in_period = int(row[10])
        expected_total_epochs = int(row[11])
        
        # Calculate corrected metrics
        net_rewards = total_actual_rewards - total_penalties
        max_possible_rewards = active_duty_periods * avg_reward_per_attestation
        
        # Corrected theoretical performance
        corrected_performance = (net_rewards / max_possible_rewards * 100) if max_possible_rewards > 0 else 0.0
        
        # Attestation success rate for active periods
        attestation_success_rate = (successful_attestations / active_duty_periods * 100) if active_duty_periods > 0 else 0.0
        
        # Data coverage
        data_coverage = (total_data_points / expected_total_epochs * 100) if expected_total_epochs > 0 else 0.0
        
        # Missing data points
        missing_data_points = expected_total_epochs - total_data_points
        
        return {
            "operator": operator,
            "validator_count": validator_count,
            "epochs_analyzed": epochs_in_period,
            "start_epoch": start_epoch,
            "end_epoch": end_epoch,
            
            # Performance metrics
            "corrected_theoretical_performance": round(corrected_performance, 3),
            "attestation_success_rate": round(attestation_success_rate, 3),
            "data_coverage_percentage": round(data_coverage, 3),
            
            # Detailed counts
            "active_duty_periods": active_duty_periods,
            "successful_attestations": successful_attestations,
            "missed_attestations": missed_attestations,
            "pending_periods": pending_periods,
            "missing_data_points": missing_data_points,
            
            # Financial metrics
            "total_actual_rewards": total_actual_rewards,
            "total_penalties": total_penalties,
            "net_rewards": net_rewards,
            "max_possible_rewards": int(max_possible_rewards),
            "avg_reward_per_attestation": round(avg_reward_per_attestation, 2),
            
            # Validation
            "expected_total_epochs": expected_total_epochs,
            "total_data_points": total_data_points,
            
            # Comparison with original flawed calculation
            "original_flawed_percentage": (total_actual_rewards / (total_actual_rewards + (max_possible_rewards - total_actual_rewards)) * 100) if max_possible_rewards > 0 else 0.0,
            "improvement_vs_original": round(corrected_performance - 99.812, 3) if max_possible_rewards > 0 else 0.0
        }
        
    except Exception as e:
        logger.error(f"Failed to calculate corrected theoretical performance: {e}")
        return {
            "error": f"Calculation failed: {str(e)}",
            "operator": operator_name,
            "start_epoch": start_epoch,
            "end_epoch": end_epoch
        }


def test_corrected_calculation():
    """Test the corrected calculation on the example operator."""
    
    # Get the latest epoch
    epoch_query = "SELECT MAX(epoch) FROM validators_summary WHERE val_nos_name IS NOT NULL"
    epoch_data = clickhouse_service.execute_query(epoch_query)
    latest_epoch = int(epoch_data[0][0])
    start_epoch = latest_epoch - 224  # 225 epochs total (1 day)
    
    # Test on the example operator
    operator_name = "Operator_0x04CEcFA05C7539249A3D7AF65A78471eE6399cbb"
    
    result = calculate_corrected_theoretical_performance(
        operator_name=operator_name,
        start_epoch=start_epoch,
        end_epoch=latest_epoch
    )
    
    print("=== CORRECTED THEORETICAL PERFORMANCE TEST ===")
    print(f"Operator: {result['operator']}")
    print(f"Validator Count: {result['validator_count']}")
    print(f"Epochs Analyzed: {result['epochs_analyzed']}")
    print()
    
    print("=== PERFORMANCE METRICS ===")
    print(f"Corrected Theoretical Performance: {result['corrected_theoretical_performance']:.3f}%")
    print(f"Attestation Success Rate: {result['attestation_success_rate']:.3f}%")
    print(f"Data Coverage: {result['data_coverage_percentage']:.3f}%")
    print()
    
    print("=== DETAILED COUNTS ===")
    print(f"Active Duty Periods: {result['active_duty_periods']}")
    print(f"Successful Attestations: {result['successful_attestations']}")
    print(f"Missed Attestations: {result['missed_attestations']}")
    print(f"Pending Periods: {result['pending_periods']}")
    print(f"Missing Data Points: {result['missing_data_points']}")
    print()
    
    print("=== FINANCIAL METRICS ===")
    print(f"Total Actual Rewards: {result['total_actual_rewards']:,}")
    print(f"Total Penalties: {result['total_penalties']:,}")
    print(f"Net Rewards: {result['net_rewards']:,}")
    print(f"Max Possible Rewards: {result['max_possible_rewards']:,}")
    print(f"Average Reward per Attestation: {result['avg_reward_per_attestation']:.2f}")
    print()
    
    print("=== COMPARISON ===")
    print(f"Original Flawed Calculation: 99.812%")
    print(f"Corrected Calculation: {result['corrected_theoretical_performance']:.3f}%")
    print(f"Difference: {result['improvement_vs_original']:.3f} percentage points")
    
    return result


if __name__ == "__main__":
    test_corrected_calculation()