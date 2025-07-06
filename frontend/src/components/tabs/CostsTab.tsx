import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';

interface Transaction {
  hash: string;
  date: string;
  time: string;
  gas_used: number;
  gas_price: number;
  total_cost_eth: number;
  status: string;
  validator_count: number;
}

interface OperatorCost {
  total_cost_eth: number;
  successful_txs: number;
  failed_txs: number;
  avg_cost_per_tx: number;
  total_txs: number;
  total_validators_created: number;
}

interface CostsData {
  operator_costs: Record<string, OperatorCost>;
  operator_transactions: Record<string, Transaction[]>;
  cost_last_updated: number;
  ens_names: Record<string, string>;
  active_validators: Record<string, number>;
  exited_validators: Record<string, number>;
}

const CostsTab: React.FC = () => {
  const [costsData, setCostsData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);

  useEffect(() => {
    const fetchCostsData = async () => {
      try {
        setLoading(true);
        const data = await apiService.getValidatorData();
        
        if (!data.operator_costs || Object.keys(data.operator_costs).length === 0) {
          setError('No cost data available. Cost tracking may not be enabled.');
          return;
        }

        setCostsData({
          operator_costs: data.operator_costs,
          operator_transactions: data.operator_transactions || {},
          cost_last_updated: data.cost_last_updated,
          ens_names: data.ens_names || {},
          active_validators: data.operator_validators || {},
          exited_validators: data.exited_validators || {}
        });
        setError(null);
      } catch (err) {
        setError('Failed to load costs data');
        console.error('Error fetching costs data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCostsData();
  }, []);

  const formatOperatorName = (address: string): string => {
    if (!costsData?.ens_names) return `${address.slice(0, 8)}...${address.slice(-6)}`;
    const ens = costsData.ens_names[address];
    if (ens && ens !== address) {
      return ens.includes('.eth') ? ens : `${ens} (${address.slice(0, 8)}...${address.slice(-6)})`;
    }
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const calculateDataAge = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - timestamp;
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  const calculateSummaryMetrics = () => {
    if (!costsData?.operator_costs) return null;

    let totalCost = 0;
    let totalTxs = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalValidators = 0;
    let operatorCount = 0;

    Object.entries(costsData.operator_costs).forEach(([address, costs]) => {
      totalCost += costs.total_cost_eth;
      totalTxs += costs.total_txs;
      totalSuccessful += costs.successful_txs;
      totalFailed += costs.failed_txs;
      totalValidators += costsData.active_validators[address] || 0;
      operatorCount++;
    });

    const successRate = totalTxs > 0 ? (totalSuccessful / totalTxs) * 100 : 0;
    const avgCostPerTx = totalTxs > 0 ? totalCost / totalTxs : 0;
    const costPerValidator = totalValidators > 0 ? totalCost / totalValidators : 0;

    return {
      totalCost,
      totalTxs,
      successRate,
      avgCostPerTx,
      operatorCount,
      totalFailed,
      costPerValidator,
      dataAge: calculateDataAge(costsData.cost_last_updated)
    };
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(',');
    const csvContent = [
      headers,
      ...data.map(row => Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllCosts = () => {
    if (!costsData?.operator_costs) return;
    
    const csvData = Object.entries(costsData.operator_costs).map(([address, costs]) => ({
      operator: address,
      operator_name: formatOperatorName(address),
      total_cost_eth: costs.total_cost_eth,
      total_transactions: costs.total_txs,
      successful_txs: costs.successful_txs,
      failed_txs: costs.failed_txs,
      success_rate: costs.total_txs > 0 ? ((costs.successful_txs / costs.total_txs) * 100).toFixed(2) : '0',
      avg_cost_per_tx: costs.avg_cost_per_tx,
      validators_created: costs.total_validators_created,
      active_validators: costsData.active_validators[address] || 0,
      cost_per_validator: (costsData.active_validators[address] || 0) > 0 ? 
        (costs.total_cost_eth / (costsData.active_validators[address] || 1)).toFixed(6) : '0'
    }));

    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    downloadCSV(csvData, `all_operator_costs_${timestamp}.csv`);
  };

  const handleDownloadOperatorTransactions = (address: string) => {
    const transactions = costsData?.operator_transactions[address] || [];
    if (transactions.length === 0) return;

    const csvData = transactions.map(tx => ({
      hash: tx.hash,
      date: tx.date,
      time: tx.time,
      cost_eth: tx.total_cost_eth,
      status: tx.status,
      validators: tx.validator_count,
      gas_used: tx.gas_used,
      gas_price: tx.gas_price
    }));

    const operatorName = formatOperatorName(address).replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    downloadCSV(csvData, `${operatorName}_transactions_${timestamp}.csv`);
  };

  const filteredOperators = () => {
    if (!costsData?.operator_costs) return [];
    
    return Object.entries(costsData.operator_costs)
      .filter(([address, _]) => {
        const name = formatOperatorName(address).toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || address.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort(([, a], [, b]) => b.total_cost_eth - a.total_cost_eth);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            <Icon name="costs" size="lg" color="primary" className="inline mr-2" />Costs Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Operational costs and economics analysis
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="warning" size="lg" color="warning" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Cost Tracking Not Available</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{error}</p>
                <p className="mt-2">To enable cost tracking, set the ETHERSCAN_API_KEY environment variable in your backend configuration.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!costsData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No costs data available</div>
      </div>
    );
  }

  const metrics = calculateSummaryMetrics();
  const operators = filteredOperators();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          <Icon name="costs" size="lg" color="primary" className="inline mr-2" />Costs Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Operational costs and economics analysis
        </p>
      </div>

      {metrics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard>
              <div className="flex items-center">
                <Icon name="star" size="lg" color="primary" className="mr-2" />
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Gas Spent</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.totalCost.toFixed(4)} ETH
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                All operator costs
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <Icon name="metrics" size="lg" color="primary" className="mr-2" />
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Transactions</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.totalTxs.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Validator creation txs
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <Icon name="success" size="lg" color="success" className="mr-2" />
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Success Rate</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Transaction success rate
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <span className="text-xl mr-2">⚡</span>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Avg Cost/TX</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.avgCostPerTx.toFixed(6)} ETH
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Average per transaction
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <Icon name="operators" size="lg" color="primary" className="mr-2" />
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Operators Tracked</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.operatorCount}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                With cost data
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <span className="text-xl mr-2">❌</span>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Failed TXs</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.totalFailed}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Failed transactions
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <Icon name="info" size="lg" color="primary" className="mr-2" />
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost/Validator</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.costPerValidator.toFixed(6)} ETH
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Average per validator
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center">
                <span className="text-xl mr-2">🕐</span>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Age</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {metrics.dataAge}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Last updated
              </p>
            </GlassCard>
          </div>

          {/* Operator Rankings */}
          <GlassCard size="large" hoverable={false}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <Icon name="costs" size="lg" color="primary" className="inline mr-2" />Operator Cost Rankings ({operators.length})
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search operators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <GlassButton
                  onClick={handleDownloadAllCosts}
                  variant="primary"
                  size="sm"
                >
                  <Icon name="download" size="sm" color="current" className="inline mr-2" />Download CSV
                </GlassButton>
              </div>
            </div>

            <div className="space-y-2">
              {operators.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No operators found matching "{searchTerm}"
                </div>
              ) : (
                operators.map(([address, costs], index) => {
                  const isExpanded = expandedOperator === address;
                  const transactions = costsData.operator_transactions[address] || [];
                  const activeValidators = costsData.active_validators[address] || 0;
                  const successRate = costs.total_txs > 0 ? (costs.successful_txs / costs.total_txs) * 100 : 0;
                  const costPerValidator = activeValidators > 0 ? costs.total_cost_eth / activeValidators : 0;

                  return (
                    <div key={address} className="border border-white/20 dark:border-white/30 rounded-lg bg-white/5 dark:bg-white/5 backdrop-blur-sm">
                      <div 
                        className="p-4 cursor-pointer hover:bg-white/10 dark:hover:bg-white/10 transition-colors duration-200"
                        onClick={() => setExpandedOperator(isExpanded ? null : address)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-1 rounded">
                              #{index + 1}
                            </div>
                            <div>
                              <div className="font-mono text-sm text-gray-900 dark:text-white">
                                {formatOperatorName(address)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {costs.total_cost_eth.toFixed(6)} ETH • {costs.total_txs} txs • {successRate.toFixed(1)}% success
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {costs.total_cost_eth.toFixed(6)} ETH
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {activeValidators} validators
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/20 dark:border-white/30 p-4 bg-white/5 dark:bg-white/5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                              <div className="text-sm text-gray-600 dark:text-gray-400">Transaction Summary</div>
                              <div className="text-lg font-bold text-gray-900 dark:text-white">
                                {costs.total_cost_eth.toFixed(6)} ETH
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {costs.total_txs} txs • Avg: {costs.avg_cost_per_tx.toFixed(6)} ETH
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm text-gray-600 dark:text-gray-400">Success Metrics</div>
                              <div className="text-lg font-bold text-green-600">
                                {costs.successful_txs} / {costs.total_txs}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {successRate.toFixed(1)}% success rate • {costs.failed_txs} failed
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm text-gray-600 dark:text-gray-400">Validator Metrics</div>
                              <div className="text-lg font-bold text-blue-600">
                                {activeValidators} active
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Cost/validator: {costPerValidator.toFixed(6)} ETH
                              </div>
                            </div>
                          </div>

                          {transactions.length > 0 && (
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  Transaction History ({transactions.length})
                                </h4>
                                <GlassButton
                                  onClick={() => handleDownloadOperatorTransactions(address)}
                                  variant="success"
                                  size="sm"
                                >
                                  <Icon name="download" size="sm" color="current" className="inline mr-1" />CSV
                                </GlassButton>
                              </div>
                              <div className="overflow-x-auto">
                                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                                  <GlassTable>
                                    <GlassTableHeader>
                                      <GlassTableRow>
                                        <GlassTableCell>Date</GlassTableCell>
                                        <GlassTableCell>Time</GlassTableCell>
                                        <GlassTableCell>Cost (ETH)</GlassTableCell>
                                        <GlassTableCell>Status</GlassTableCell>
                                        <GlassTableCell>Validators</GlassTableCell>
                                        <GlassTableCell>Gas Used</GlassTableCell>
                                        <GlassTableCell>Gas Price</GlassTableCell>
                                      </GlassTableRow>
                                    </GlassTableHeader>
                                    <GlassTableBody>
                                      {transactions.map((tx, txIndex) => (
                                        <GlassTableRow key={tx.hash}>
                                          <GlassTableCell>{tx.date}</GlassTableCell>
                                          <GlassTableCell>{tx.time}</GlassTableCell>
                                          <GlassTableCell className="font-mono">{tx.total_cost_eth.toFixed(6)}</GlassTableCell>
                                          <GlassTableCell>
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                              tx.status === 'Successful' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                              {tx.status}
                                            </span>
                                          </GlassTableCell>
                                          <GlassTableCell>{tx.validator_count}</GlassTableCell>
                                          <GlassTableCell className="font-mono">{tx.gas_used.toLocaleString()}</GlassTableCell>
                                          <GlassTableCell className="font-mono">{tx.gas_price.toLocaleString()}</GlassTableCell>
                                        </GlassTableRow>
                                      ))}
                                    </GlassTableBody>
                                  </GlassTable>
                                </div>
                                {transactions.length > 0 && (
                                  <div className="text-center text-xs text-gray-500 mt-2">
                                    Showing all {transactions.length} transactions. Use scroll to view all data.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default CostsTab;