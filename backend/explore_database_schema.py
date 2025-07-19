#!/usr/bin/env python3
"""
Script to explore ClickHouse database schema and identify slot-level data
for implementing beacon chain specification's proposal efficiency calculation.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.clickhouse_service import clickhouse_service
import json

def explore_database_schema():
    """Explore the ClickHouse database schema to understand available data"""
    
    if not clickhouse_service.is_available():
        print("ClickHouse is not available or not enabled")
        return
    
    print("=== ClickHouse Database Schema Exploration ===\n")
    
    # 1. Check available tables
    print("1. Available tables:")
    try:
        tables_query = "SHOW TABLES"
        tables = clickhouse_service.execute_query(tables_query)
        for table in tables:
            print(f"   - {table[0]}")
    except Exception as e:
        print(f"   Error getting tables: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 2. Get detailed schema for validators_summary table
    print("2. Schema for validators_summary table:")
    try:
        schema_query = "DESCRIBE validators_summary"
        schema = clickhouse_service.execute_query(schema_query)
        print(f"   Found {len(schema)} columns:")
        for col in schema:
            print(f"   - {col[0]:<25} {col[1]:<20} {col[2] if len(col) > 2 else ''}")
    except Exception as e:
        print(f"   Error getting schema: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 3. Look for slot-related fields in validators_summary
    print("3. Slot-related fields in validators_summary:")
    try:
        sample_query = """
        SELECT 
            epoch,
            val_id,
            is_proposer,
            block_to_propose,
            block_proposed,
            propose_earned_reward,
            propose_missed_reward,
            propose_penalty
        FROM validators_summary 
        WHERE is_proposer = 1 
        ORDER BY epoch DESC 
        LIMIT 10
        """
        
        sample_data = clickhouse_service.execute_query(sample_query)
        print(f"   Found {len(sample_data)} recent proposer records:")
        print("   epoch | val_id | is_proposer | block_to_propose | block_proposed | rewards | missed | penalty")
        print("   " + "-"*85)
        
        for row in sample_data:
            print(f"   {row[0]:<5} | {row[1]:<6} | {row[2]:<11} | {row[3]:<16} | {row[4]:<14} | {row[5]:<7} | {row[6]:<6} | {row[7]}")
    except Exception as e:
        print(f"   Error getting sample data: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 4. Check if there are any other tables with slot-level data
    print("4. Exploring other tables for slot-level data:")
    try:
        # Check if there are any tables with 'slot' in the name
        slot_tables_query = "SHOW TABLES LIKE '%slot%'"
        slot_tables = clickhouse_service.execute_query(slot_tables_query)
        
        if slot_tables:
            print("   Tables containing 'slot':")
            for table in slot_tables:
                print(f"   - {table[0]}")
        else:
            print("   No tables found with 'slot' in the name")
        
        # Check if there are any tables with 'block' in the name
        block_tables_query = "SHOW TABLES LIKE '%block%'"
        block_tables = clickhouse_service.execute_query(block_tables_query)
        
        if block_tables:
            print("   Tables containing 'block':")
            for table in block_tables:
                print(f"   - {table[0]}")
        else:
            print("   No tables found with 'block' in the name")
        
        # Check if there are any tables with 'proposal' in the name
        proposal_tables_query = "SHOW TABLES LIKE '%proposal%'"
        proposal_tables = clickhouse_service.execute_query(proposal_tables_query)
        
        if proposal_tables:
            print("   Tables containing 'proposal':")
            for table in proposal_tables:
                print(f"   - {table[0]}")
        else:
            print("   No tables found with 'proposal' in the name")
            
    except Exception as e:
        print(f"   Error exploring other tables: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 5. Check epoch to slot relationship
    print("5. Understanding epoch to slot relationship:")
    try:
        # Get some sample epochs and their corresponding block_to_propose values
        epoch_slot_query = """
        SELECT 
            epoch,
            MIN(block_to_propose) as min_slot,
            MAX(block_to_propose) as max_slot,
            COUNT(DISTINCT block_to_propose) as unique_slots,
            COUNT(*) as total_proposers
        FROM validators_summary 
        WHERE is_proposer = 1 AND block_to_propose IS NOT NULL AND block_to_propose > 0
        GROUP BY epoch 
        ORDER BY epoch DESC 
        LIMIT 10
        """
        
        epoch_data = clickhouse_service.execute_query(epoch_slot_query)
        print("   Epoch to slot mapping (recent epochs):")
        print("   epoch | min_slot | max_slot | unique_slots | total_proposers")
        print("   " + "-"*65)
        
        for row in epoch_data:
            print(f"   {row[0]:<5} | {row[1]:<8} | {row[2]:<8} | {row[3]:<12} | {row[4]}")
            
        # Calculate slots per epoch
        if len(epoch_data) > 1:
            first_epoch = int(epoch_data[0][0])
            first_min_slot = int(epoch_data[0][1])
            second_epoch = int(epoch_data[1][0])
            second_min_slot = int(epoch_data[1][1])
            
            if first_epoch > second_epoch:
                slots_per_epoch = first_min_slot - second_min_slot
                print(f"\n   Estimated slots per epoch: {slots_per_epoch}")
            
    except Exception as e:
        print(f"   Error analyzing epoch-slot relationship: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 6. Check for continuous slot data availability
    print("6. Analyzing slot data continuity:")
    try:
        # Check if we have continuous slot data by looking at gaps
        continuity_query = """
        WITH slot_data AS (
            SELECT DISTINCT block_to_propose as slot
            FROM validators_summary 
            WHERE is_proposer = 1 AND block_to_propose IS NOT NULL AND block_to_propose > 0
            ORDER BY block_to_propose DESC
            LIMIT 1000
        )
        SELECT 
            MIN(slot) as min_slot,
            MAX(slot) as max_slot,
            COUNT(*) as available_slots,
            (MAX(slot) - MIN(slot) + 1) as expected_slots,
            COUNT(*) / (MAX(slot) - MIN(slot) + 1) as continuity_ratio
        FROM slot_data
        """
        
        continuity_data = clickhouse_service.execute_query(continuity_query)
        if continuity_data and len(continuity_data[0]) >= 5:
            row = continuity_data[0]
            print(f"   Recent slot range: {row[0]} to {row[1]}")
            print(f"   Available slots: {row[2]}")
            print(f"   Expected slots: {row[3]}")
            print(f"   Continuity ratio: {float(row[4]):.4f}")
            
            if float(row[4]) > 0.95:
                print("   ✓ High continuity - suitable for 16 before/after calculation")
            elif float(row[4]) > 0.8:
                print("   ⚠ Moderate continuity - may have some gaps")
            else:
                print("   ✗ Low continuity - significant gaps in slot data")
        
    except Exception as e:
        print(f"   Error analyzing continuity: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 7. Check for additional slot-level information
    print("7. Additional slot-level information:")
    try:
        # Look for any columns that might contain slot information
        additional_info_query = """
        SELECT 
            epoch,
            val_id,
            val_nos_name,
            is_proposer,
            block_to_propose,
            block_proposed,
            propose_earned_reward,
            propose_missed_reward,
            propose_penalty,
            att_inc_delay,
            val_status
        FROM validators_summary 
        WHERE val_nos_name IS NOT NULL AND is_proposer = 1
        ORDER BY epoch DESC, block_to_propose DESC
        LIMIT 5
        """
        
        additional_data = clickhouse_service.execute_query(additional_info_query)
        print(f"   Sample NodeSet proposer records ({len(additional_data)} records):")
        
        for i, row in enumerate(additional_data):
            print(f"   Record {i+1}:")
            print(f"     Epoch: {row[0]}, Validator: {row[1]}, Operator: {row[2]}")
            print(f"     Slot to propose: {row[4]}, Proposed: {row[5]}")
            print(f"     Rewards: {row[6]}, Missed: {row[7]}, Penalty: {row[8]}")
            print(f"     Status: {row[10]}")
            print()
    
    except Exception as e:
        print(f"   Error getting additional info: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 8. Summary and recommendations
    print("8. Summary and Recommendations:")
    print("   Based on the database exploration:")
    print("   - The validators_summary table contains proposal data at epoch level")
    print("   - block_to_propose field contains the slot number for proposals")
    print("   - Data includes proposal status (block_proposed) and rewards/penalties")
    print("   - For beacon chain spec proposal efficiency (16 before/16 after):")
    print("     * Need to query slots around each proposal slot")
    print("     * Check if slot data is continuous enough for this calculation")
    print("     * May need to handle gaps in slot data gracefully")
    print("   - Recommendation: Implement slot-based queries using block_to_propose")
    print("     as the slot identifier, with fallback handling for missing slots")

if __name__ == "__main__":
    explore_database_schema()