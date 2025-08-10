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
  operator_details?: Record<string, {
    timestamp: number;
    execution_client: string;
    consensus_client: string;
    setup_type: string;
    graffiti_text: string;
  }>;
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
    total_active_exiting?: number;
    total_active: number;
    exit_rate_percent: number;
    last_updated: number;
  };
  operators_with_exits: Array<{
    operator: string;
    operator_name: string;
    exits: number;
    active_exiting?: number;
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

export interface ENSSourcesData {
  total_ens_names: number;
  on_chain_count: number;
  manual_count: number;
  on_chain_percentage: number;
  manual_percentage: number;
  breakdown: {
    on_chain: number;
    manual: number;
  };
  raw_sources: Record<string, string>;
}

export interface VaultEvent {
  type: 'deposit' | 'withdrawal' | 'validator_registration';
  block_number: number;
  transaction_hash: string;
  transaction_index: number;
  timestamp: number;
  // Deposit fields
  caller?: string;
  receiver?: string;
  assets?: string;
  assets_eth?: number;
  shares?: string;
  referrer?: string;
  // Withdrawal fields
  owner?: string;
  position_ticket?: string;
  estimated_assets?: string;
  estimated_assets_eth?: number; // Note: This field is often 0 in the data, use estimated_assets instead
}

export interface VaultEventsData {
  vault_address: string;
  last_update: string;
  total_events: number;
  events: VaultEvent[];
}

// Tab identifiers
export type TabId = 
  | 'information'
  | 'distribution'
  | 'concentration'
  | 'operators'
  | 'performance'
  | 'outages'
  | 'proposals'
  | 'sync-committee'
  | 'exit-analysis'
  | 'costs'
  | 'client-diversity'
  | 'gas-analysis'
  | 'vault-activity';

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

export interface TheoreticalPerformanceData {
  operator: string;
  validator_count: number;
  // Reward components
  attester_actual_reward: number;
  proposer_actual_reward: number;
  sync_actual_reward: number;
  attester_ideal_reward: number;
  proposer_ideal_reward: number;
  sync_ideal_reward: number;
  total_actual_reward: number;
  total_ideal_reward: number;
  // Efficiency metrics
  overall_efficiency: number;
  attester_efficiency: number;
  proposer_efficiency: number;
  sync_efficiency: number;
  // Performance metrics
  successful_attestations: number;
  missed_attestations: number;
  successful_proposals: number;
  missed_proposals: number;
  total_proposer_duties: number;
  total_sync_duties: number;
  avg_sync_participation: number;
  total_epochs_data: number;
  latest_epoch: number;
  start_epoch: number;
  epochs_analyzed: number;
  days_analyzed?: number;
}

export interface TheoreticalPerformanceError {
  error: string;
  message: string;
  epochs_requested: number;
  epochs_available: number;
  days_requested?: number;
  days_available?: number;
  latest_epoch: number;
  min_available_epoch: number;
  requested_start_epoch: number;
  data_completeness_percentage: number;
}

// Operator Daily Performance Types
export interface DailyPerformanceEntry {
  date: string;
  epoch_range: [number, number];
  validator_count: number;
  active_duty_periods: number;
  successful_attestations: number;
  missed_attestations: number;
  participation_rate: number;
  head_accuracy: number;
  target_accuracy: number;
  source_accuracy: number;
  avg_inclusion_delay: number;
  attestation_performance: number;
  total_earned_rewards: number;
  total_penalties: number;
  net_rewards: number;
  max_possible_rewards: number;
}

export interface OperatorPerformanceData {
  daily_performance: DailyPerformanceEntry[];
}

export interface OperatorPerformanceCacheInfo {
  cache_available: boolean;
  cache_path: string | null;
  last_updated: string | null;
  data_period_days: number;
  operators_count: number;
  data_days_available: number;
}

export interface OperatorSummary {
  validator_count: number;
  days_of_data: number;
  latest_date: string;
  avg_participation_rate: number;
  avg_head_accuracy: number;
  avg_target_accuracy: number;
  avg_source_accuracy: number;
  avg_inclusion_delay: number;
  avg_attestation_performance: number;
  latest_performance: number;
}

export interface OperatorChartData {
  dates: string[];
  participation_rate: number[];
  head_accuracy: number[];
  target_accuracy: number[];
  source_accuracy: number[];
  inclusion_delay: number[];
  attestation_performance: number[];
  validator_count: number[];
}

export interface PerformanceTrend {
  date: string;
  operators_count: number;
  total_validators: number;
  avg_participation_rate: number;
  avg_head_accuracy: number;
  avg_target_accuracy: number;
  avg_source_accuracy: number;
  avg_inclusion_delay: number;
  avg_attestation_performance: number;
}

// Outages Types
export interface OutageEvent {
  start: string;
  end: string;
  duration_seconds: number;
}

export interface ValidatorOutageHistory {
  count: number;
  last_outage: string;
  total_downtime_seconds: number;
  outages: OutageEvent[];
}

export interface OutagesData {
  down_validators: string[];
  down_since: Record<string, string>;
  initial_misses: Record<string, number>;
  outage_history: Record<string, ValidatorOutageHistory>;
  summary_message_id: number;
  last_update: string;
}

export interface OutagesSummary {
  total_validators_with_outages: number;
  total_outage_events: number;
  total_downtime_hours: number;
  currently_down: number;
  worst_performers: Array<{
    validator: string;
    outage_count: number;
    total_downtime_seconds: number;
    uptime_percentage: number;
  }>;
  recent_outages: Array<{
    validator: string;
    start: string;
    end: string;
    duration_seconds: number;
  }>;
}