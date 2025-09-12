#!/usr/bin/env python3
"""
ClickHouse HTTP client service for Ethereum validator data
"""
import aiohttp
import asyncio
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import quote
from config import settings

logger = logging.getLogger(__name__)

class ClickHouseService:
    """Async HTTP client for ClickHouse database"""
    
    def __init__(self):
        self.base_url = settings.clickhouse_url
        self.timeout = settings.CLICKHOUSE_TIMEOUT
        self.enabled = settings.CLICKHOUSE_ENABLED
        self._session = None
        self._connector = None
        
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with connection pooling"""
        if self._session is None or self._session.closed:
            if self._connector is None:
                self._connector = aiohttp.TCPConnector(
                    limit=100,  # Total connection pool size
                    limit_per_host=30,  # Per-host connection limit
                    ttl_dns_cache=300,  # DNS cache TTL
                    use_dns_cache=True,
                    enable_cleanup_closed=True
                )
            
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(
                connector=self._connector,
                timeout=timeout
            )
        return self._session
    
    async def close(self):
        """Close the aiohttp session and connector"""
        if self._session and not self._session.closed:
            await self._session.close()
        if self._connector:
            await self._connector.close()
    
    async def is_available(self) -> bool:
        """Check if ClickHouse is available"""
        if not self.enabled:
            return False
            
        try:
            session = await self.get_session()
            async with session.get(
                f"{self.base_url}/",
                params={'query': 'SELECT 1'},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                return response.status == 200
        except Exception:
            return False
    
    async def execute_query(self, query: str) -> List[List[str]]:
        """Execute ClickHouse query via HTTP interface"""
        if not self.enabled:
            logger.warning("ClickHouse is disabled")
            return []
            
        try:
            logger.debug(f"Executing query: {query[:100]}...")
            
            session = await self.get_session()
            async with session.get(
                f"{self.base_url}/",
                params={'query': query}
            ) as response:
                response.raise_for_status()
                text = await response.text()
                
                # Parse TSV response (ClickHouse default)
                return self._parse_tsv_response(text)
            
        except aiohttp.ClientError as e:
            logger.error(f"ClickHouse query failed: {e}")
            raise
        except asyncio.TimeoutError as e:
            logger.error(f"ClickHouse query timeout: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in ClickHouse query: {e}")
            raise
    
    def _parse_tsv_response(self, tsv_data: str) -> List[List[str]]:
        """Parse TSV response into list of lists"""
        lines = tsv_data.strip().split('\n')
        if not lines or lines == ['']:
            return []
            
        data = []
        for line in lines:
            if line.strip():
                values = line.split('\t')
                data.append(values)
        
        return data
    
    async def get_epoch_range(self) -> Dict[str, int]:
        """Get the available epoch range in the database"""
        query = "SELECT MIN(epoch), MAX(epoch), COUNT(DISTINCT epoch) FROM validators_summary"
        
        try:
            raw_data = await self.execute_query(query)
            if raw_data and len(raw_data[0]) >= 3:
                return {
                    'min_epoch': int(raw_data[0][0]),
                    'max_epoch': int(raw_data[0][1]),
                    'total_epochs': int(raw_data[0][2])
                }
            return {'min_epoch': 0, 'max_epoch': 0, 'total_epochs': 0}
        except Exception as e:
            logger.error(f"Failed to get epoch range: {e}")
            raise

    async def get_validator_accuracy(self, 
                             start_epoch: Optional[int] = None, 
                             end_epoch: Optional[int] = None,
                             operator: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get validator accuracy metrics by operator with optional epoch filtering"""
        
        # Build WHERE clause with filters
        where_conditions = ["val_nos_name IS NOT NULL", 
                          "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"]
        
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
        if operator:
            where_conditions.append(f"val_nos_name = '{operator}'")
            
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            val_nos_name,
            COUNT(*) as total_attestations,
            COUNT(DISTINCT epoch) as epochs_covered,
            COUNT(DISTINCT val_id) as validator_count,
            
            -- Overall accuracy percentages
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            
            -- Failure counts
            SUM(CASE WHEN att_valid_head = 0 THEN 1 ELSE 0 END) as invalid_heads,
            SUM(CASE WHEN att_valid_target = 0 THEN 1 ELSE 0 END) as invalid_targets,
            SUM(CASE WHEN att_valid_source = 0 THEN 1 ELSE 0 END) as invalid_sources,
            
            -- Attestation participation
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            
            -- Inclusion delay stats
            AVG(CASE WHEN att_inc_delay IS NOT NULL THEN att_inc_delay ELSE NULL END) as avg_inclusion_delay,
            
            -- Rewards/penalties
            SUM(COALESCE(att_earned_reward, 0)) as total_earned_rewards,
            SUM(COALESCE(att_missed_reward, 0)) as total_missed_rewards,
            SUM(COALESCE(att_penalty, 0)) as total_penalties
            
        FROM validators_summary 
        WHERE {where_clause}
        GROUP BY val_nos_name 
        ORDER BY head_accuracy ASC
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            # Helper functions for safe conversion
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            # Transform to structured format
            results = []
            for row in raw_data:
                if len(row) >= 16:  # Ensure we have all expected columns
                    results.append({
                        'operator': row[0],
                        'total_attestations': safe_int(row[1]),
                        'epochs_covered': safe_int(row[2]),
                        'validator_count': safe_int(row[3]),
                        'head_accuracy': safe_float(row[4]),
                        'target_accuracy': safe_float(row[5]),
                        'source_accuracy': safe_float(row[6]),
                        'invalid_heads': safe_int(row[7]),
                        'invalid_targets': safe_int(row[8]),
                        'invalid_sources': safe_int(row[9]),
                        'attestations_made': safe_int(row[10]),
                        'attestations_missed': safe_int(row[11]),
                        'participation_rate': safe_float(row[12]),
                        'avg_inclusion_delay': safe_float(row[13]),
                        'total_earned_rewards': safe_int(row[14]),
                        'total_missed_rewards': safe_int(row[15]),
                        'total_penalties': safe_int(row[16]) if len(row) > 16 else 0
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get validator accuracy: {e}")
            raise
    
    async def get_operator_performance(self, operator: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get detailed operator performance metrics"""
        where_clause = f"AND val_nos_name = '{operator}'" if operator else ""
        
        query = f"""
        SELECT 
            val_nos_name,
            val_id,
            att_valid_head,
            att_valid_target,
            att_valid_source,
            epoch
        FROM validators_summary 
        WHERE val_nos_name IS NOT NULL 
        AND val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done') {where_clause}
        ORDER BY epoch DESC, val_id DESC
        LIMIT 1000
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            # Helper functions for safe conversion
            def safe_int(value):
                return int(value) if value != '\\N' else 0
            
            def safe_bool(value):
                return bool(int(value)) if value != '\\N' else False
            
            results = []
            for row in raw_data:
                if len(row) >= 6:
                    results.append({
                        'operator': row[0],
                        'validator_index': safe_int(row[1]),
                        'head_valid': safe_bool(row[2]),
                        'target_valid': safe_bool(row[3]),
                        'source_valid': safe_bool(row[4]),
                        'epoch': safe_int(row[5])
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get operator performance: {e}")
            raise
    
    async def get_nodeset_epoch_summary(self, epoch: int) -> Dict[str, Any]:
        """Get summary statistics for NodeSet validators only in a specific epoch"""
        query = f"""
        SELECT 
            epoch,
            COUNT(*) as total_validators,
            COUNT(DISTINCT val_nos_name) as total_operators,
            
            -- Attestation stats
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            
            -- Accuracy stats
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            
            -- Proposer stats
            SUM(is_proposer) as total_proposers,
            SUM(CASE WHEN block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
            SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as blocks_missed,
            
            -- Sync committee stats
            SUM(is_sync) as sync_committee_validators,
            AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance,
            
            -- Rewards
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(propose_earned_reward, 0) + COALESCE(sync_earned_reward, 0)) as total_rewards,
            SUM(COALESCE(att_penalty, 0) + COALESCE(propose_penalty, 0) + COALESCE(sync_penalty, 0)) as total_penalties
            
        FROM validators_summary 
        WHERE epoch = {epoch} AND val_nos_name IS NOT NULL
        AND val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')
        GROUP BY epoch
        """
        
        try:
            raw_data = await self.execute_query(query)
            if raw_data and len(raw_data[0]) >= 15:
                def safe_float(value):
                    return float(value) if value not in ['\\N', None, ''] else 0.0
                
                def safe_int(value):
                    return int(value) if value not in ['\\N', None, ''] else 0
                
                row = raw_data[0]
                return {
                    'epoch': safe_int(row[0]),
                    'total_validators': safe_int(row[1]),
                    'total_operators': safe_int(row[2]),
                    'attestations_made': safe_int(row[3]),
                    'attestations_missed': safe_int(row[4]),
                    'participation_rate': safe_float(row[5]),
                    'head_accuracy': safe_float(row[6]),
                    'target_accuracy': safe_float(row[7]),
                    'source_accuracy': safe_float(row[8]),
                    'total_proposers': safe_int(row[9]),
                    'blocks_proposed': safe_int(row[10]),
                    'blocks_missed': safe_int(row[11]),
                    'sync_committee_validators': safe_int(row[12]),
                    'avg_sync_performance': safe_float(row[13]),
                    'total_rewards': safe_int(row[14]),
                    'total_penalties': safe_int(row[15]) if len(row) > 15 else 0
                }
            return {}
        except Exception as e:
            logger.error(f"Failed to get NodeSet epoch summary: {e}")
            raise

    async def get_epoch_summary(self, epoch: int) -> Dict[str, Any]:
        """Get summary statistics for a specific epoch"""
        query = f"""
        SELECT 
            epoch,
            COUNT(*) as total_validators,
            COUNT(DISTINCT val_nos_name) as total_operators,
            
            -- Attestation stats
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            
            -- Accuracy stats
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            
            -- Proposer stats
            SUM(is_proposer) as total_proposers,
            SUM(CASE WHEN block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
            SUM(CASE WHEN block_proposed = 0 OR block_proposed IS NULL THEN 1 ELSE 0 END) as blocks_missed,
            
            -- Sync committee stats
            SUM(is_sync) as sync_committee_validators,
            AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance,
            
            -- Rewards
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(propose_earned_reward, 0) + COALESCE(sync_earned_reward, 0)) as total_rewards,
            SUM(COALESCE(att_penalty, 0) + COALESCE(propose_penalty, 0) + COALESCE(sync_penalty, 0)) as total_penalties
            
        FROM validators_summary 
        WHERE epoch = {epoch}
        GROUP BY epoch
        """
        
        try:
            raw_data = await self.execute_query(query)
            if raw_data and len(raw_data[0]) >= 15:
                def safe_float(value):
                    return float(value) if value not in ['\\N', None, ''] else 0.0
                
                def safe_int(value):
                    return int(value) if value not in ['\\N', None, ''] else 0
                
                row = raw_data[0]
                return {
                    'epoch': safe_int(row[0]),
                    'total_validators': safe_int(row[1]),
                    'total_operators': safe_int(row[2]),
                    'attestations_made': safe_int(row[3]),
                    'attestations_missed': safe_int(row[4]),
                    'participation_rate': safe_float(row[5]),
                    'head_accuracy': safe_float(row[6]),
                    'target_accuracy': safe_float(row[7]),
                    'source_accuracy': safe_float(row[8]),
                    'total_proposers': safe_int(row[9]),
                    'blocks_proposed': safe_int(row[10]),
                    'blocks_missed': safe_int(row[11]),
                    'sync_committee_validators': safe_int(row[12]),
                    'avg_sync_performance': safe_float(row[13]),
                    'total_rewards': safe_int(row[14]),
                    'total_penalties': safe_int(row[15]) if len(row) > 15 else 0
                }
            return {}
        except Exception as e:
            logger.error(f"Failed to get epoch summary: {e}")
            raise
    
    async def get_validator_details(self, 
                            validator_id: Optional[int] = None,
                            start_epoch: Optional[int] = None,
                            end_epoch: Optional[int] = None,
                            limit: int = 1000) -> List[Dict[str, Any]]:
        """Get detailed validator performance data"""
        
        where_conditions = []
        if validator_id is not None:
            where_conditions.append(f"val_id = {validator_id}")
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
            
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        query = f"""
        SELECT 
            epoch,
            val_id,
            val_nos_name,
            val_status,
            val_balance,
            val_effective_balance,
            
            -- Attestation details
            att_happened,
            att_inc_delay,
            att_valid_head,
            att_valid_target,
            att_valid_source,
            att_earned_reward,
            att_missed_reward,
            att_penalty,
            
            -- Proposer details
            is_proposer,
            block_to_propose,
            block_proposed,
            propose_earned_reward,
            propose_missed_reward,
            propose_penalty,
            
            -- Sync committee details
            is_sync,
            sync_percent,
            sync_earned_reward,
            sync_missed_reward,
            sync_penalty
            
        FROM validators_summary 
        WHERE {where_clause}
        ORDER BY epoch DESC, val_id ASC
        LIMIT {limit}
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            def safe_bool(value):
                return bool(safe_int(value))
            
            results = []
            for row in raw_data:
                if len(row) >= 25:
                    results.append({
                        'epoch': safe_int(row[0]),
                        'validator_id': safe_int(row[1]),
                        'operator': row[2] if row[2] != '\\N' else None,
                        'status': row[3] if row[3] != '\\N' else 'unknown',
                        'balance': safe_int(row[4]),
                        'effective_balance': safe_int(row[5]),
                        
                        # Attestation details
                        'attestation_made': safe_bool(row[6]),
                        'inclusion_delay': safe_int(row[7]),
                        'head_valid': safe_bool(row[8]),
                        'target_valid': safe_bool(row[9]),
                        'source_valid': safe_bool(row[10]),
                        'att_earned_reward': safe_int(row[11]),
                        'att_missed_reward': safe_int(row[12]),
                        'att_penalty': safe_int(row[13]),
                        
                        # Proposer details
                        'is_proposer': safe_bool(row[14]),
                        'block_to_propose': safe_int(row[15]),
                        'block_proposed': safe_bool(row[16]),
                        'propose_earned_reward': safe_int(row[17]),
                        'propose_missed_reward': safe_int(row[18]),
                        'propose_penalty': safe_int(row[19]),
                        
                        # Sync committee details
                        'is_sync_committee': safe_bool(row[20]),
                        'sync_performance': safe_float(row[21]),
                        'sync_earned_reward': safe_int(row[22]),
                        'sync_missed_reward': safe_int(row[23]),
                        'sync_penalty': safe_int(row[24])
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get validator details: {e}")
            raise
    
    async def get_operator_epoch_performance(self, 
                                     operator: str,
                                     start_epoch: Optional[int] = None,
                                     end_epoch: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get epoch-by-epoch performance for a specific operator"""
        
        where_conditions = [f"val_nos_name = '{operator}'",
                          "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"]
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
            
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            epoch,
            COUNT(*) as validator_count,
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            AVG(CASE WHEN att_inc_delay IS NOT NULL THEN att_inc_delay ELSE NULL END) as avg_inclusion_delay,
            SUM(is_proposer) as proposer_duties,
            SUM(CASE WHEN block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
            SUM(is_sync) as sync_duties,
            AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance,
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(propose_earned_reward, 0) + COALESCE(sync_earned_reward, 0)) as total_rewards,
            SUM(COALESCE(att_penalty, 0) + COALESCE(propose_penalty, 0) + COALESCE(sync_penalty, 0)) as total_penalties
        FROM validators_summary 
        WHERE {where_clause}
        GROUP BY epoch
        ORDER BY epoch DESC
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            results = []
            for row in raw_data:
                if len(row) >= 15:
                    results.append({
                        'epoch': safe_int(row[0]),
                        'validator_count': safe_int(row[1]),
                        'attestations_made': safe_int(row[2]),
                        'attestations_missed': safe_int(row[3]),
                        'participation_rate': safe_float(row[4]),
                        'head_accuracy': safe_float(row[5]),
                        'target_accuracy': safe_float(row[6]),
                        'source_accuracy': safe_float(row[7]),
                        'avg_inclusion_delay': safe_float(row[8]),
                        'proposer_duties': safe_int(row[9]),
                        'blocks_proposed': safe_int(row[10]),
                        'sync_duties': safe_int(row[11]),
                        'avg_sync_performance': safe_float(row[12]),
                        'total_rewards': safe_int(row[13]),
                        'total_penalties': safe_int(row[14])
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get operator epoch performance: {e}")
            raise
    
    async def get_nodeset_validator_accuracy(self, 
                                     start_epoch: Optional[int] = None, 
                                     end_epoch: Optional[int] = None,
                                     operator: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get validator accuracy metrics for NodeSet operators only"""
        
        # Build WHERE clause with filters - always include NodeSet filter
        where_conditions = ["val_nos_name IS NOT NULL",
                          "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"]
        
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
        if operator:
            where_conditions.append(f"val_nos_name = '{operator}'")
            
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            val_nos_name,
            COUNT(*) as total_attestations,
            COUNT(DISTINCT epoch) as epochs_covered,
            COUNT(DISTINCT val_id) as validator_count,
            
            -- Overall accuracy percentages
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            
            -- Failure counts
            SUM(CASE WHEN att_valid_head = 0 THEN 1 ELSE 0 END) as invalid_heads,
            SUM(CASE WHEN att_valid_target = 0 THEN 1 ELSE 0 END) as invalid_targets,
            SUM(CASE WHEN att_valid_source = 0 THEN 1 ELSE 0 END) as invalid_sources,
            
            -- Attestation participation
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            
            -- Inclusion delay stats
            AVG(CASE WHEN att_inc_delay IS NOT NULL THEN att_inc_delay ELSE NULL END) as avg_inclusion_delay,
            
            -- Rewards/penalties
            SUM(COALESCE(att_earned_reward, 0)) as total_earned_rewards,
            SUM(COALESCE(att_missed_reward, 0)) as total_missed_rewards,
            SUM(COALESCE(att_penalty, 0)) as total_penalties
            
        FROM validators_summary 
        WHERE {where_clause}
        GROUP BY val_nos_name 
        ORDER BY head_accuracy DESC
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            # Helper functions for safe conversion
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            # Transform to structured format
            results = []
            for row in raw_data:
                if len(row) >= 16:  # Ensure we have all expected columns
                    results.append({
                        'operator': row[0],
                        'total_attestations': safe_int(row[1]),
                        'epochs_covered': safe_int(row[2]),
                        'validator_count': safe_int(row[3]),
                        'head_accuracy': safe_float(row[4]),
                        'target_accuracy': safe_float(row[5]),
                        'source_accuracy': safe_float(row[6]),
                        'invalid_heads': safe_int(row[7]),
                        'invalid_targets': safe_int(row[8]),
                        'invalid_sources': safe_int(row[9]),
                        'attestations_made': safe_int(row[10]),
                        'attestations_missed': safe_int(row[11]),
                        'participation_rate': safe_float(row[12]),
                        'avg_inclusion_delay': safe_float(row[13]),
                        'total_earned_rewards': safe_int(row[14]),
                        'total_missed_rewards': safe_int(row[15]),
                        'total_penalties': safe_int(row[16]) if len(row) > 16 else 0
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get NodeSet validator accuracy: {e}")
            raise
    
    async def get_nodeset_performance_trends(self, 
                                     start_epoch: Optional[int] = None,
                                     end_epoch: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get NodeSet performance trends across epochs"""
        
        where_conditions = ["val_nos_name IS NOT NULL",
                          "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"]
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
            
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            epoch,
            COUNT(*) as total_validators,
            COUNT(DISTINCT val_nos_name) as total_operators,
            
            -- Performance metrics
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            ROUND((SUM(CASE WHEN att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as head_accuracy,
            ROUND((SUM(CASE WHEN att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as target_accuracy,
            ROUND((SUM(CASE WHEN att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as source_accuracy,
            
            -- Rewards and penalties
            SUM(COALESCE(att_earned_reward, 0) + COALESCE(propose_earned_reward, 0) + COALESCE(sync_earned_reward, 0)) as total_rewards,
            SUM(COALESCE(att_penalty, 0) + COALESCE(propose_penalty, 0) + COALESCE(sync_penalty, 0)) as total_penalties,
            
            -- Block proposals
            SUM(is_proposer) as proposer_duties,
            SUM(CASE WHEN block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
            ROUND((SUM(CASE WHEN block_proposed = 1 THEN 1 ELSE 0 END)*100.0/NULLIF(SUM(is_proposer), 0)), 2) as proposal_success_rate,
            
            -- Sync committee
            SUM(is_sync) as sync_duties,
            AVG(CASE WHEN sync_percent IS NOT NULL THEN sync_percent ELSE NULL END) as avg_sync_performance
            
        FROM validators_summary 
        WHERE {where_clause}
        GROUP BY epoch
        ORDER BY epoch DESC
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            results = []
            for row in raw_data:
                if len(row) >= 12:
                    results.append({
                        'epoch': safe_int(row[0]),
                        'total_validators': safe_int(row[1]),
                        'total_operators': safe_int(row[2]),
                        'participation_rate': safe_float(row[3]),
                        'head_accuracy': safe_float(row[4]),
                        'target_accuracy': safe_float(row[5]),
                        'source_accuracy': safe_float(row[6]),
                        'total_rewards': safe_int(row[7]),
                        'total_penalties': safe_int(row[8]),
                        'proposer_duties': safe_int(row[9]),
                        'blocks_proposed': safe_int(row[10]),
                        'proposal_success_rate': safe_float(row[11]),
                        'sync_duties': safe_int(row[12]) if len(row) > 12 else 0,
                        'avg_sync_performance': safe_float(row[13]) if len(row) > 13 else 0.0
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get NodeSet performance trends: {e}")
            raise
    
    async def get_nodeset_validator_details(self, 
                                    validator_id: Optional[int] = None,
                                    start_epoch: Optional[int] = None,
                                    end_epoch: Optional[int] = None,
                                    limit: int = 1000) -> List[Dict[str, Any]]:
        """Get detailed NodeSet validator performance data only"""
        
        where_conditions = ["val_nos_name IS NOT NULL",  # NodeSet validators only
                          "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"]
        if validator_id is not None:
            where_conditions.append(f"val_id = {validator_id}")
        if start_epoch is not None:
            where_conditions.append(f"epoch >= {start_epoch}")
        if end_epoch is not None:
            where_conditions.append(f"epoch <= {end_epoch}")
            
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
        SELECT 
            epoch,
            val_id,
            val_nos_name,
            val_status,
            val_balance,
            val_effective_balance,
            
            -- Attestation details
            att_happened,
            att_inc_delay,
            att_valid_head,
            att_valid_target,
            att_valid_source,
            att_earned_reward,
            att_missed_reward,
            att_penalty,
            
            -- Proposer details
            is_proposer,
            block_to_propose,
            block_proposed,
            propose_earned_reward,
            propose_missed_reward,
            propose_penalty,
            
            -- Sync committee details
            is_sync,
            sync_percent,
            sync_earned_reward,
            sync_missed_reward,
            sync_penalty
            
        FROM validators_summary 
        WHERE {where_clause}
        ORDER BY epoch DESC, val_id ASC
        LIMIT {limit}
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else 0.0
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            def safe_bool(value):
                return bool(safe_int(value))
            
            results = []
            for row in raw_data:
                if len(row) >= 25:
                    results.append({
                        'epoch': safe_int(row[0]),
                        'validator_id': safe_int(row[1]),
                        'operator': row[2] if row[2] != '\\N' else None,
                        'status': row[3] if row[3] != '\\N' else 'unknown',
                        'balance': safe_int(row[4]),
                        'effective_balance': safe_int(row[5]),
                        
                        # Attestation details
                        'attestation_made': safe_bool(row[6]),
                        'inclusion_delay': safe_int(row[7]),
                        'head_valid': safe_bool(row[8]),
                        'target_valid': safe_bool(row[9]),
                        'source_valid': safe_bool(row[10]),
                        'att_earned_reward': safe_int(row[11]),
                        'att_missed_reward': safe_int(row[12]),
                        'att_penalty': safe_int(row[13]),
                        
                        # Proposer details
                        'is_proposer': safe_bool(row[14]),
                        'block_to_propose': safe_int(row[15]),
                        'block_proposed': safe_bool(row[16]),
                        'propose_earned_reward': safe_int(row[17]),
                        'propose_missed_reward': safe_int(row[18]),
                        'propose_penalty': safe_int(row[19]),
                        
                        # Sync committee details
                        'is_sync_committee': safe_bool(row[20]),
                        'sync_performance': safe_float(row[21]),
                        'sync_earned_reward': safe_int(row[22]),
                        'sync_missed_reward': safe_int(row[23]),
                        'sync_penalty': safe_int(row[24])
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get NodeSet validator details: {e}")
            raise

    async def get_operator_detailed_attestations(self, 
                                        operator: str,
                                        epochs: int = 225) -> Dict[str, Any]:
        """Get detailed attestation data for a specific operator for the last N epochs"""
        
        # Get the latest epoch first to determine the range
        epoch_range_query = "SELECT MAX(epoch) FROM validators_summary"
        try:
            epoch_result = await self.execute_query(epoch_range_query)
            if not epoch_result or not epoch_result[0][0]:
                raise Exception("Could not determine latest epoch")
            
            latest_epoch = int(epoch_result[0][0])
            start_epoch = max(0, latest_epoch - epochs + 1)
            
        except Exception as e:
            logger.error(f"Failed to get epoch range: {e}")
            raise

        where_conditions = [
            f"val_nos_name = '{operator}'",
            f"epoch >= {start_epoch}",
            f"epoch <= {latest_epoch}",
            "val_status NOT IN ('exited_unslashed', 'active_exiting', 'withdrawal_possible', 'withdrawal_done')"
        ]
        where_clause = " AND ".join(where_conditions)
        
        # Query for detailed attestation data aggregated by epoch
        query = f"""
        SELECT 
            epoch,
            COUNT(*) as validator_count,
            
            -- Participation metrics
            SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) as attestations_made,
            SUM(CASE WHEN att_happened = 0 OR att_happened IS NULL THEN 1 ELSE 0 END) as attestations_missed,
            ROUND((SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)*100.0/COUNT(*)), 2) as participation_rate,
            
            -- Vote accuracy (only for submitted attestations)
            SUM(CASE WHEN att_happened = 1 AND att_valid_head = 1 THEN 1 ELSE 0 END) as head_hits,
            SUM(CASE WHEN att_happened = 1 AND att_valid_head = 0 THEN 1 ELSE 0 END) as head_misses,
            SUM(CASE WHEN att_happened = 1 AND att_valid_target = 1 THEN 1 ELSE 0 END) as target_hits,
            SUM(CASE WHEN att_happened = 1 AND att_valid_target = 0 THEN 1 ELSE 0 END) as target_misses,
            SUM(CASE WHEN att_happened = 1 AND att_valid_source = 1 THEN 1 ELSE 0 END) as source_hits,
            SUM(CASE WHEN att_happened = 1 AND att_valid_source = 0 THEN 1 ELSE 0 END) as source_misses,
            
            -- Accuracy percentages (only for submitted attestations)
            CASE 
                WHEN SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) > 0 
                THEN ROUND((SUM(CASE WHEN att_happened = 1 AND att_valid_head = 1 THEN 1 ELSE 0 END)*100.0/SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)), 2)
                ELSE NULL 
            END as head_accuracy,
            CASE 
                WHEN SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) > 0 
                THEN ROUND((SUM(CASE WHEN att_happened = 1 AND att_valid_target = 1 THEN 1 ELSE 0 END)*100.0/SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)), 2)
                ELSE NULL 
            END as target_accuracy,
            CASE 
                WHEN SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END) > 0 
                THEN ROUND((SUM(CASE WHEN att_happened = 1 AND att_valid_source = 1 THEN 1 ELSE 0 END)*100.0/SUM(CASE WHEN att_happened = 1 THEN 1 ELSE 0 END)), 2)
                ELSE NULL 
            END as source_accuracy,
            
            -- Inclusion delay (only for submitted attestations)
            CASE 
                WHEN SUM(CASE WHEN att_happened = 1 AND att_inc_delay IS NOT NULL THEN 1 ELSE 0 END) > 0
                THEN ROUND(AVG(CASE WHEN att_happened = 1 AND att_inc_delay IS NOT NULL THEN att_inc_delay ELSE NULL END), 2)
                ELSE NULL 
            END as avg_inclusion_delay,
            
            -- Rewards and penalties
            SUM(COALESCE(att_earned_reward, 0)) as total_att_rewards,
            SUM(COALESCE(att_missed_reward, 0)) as total_missed_rewards,
            SUM(COALESCE(att_penalty, 0)) as total_att_penalties,
            
            -- Block proposals
            SUM(CASE WHEN is_proposer = 1 THEN 1 ELSE 0 END) as proposer_duties,
            SUM(CASE WHEN is_proposer = 1 AND block_proposed = 1 THEN 1 ELSE 0 END) as blocks_proposed,
            SUM(CASE WHEN is_proposer = 1 AND (block_proposed = 0 OR block_proposed IS NULL) THEN 1 ELSE 0 END) as blocks_missed,
            SUM(COALESCE(propose_earned_reward, 0)) as propose_rewards,
            SUM(COALESCE(propose_penalty, 0)) as propose_penalties,
            
            -- Sync committee
            SUM(CASE WHEN is_sync = 1 THEN 1 ELSE 0 END) as sync_duties,
            CASE 
                WHEN SUM(CASE WHEN is_sync = 1 THEN 1 ELSE 0 END) > 0
                THEN ROUND(AVG(CASE WHEN is_sync = 1 AND sync_percent IS NOT NULL THEN sync_percent ELSE NULL END), 2)
                ELSE NULL 
            END as avg_sync_performance,
            SUM(COALESCE(sync_earned_reward, 0)) as sync_rewards,
            SUM(COALESCE(sync_penalty, 0)) as sync_penalties
            
        FROM validators_summary 
        WHERE {where_clause}
        GROUP BY epoch
        ORDER BY epoch DESC
        """
        
        try:
            raw_data = await self.execute_query(query)
            
            def safe_float(value):
                return float(value) if value not in ['\\N', None, ''] else None
            
            def safe_int(value):
                return int(value) if value not in ['\\N', None, ''] else 0
            
            # Transform to structured format
            attestation_data = []
            for row in raw_data:
                if len(row) >= 25:
                    attestation_data.append({
                        'epoch': safe_int(row[0]),
                        'validator_count': safe_int(row[1]),
                        
                        # Participation
                        'attestations_made': safe_int(row[2]),
                        'attestations_missed': safe_int(row[3]),
                        'participation_rate': safe_float(row[4]),
                        
                        # Vote accuracy counts
                        'head_hits': safe_int(row[5]),
                        'head_misses': safe_int(row[6]),
                        'target_hits': safe_int(row[7]),
                        'target_misses': safe_int(row[8]),
                        'source_hits': safe_int(row[9]),
                        'source_misses': safe_int(row[10]),
                        
                        # Accuracy percentages
                        'head_accuracy': safe_float(row[11]),
                        'target_accuracy': safe_float(row[12]),
                        'source_accuracy': safe_float(row[13]),
                        
                        # Inclusion delay
                        'avg_inclusion_delay': safe_float(row[14]),
                        
                        # Rewards
                        'att_rewards': safe_int(row[15]),
                        'missed_rewards': safe_int(row[16]),
                        'att_penalties': safe_int(row[17]),
                        
                        # Block proposals
                        'proposer_duties': safe_int(row[18]),
                        'blocks_proposed': safe_int(row[19]),
                        'blocks_missed': safe_int(row[20]),
                        'propose_rewards': safe_int(row[21]),
                        'propose_penalties': safe_int(row[22]),
                        
                        # Sync committee
                        'sync_duties': safe_int(row[23]),
                        'avg_sync_performance': safe_float(row[24]),
                        'sync_rewards': safe_int(row[25]) if len(row) > 25 else 0,
                        'sync_penalties': safe_int(row[26]) if len(row) > 26 else 0
                    })
            
            return {
                'operator': operator,
                'start_epoch': start_epoch,
                'end_epoch': latest_epoch,
                'total_epochs': len(attestation_data),
                'requested_epochs': epochs,
                'attestation_data': attestation_data
            }
            
        except Exception as e:
            logger.error(f"Failed to get operator detailed attestations: {e}")
            raise

# Global service instance
clickhouse_service = ClickHouseService()