// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

// Health Check Types
export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface DataFileStatus {
  exists: boolean;
  size: number;
  last_modified: string;
}

export interface DataFilesHealthResponse {
  status: string;
  files: Record<string, DataFileStatus>;
}

// Network Overview Types
export interface NetworkOverview {
  total_validators: number;
  active_validators: number;
  validators_in_queue: number;
  activation_rate: number;
  queue_rate: number;
  total_operators: number;
  total_proposals: number;
  successful_proposals: number;
  missed_proposals: number;
  network_health_score: number;
}

// Dashboard Data Types
export interface ValidatorData {
  last_block: number;
  last_epoch_checked: number;
  total_validators: number;
  total_exited: number;
  operator_validators: Record<string, number>;
  active_validators?: Record<string, number>;
  exited_validators?: Record<string, number>;
  pending_pubkeys?: string[];
  ens_names?: Record<string, string>;
  ens_last_updated: string | number;
  last_updated: string;
  cost_last_updated: number;
  network_overview?: NetworkOverview;
  operator_costs?: Record<string, {
    total_cost_eth: number;
    successful_txs: number;
    failed_txs: number;
    avg_cost_per_tx: number;
    total_txs: number;
    total_validators_created: number;
  }>;
  operator_transactions?: Record<string, Array<{
    hash: string;
    date: string;
    time: string;
    gas_used: number;
    gas_price: number;
    total_cost_eth: number;
    status: string;
    validator_count: number;
  }>>;
}

export interface ConcentrationMetrics {
  total_validators: number;
  total_operators: number;
  gini_coefficient: number;
  top_1_percent: number;
  top_5_percent: number;
  top_10_percent: number;
  top_20_percent: number;
  herfindahl_index: number;
}

export interface PerformanceMetrics {
  excellent: number;
  good: number;
  average: number;
  below_average: number;
  poor: number;
  total: number;
}

export interface PerformanceAnalysis {
  operator_details: Array<{
    operator: string;
    full_address: string;
    performance: number;
    validator_count: number;
    performance_category: string;
  }>;
  excellent_count: number;
  good_count: number;
  average_count: number;
  poor_count: number;
  total_validators: number;
  performance_distribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
}

export interface ProposalData {
  slot: number;
  proposer_index: number;
  operator_name: string;
  block_hash: string;
  timestamp: string;
  gas_limit: number;
  gas_used: number;
  base_fee: number;
  mev_reward: number;
  relay_name: string;
}

export interface GasAnalysis {
  strategies: {
    ultra: number;
    high: number;
    normal: number;
    low: number;
  };
  average_gas_limit: number;
  median_gas_limit: number;
  gas_limit_range: {
    min: number;
    max: number;
  };
  operator_details: Array<{
    operator: string;
    operator_name?: string;
    max_gas_limit: number;
    avg_gas_limit: number;
    strategy: string;
  }>;
}

export interface ClientDiversity {
  consensus_clients: Record<string, number>;
  execution_clients: Record<string, number>;
  setup_types?: Record<string, number>;
  client_combinations?: Record<string, number>;
  diversity_score: number;
  analysis_note: string;
  total_operators?: number;
  operators_with_proposals?: number;
  graffiti_coverage_percent?: number;
}

export interface SyncCommitteeData {
  metadata: {
    last_updated: string;
    total_periods_tracked: number;
    total_validators_in_committees: number;
    total_attestations_tracked: number;
    total_successful_attestations: number;
    total_missed_attestations: number;
    total_api_failures: number;
    overall_participation_rate: number;
  };
  period_summary: Record<string, {
    our_validators_count: number;
    total_slots: number;
    total_successful: number;
    total_missed: number;
    participation_rate: number;
    api_failures: number;
  }>;
  operator_summary: Record<string, {
    total_periods: number;
    total_slots: number;
    total_successful: number;
    total_missed: number;
    participation_rate: number;
    api_failures: number;
  }>;
  detailed_stats: Array<{
    period: number;
    start_epoch: number;
    end_epoch: number;
    start_slot: number;
    end_slot: number;
    validator_index: number;
    validator_pubkey: string;
    operator: string;
    operator_name: string;
    total_slots: number;
    successful_attestations: number;
    missed_attestations: number;
    participation_rate: number;
    is_partial_period: boolean;
    actual_start_slot: number;
    actual_end_slot: number;
    api_failures: number;
    scan_start_slot: number;
    scan_end_slot: number;
  }>;
}

export interface ExitData {
  exit_summary: {
    total_exited: number;
    total_active: number;
    exit_rate_percent: number;
    last_updated: number;
  };
  operators_with_exits: Array<{
    operator: string;
    operator_name: string;
    exits: number;
    still_active: number;
    total_ever: number;
    exit_rate: number;
    latest_exit_timestamp: number;
    latest_exit_date: string;
  }>;
  recent_exits: Array<{
    validator_index: number;
    operator: string;
    operator_name: string;
    exit_timestamp: number;
    exit_date: string;
    status: string;
    slashed: boolean;
    balance_gwei: number | null;
    exit_epoch: string;
  }>;
  exit_timeline: Array<{
    date: string;
    voluntary_exits: number;
    slashed_exits: number;
    total_exits: number;
  }>;
}

export interface ValidatorPerformanceData {
  last_updated: string;
  total_validators: number;
  validators: Record<string, {
    validator_index: number;
    operator: string;
    current_balance: number;
    performance_metrics: {
      performance_today: number;
      performance_1d: number;
      performance_7d: number;
      performance_31d: number;
      performance_365d: number;
      performance_total: number;
      rank_7d: number;
    };
    last_updated: string;
    activation_data: {
      activation_epoch: number;
      activation_timestamp: number;
      activation_date: string;
      activation_eligibility_epoch: number;
      activation_eligibility_timestamp: number;
      activation_eligibility_date: string;
      status: string;
      slashed: boolean;
    };
  }>;
}

export interface ProposalsData {
  metadata: {
    last_updated: string;
    total_proposals: number;
    total_value_eth: number;
    total_consensus_eth: number;
    total_execution_eth: number;
    total_mev_eth: number;
    mev_boost_blocks: number;
    mev_boost_percentage: number;
    operators_tracked: number;
    data_sources: string[];
    calculation_method: string;
  };
  client_diversity: {
    total_proposals: number;
    identified_proposals: number;
    identification_rate: number;
    client_distribution: Record<string, any>;
    analysis_timestamp: string;
  };
  operator_summary: Record<string, {
    proposal_count: number;
    total_value_eth: number;
    average_value_eth: number;
    consensus_rewards_eth: number;
    execution_rewards_eth: number;
    mev_rewards_eth: number;
    mev_blocks_count: number;
    mev_blocks_percentage: number;
    clients_used: Record<string, any>;
    primary_client: string | null;
    pool_signatures_count: number;
    pool_signatures_percentage: number;
  }>;
  proposals: Array<{
    date: string;
    operator: string;
    validator_pubkey: string;
    slot: number;
    total_value_eth: number;
    execution_fees_eth?: number;
    consensus_reward_eth?: number;
    mev_breakdown_eth?: number;
    relay_tag?: string;
    gas_used: number;
    gas_utilization: number;
    tx_count: number;
    base_fee?: number;
  }>;
}

export interface MissedProposalsData {
  metadata: {
    last_updated: string;
    total_missed_proposals: number;
    unique_operators: number;
    tracking_period_start: string;
    tracking_period_end: string;
  };
  missed_proposals: Array<{
    date: string;
    slot: number;
    operator: string;
    validator_index: number;
    reason: string;
    block_hash?: string;
  }>;
}

// Tab identifiers
export type TabId = 
  | 'information'
  | 'distribution'
  | 'concentration'
  | 'operators'
  | 'performance'
  | 'proposals'
  | 'sync-committee'
  | 'exit-analysis'
  | 'costs'
  | 'client-diversity'
  | 'gas-analysis';

// Chart data types
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

export interface ScatterChartData {
  data: Array<{
    x: number;
    y: number;
    label: string;
    color?: string;
  }>;
}