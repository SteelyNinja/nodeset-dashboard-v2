import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConcentrationMetrics } from '../../types/api';
import { apiService } from '../../services/api';
import { analyticsService } from '../../services/analytics';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';

interface OperatorData {
  rank: number;
  address: string;
  ens_name: string;
  active: number;
  total: number;
  exited: number;
  exit_rate: number;
  market_share: number;
  performance_7d: number;
  execution_client?: string;
  consensus_client?: string;
}

const OperatorsTab: React.FC = () => {
  const navigate = useNavigate();
  const [, setConcentrationMetrics] = useState<ConcentrationMetrics | null>(null);
  const [operatorData, setOperatorData] = useState<OperatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionClientFilter, setExecutionClientFilter] = useState<string>('');
  const [consensusClientFilter, setConsensusClientFilter] = useState<string>('');

  // Helper function to get client names
  const getClientName = (code: string, type: 'execution' | 'consensus'): string => {
    const executionClients: Record<string, string> = {
      'G': 'Geth',
      'N': 'Nethermind', 
      'B': 'Besu',
      'R': 'Reth'
    };
    
    const consensusClients: Record<string, string> = {
      'L': 'Lighthouse',
      'S': 'Lodestar',
      'N': 'Nimbus',
      'P': 'Prysm',
      'T': 'Teku'
    };
    
    if (type === 'execution') {
      return executionClients[code] || code;
    } else {
      return consensusClients[code] || code;
    }
  };

  // Helper function to get client colors (matching ClientDiversityTab colors)
  const getClientColor = (client: string, type: 'execution' | 'consensus'): string => {
    const executionColors: Record<string, string> = {
      'geth': '#1f77b4',
      'nethermind': '#ff7f0e',
      'besu': '#2ca02c',
      'reth': '#d62728',
      'erigon': '#9467bd'
    };

    const consensusColors: Record<string, string> = {
      'lighthouse': '#1f77b4',
      'lodestar': '#ff7f0e', 
      'nimbus': '#2ca02c',
      'prysm': '#d62728',
      'teku': '#9467bd'
    };

    if (type === 'execution') {
      return executionColors[client.toLowerCase()] || '#6b7280';
    } else {
      return consensusColors[client.toLowerCase()] || '#6b7280';
    }
  };

  // Get unique execution clients from operator data
  const getUniqueExecutionClients = (): string[] => {
    const clients = operatorData
      .filter(op => op.execution_client)
      .map(op => op.execution_client!)
      .filter((client, index, arr) => arr.indexOf(client) === index)
      .sort();
    return clients;
  };

  // Get unique consensus clients from operator data
  const getUniqueConsensusClients = (): string[] => {
    const clients = operatorData
      .filter(op => op.consensus_client)
      .map(op => op.consensus_client!)
      .filter((client, index, arr) => arr.indexOf(client) === index)
      .sort();
    return clients;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [concentrationData, topOperatorsData, validatorData, operatorSummary, clientDiversityData] = await Promise.all([
        apiService.getConcentrationMetrics(),
        apiService.getTopOperators(1000), // Get all operators
        apiService.getValidatorData(), // Get validator data for ENS names
        apiService.getOperatorsSummary(7), // Get 7-day performance data for ranking
        apiService.getClientDiversity() // Get client diversity data for execution/consensus clients
      ]);
      
      setConcentrationMetrics(concentrationData);
      
      // Process operators data and add 7-day performance ranking
      const operators = topOperatorsData.operators.map((op: any) => ({
        rank: op.rank,
        address: op.full_address,
        ens_name: validatorData.ens_names?.[op.full_address] || '', // Get ENS name from validator data
        active: op.active_count,
        total: op.validator_count,
        exited: op.exited_count,
        exit_rate: op.exit_rate,
        market_share: op.percentage,
        performance_7d: operatorSummary[op.full_address]?.avg_attestation_performance || 0,
        execution_client: clientDiversityData.operator_details?.[op.full_address] ? 
          getClientName(clientDiversityData.operator_details[op.full_address].execution_client, 'execution') : undefined,
        consensus_client: clientDiversityData.operator_details?.[op.full_address] ? 
          getClientName(clientDiversityData.operator_details[op.full_address].consensus_client, 'consensus') : undefined
      })) as OperatorData[];

      // Keep operators in original order (sorted by validator count from API)
      // Don't sort by performance - let users filter and sort as needed
      
      setOperatorData(operators);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch operator data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" className="py-8" />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} className="m-4" />;
  }

  const downloadCSV = () => {
    analyticsService.trackDownload('operators_csv');
    
    const headers = ['Rank', 'Address', 'ENS / Discord Name', '7-Day Performance', 'Active', 'Total', 'Exited', 'Exit Rate', 'Market Share', 'Execution Client', 'Consensus Client'];
    const csvContent = [
      headers.join(','),
      ...operatorData.map(op => [
        op.rank,
        op.address,
        op.ens_name,
        `${op.performance_7d.toFixed(4)}%`,
        op.active,
        op.total,
        op.exited,
        `${op.exit_rate.toFixed(1)}%`,
        `${op.market_share.toFixed(2)}%`,
        op.execution_client || '-',
        op.consensus_client || '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `nodeset_operators_overview_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filter operators based on search term and client filters
  const filteredOperators = operatorData.filter(operator => {
    // Search term filter
    const matchesSearch = !searchTerm || 
      operator.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (operator.ens_name && operator.ens_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Execution client filter
    const matchesExecutionClient = !executionClientFilter || 
      operator.execution_client === executionClientFilter;
    
    // Consensus client filter
    const matchesConsensusClient = !consensusClientFilter || 
      operator.consensus_client === consensusClientFilter;
    
    return matchesSearch && matchesExecutionClient && matchesConsensusClient;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
          <Icon name="operators" size="lg" color="primary" />
          Operator Overview
        </h1>
      </div>

      {operatorData.length > 0 && (
        <div className="space-y-4">
          {/* Header with filters and download button */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Operators ({operatorData.length})
                {(searchTerm || executionClientFilter || consensusClientFilter) && (
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
                    • Showing {filteredOperators.length} results
                  </span>
                )}
              </h2>
              
              {/* Client Filter Dropdowns */}
              <div className="flex items-center gap-3">
                {/* Execution Client Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Execution Client:</label>
                  <select
                    value={executionClientFilter}
                    onChange={(e) => setExecutionClientFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border-2 border-blue-300 dark:border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/30 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-gray-900 dark:text-white shadow-sm hover:border-blue-400 dark:hover:border-blue-400 transition-colors"
                  >
                    <option value="">All Execution</option>
                    {getUniqueExecutionClients().map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>

                {/* Consensus Client Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Consensus Client:</label>
                  <select
                    value={consensusClientFilter}
                    onChange={(e) => setConsensusClientFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border-2 border-green-300 dark:border-green-500 rounded-lg bg-green-50 dark:bg-green-900/30 backdrop-blur-sm focus:ring-2 focus:ring-green-500 focus:border-green-400 text-gray-900 dark:text-white shadow-sm hover:border-green-400 dark:hover:border-green-400 transition-colors"
                  >
                    <option value="">All Consensus</option>
                    {getUniqueConsensusClients().map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                {(executionClientFilter || consensusClientFilter) && (
                  <GlassButton 
                    onClick={() => {
                      setExecutionClientFilter('');
                      setConsensusClientFilter('');
                    }}
                    variant="secondary" 
                    size="xs"
                    className="text-xs"
                  >
                    Clear Filters
                  </GlassButton>
                )}
              </div>
            </div>
            
            <GlassButton onClick={downloadCSV} variant="primary" size="sm" className="flex items-center gap-2">
              <Icon name="download" size="sm" color="current" />
              Download CSV
            </GlassButton>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by operator address or ENS name"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Glass Table with sticky header */}
          <div className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
              <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "0.6fr 2.4fr 1.8fr 1.1fr 1fr 1fr 1fr 1.2fr 1.2fr 1.1fr 1.1fr 1.2fr", gap: "10px"}}>
                <div>Rank</div>
                <div>Address</div>
                <div>ENS / Discord Name</div>
                <div>7-Day Performance</div>
                <div>Active</div>
                <div>Total</div>
                <div>Exited</div>
                <div>Exit Rate</div>
                <div>Market Share</div>
                <div>Execution Client</div>
                <div>Consensus Client</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Scrollable Body */}
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <div className="divide-y divide-white/5 dark:divide-white/10">
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((operator, index) => (
                    <div 
                      key={operator.address}
                      className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                        index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                      }`}
                      style={{gridTemplateColumns: "0.6fr 2.4fr 1.8fr 1.1fr 1fr 1fr 1fr 1.2fr 1.2fr 1.1fr 1.1fr 1.2fr", gap: "10px"}}
                    >
                      <div className="font-medium">
                        {operator.rank}
                      </div>
                      <div className="font-mono text-xs">
                        {operator.address}
                      </div>
                      <div>
                        {operator.ens_name || '-'}
                      </div>
                      <div className="font-medium">
                        {operator.performance_7d ? `${operator.performance_7d.toFixed(4)}%` : '-'}
                      </div>
                      <div>
                        {operator.active}
                      </div>
                      <div>
                        {operator.total}
                      </div>
                      <div>
                        {operator.exited}
                      </div>
                      <div>
                        {operator.exit_rate.toFixed(1)}%
                      </div>
                      <div>
                        {operator.market_share.toFixed(2)}%
                      </div>
                      <div className="text-xs">
                        {operator.execution_client ? (
                          <span
                            className="px-2 py-1 rounded-md font-medium border"
                            style={{
                              color: getClientColor(operator.execution_client, 'execution'),
                              borderColor: getClientColor(operator.execution_client, 'execution'),
                              backgroundColor: `${getClientColor(operator.execution_client, 'execution')}15`
                            }}
                          >
                            {operator.execution_client}
                          </span>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className="text-xs">
                        {operator.consensus_client ? (
                          <span
                            className="px-2 py-1 rounded-md font-medium border"
                            style={{
                              color: getClientColor(operator.consensus_client, 'consensus'),
                              borderColor: getClientColor(operator.consensus_client, 'consensus'),
                              backgroundColor: `${getClientColor(operator.consensus_client, 'consensus')}15`
                            }}
                          >
                            {operator.consensus_client}
                          </span>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div>
                        <GlassButton
                          onClick={() => {
                            analyticsService.trackNavigation('operators', 'operator_dashboard');
                            navigate(`/operator/${operator.address}`);
                          }}
                          variant="primary"
                          size="xs"
                          className="flex items-center gap-1"
                        >
                          <Icon name="chart" size="xs" />
                          Dashboard
                        </GlassButton>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No operators found matching "{searchTerm}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorsTab;