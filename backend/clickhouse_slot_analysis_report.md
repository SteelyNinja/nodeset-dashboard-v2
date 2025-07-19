# ClickHouse Database Slot-Level Data Analysis Report

## Executive Summary

This report analyzes the ClickHouse database to understand what slot-level data is available for implementing the beacon chain specification's proposal efficiency calculation, which uses surrounding 32 proposals (16 before and 16 after) to determine expected proposal success rates.

## Database Structure Overview

### Available Tables
1. **validators_summary** - Main table containing validator performance data (1.2B+ rows)
2. **epochs_metadata** - Epoch-level metadata with slot ranges and rewards
3. **epochs_processing** - Processing status tracking
4. **validators_index** - Validator ID to public key mapping

### Key Findings

#### ✅ Slot-Level Data is Available
- **Primary source**: `validators_summary` table
- **Slot identifier**: `block_to_propose` field (Int64)
- **Proposal status**: `block_proposed` field (UInt8: 0=failed, 1=success)
- **Operator identification**: `val_nos_name` field for NodeSet operators

#### ✅ Data Quality and Continuity
- **Data completeness**: 100% for recent epochs
- **Slot continuity**: Perfect (1.0 ratio) for last 1000 slots tested
- **Epoch structure**: 32 slots per epoch consistently
- **NodeSet coverage**: 19+ unique operators identified

#### ✅ Beacon Chain Spec Implementation Feasibility
- **Surrounding proposals**: Can query ±16 slots around any proposal
- **Success rate calculation**: Available via `block_proposed` field
- **Historical data**: Sufficient depth for analysis
- **Performance**: Indexed queries perform well

## Database Schema Details

### validators_summary Table (Primary Data Source)
```sql
-- Key columns for proposal efficiency calculation
epoch                 Int64                 -- Epoch number
val_id               Int64                 -- Validator index
val_nos_name         Nullable(String)      -- NodeSet operator name
is_proposer          UInt8                 -- 1 if validator was assigned to propose
block_to_propose     Nullable(Int64)       -- Slot number to propose in
block_proposed       Nullable(UInt8)       -- 1 if block was successfully proposed
propose_earned_reward Nullable(UInt64)     -- Rewards earned from proposal
propose_missed_reward Nullable(UInt64)     -- Rewards missed from failed proposal
propose_penalty      Nullable(UInt64)      -- Penalties from failed proposal
```

### epochs_metadata Table (Supplementary Data)
```sql
-- Contains slot-level reward data per epoch
epoch                Int64                 -- Epoch number
att_blocks_rewards   Array(Array(Int64))   -- [slot, reward] pairs for attestations
sync_blocks_rewards  Array(Array(Int64))   -- [slot, reward] pairs for sync committee
sync_blocks_to_sync  Array(Int64)          -- Slots requiring sync committee participation
```

## Implementation Recommendations

### 1. Beacon Chain Specification Implementation
**Recommended SQL Pattern:**
```sql
-- Get surrounding proposals for efficiency calculation
SELECT 
    block_to_propose,
    block_proposed,
    val_nos_name,
    propose_earned_reward
FROM validators_summary
WHERE is_proposer = 1
  AND block_to_propose IS NOT NULL
  AND block_to_propose BETWEEN {target_slot - 16} AND {target_slot + 16}
  AND block_to_propose != {target_slot}
ORDER BY block_to_propose;
```

### 2. Efficiency Calculation Logic
```python
def calculate_proposal_efficiency(target_slot):
    # Get surrounding 32 proposals (16 before, 16 after)
    surrounding_proposals = query_surrounding_slots(target_slot, 16)
    
    # Calculate success rate in surrounding slots
    successful = sum(1 for p in surrounding_proposals if p.block_proposed == 1)
    total = len(surrounding_proposals)
    
    # Beacon chain spec efficiency = surrounding success rate
    efficiency = (successful / total) * 100 if total > 0 else 0
    
    return efficiency
```

### 3. API Endpoint Structure
```python
def get_proposal_efficiency(operator: str, start_epoch: int, end_epoch: int):
    """
    Calculate beacon chain spec proposal efficiency for NodeSet operators
    """
    # Get all proposals for the operator in the epoch range
    proposals = get_operator_proposals(operator, start_epoch, end_epoch)
    
    efficiency_data = []
    for proposal in proposals:
        # Calculate efficiency using surrounding 32 proposals
        efficiency = calculate_proposal_efficiency(proposal.block_to_propose)
        
        efficiency_data.append({
            'slot': proposal.block_to_propose,
            'epoch': proposal.epoch,
            'validator_id': proposal.val_id,
            'proposed': proposal.block_proposed == 1,
            'surrounding_efficiency': efficiency,
            'rewards': proposal.propose_earned_reward or 0
        })
    
    return efficiency_data
```

## Data Availability Analysis

### Recent Data Quality (Last 10 Epochs)
- **Proposer assignments**: 32 per epoch (100% coverage)
- **Slot data availability**: 32/32 slots with data (100% coverage)
- **Proposal status data**: 32/32 with success/failure status (100% coverage)
- **Slot range per epoch**: Consistently 32 slots (12109344-12109663 range tested)

### Historical Data Depth
- **Total records**: 1.2B+ rows in validators_summary
- **Epoch coverage**: 612 epochs in epochs_metadata
- **Validator coverage**: 4M+ validators in validators_index
- **NodeSet operators**: 19+ unique operators identified

## Testing Results

### Test Case: Slot 12109420 Analysis
- **Surrounding slots found**: 32 (16 before + 16 after)
- **Success rate**: 100% (32/32 proposals successful)
- **Data completeness**: Perfect (no missing slots)
- **Calculation feasibility**: ✅ Confirmed

### Multi-Operator Testing
- **Operators tested**: 19 NodeSet operators
- **Recent proposals**: 20 proposals analyzed
- **Success rates**: 100% across all operators (recent data)
- **Data consistency**: ✅ Confirmed

## Performance Considerations

### Query Performance
- **Slot range queries**: Efficient with proper indexing
- **Surrounding slot lookups**: Fast execution (<1 second)
- **Operator filtering**: Well-optimized with val_nos_name index

### Caching Recommendations
- **Result caching**: Recommend 15-minute TTL for efficiency calculations
- **Surrounding data caching**: Cache surrounding slot data to avoid repeated queries
- **Operator-specific caching**: Cache per-operator results separately

## Edge Cases and Handling

### 1. Insufficient Surrounding Data
- **Problem**: Less than 16 surrounding slots available
- **Solution**: Use available data with minimum threshold (e.g., 8 slots)
- **Fallback**: Use epoch-level statistics if insufficient slot data

### 2. Missing Proposal Data
- **Problem**: block_proposed field is NULL
- **Solution**: Treat as failed proposal (0 value)
- **Logging**: Track occurrences for monitoring

### 3. Slot Gaps
- **Problem**: Missing slots in sequence
- **Solution**: Use available slots, note gaps in calculation
- **Current status**: No gaps detected in recent data

## Conclusion

The ClickHouse database contains comprehensive slot-level data that fully supports implementing the beacon chain specification's proposal efficiency calculation. The data quality is excellent, with 100% completeness for recent epochs and perfect slot continuity.

**Key Strengths:**
- Complete slot-level proposal data
- High data quality and continuity
- Efficient query performance
- Comprehensive NodeSet operator coverage

**Implementation Status:** ✅ **READY TO IMPLEMENT**

The database provides all necessary data to implement the beacon chain specification's proposal efficiency calculation using surrounding 32 proposals (16 before, 16 after) methodology.