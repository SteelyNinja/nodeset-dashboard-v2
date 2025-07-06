import React, { useState, useEffect } from 'react';
import { ProposalsData, MissedProposalsData, ValidatorData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ProposalMetrics {
  totalProposals: number;
  totalValue: number;
  operatorsWithProposals: number;
  avgValuePerProposal: number;
}

interface ProposalTableData {
  date: string;
  operator: string;
  operatorAddress: string;
  validatorPubkey: string;
  ethValue: string;
  executionRewards: string;
  consensusRewards: string;
  mevRewards: string;
  mevRelay: string;
  slot: string;
  gasUsed: string;
  gasUtilization: string;
  txCount: number;
}

interface MEVRelayBreakdown {
  name: string;
  count: number;
  percentage: string;
}

interface MissedProposalsSummary {
  totalMissed: number;
  totalSuccessful: number;
  totalAllProposals: number;
  missedPercentage: number;
}

interface MissedProposalTableData {
  dateTime: string;
  slotNumber: string;
  operatorName: string;
  operatorAddress: string;
  totalMissed: number;
  totalSuccessful: number;
  missedPercentage: string;
}

interface OperatorProposalData {
  operator: string;
  ensName: string;
  proposalCount: number;
  totalValueEth: number;
  averageValueEth: number;
  highestValueEth: number;
  totalGasUsed: number;
  avgGasUtilization: number;
  avgTxCount: number;
  firstProposal: number;
  lastProposal: number;
  proposals: any[];
}

const ProposalsTab: React.FC = () => {
  const [proposalsData, setProposalsData] = useState<ProposalsData | null>(null);
  const [missedProposalsData, setMissedProposalsData] = useState<MissedProposalsData | null>(null);
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [missedProposalsSearchTerm, setMissedProposalsSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [proposals, missed, validators] = await Promise.all([
          apiService.getProposalsData(),
          apiService.getMissedProposalsData().catch(() => null),
          apiService.getValidatorData().catch(() => null)
        ]);
        
        setProposalsData(proposals);
        setMissedProposalsData(missed);
        setValidatorData(validators);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposals data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatRelayName = (relayTag: string): string => {
    if (!relayTag) return "Locally Built";
    
    const relayDisplayMap: { [key: string]: string } = {
      'bloxroute-max-profit-relay': 'BloxRoute Max Profit',
      'bloxroute-regulated-relay': 'BloxRoute Regulated',
      'flashbots-relay': 'Flashbots',
      'eden-relay': 'Eden Network',
      'manifold-relay': 'Manifold',
      'ultra-sound-relay': 'Ultra Sound',
      'agnostic-relay': 'Agnostic Relay',
      'bloxml-relay': 'BloXML'
    };
    
    return relayDisplayMap[relayTag] || relayTag.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatOperatorDisplay = (address: string, ensName?: string): string => {
    if (ensName) {
      return `${ensName} (${address.slice(0, 8)}...${address.slice(-6)})`;
    }
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const calculateMetrics = (): ProposalMetrics => {
    if (!proposalsData?.metadata) {
      return { totalProposals: 0, totalValue: 0, operatorsWithProposals: 0, avgValuePerProposal: 0 };
    }

    const { total_proposals, total_value_eth, operators_tracked } = proposalsData.metadata;
    const avgValuePerProposal = total_proposals > 0 ? total_value_eth / total_proposals : 0;

    return {
      totalProposals: total_proposals,
      totalValue: total_value_eth,
      operatorsWithProposals: operators_tracked,
      avgValuePerProposal
    };
  };

  const getLargestProposals = (limit: number = 5): ProposalTableData[] => {
    if (!proposalsData?.proposals) return [];
    
    const ensNames = validatorData?.ens_names || {};
    
    return proposalsData.proposals
      .sort((a, b) => b.total_value_eth - a.total_value_eth)
      .slice(0, limit)
      .map(proposal => ({
        date: proposal.date,
        operator: formatOperatorDisplay(proposal.operator, ensNames[proposal.operator]),
        operatorAddress: proposal.operator,
        validatorPubkey: proposal.validator_pubkey,
        ethValue: proposal.total_value_eth.toFixed(4),
        executionRewards: (proposal.execution_fees_eth || 0).toFixed(4),
        consensusRewards: (proposal.consensus_reward_eth || 0).toFixed(4),
        mevRewards: (proposal.mev_breakdown_eth || 0).toFixed(4),
        mevRelay: formatRelayName(proposal.relay_tag || ''),
        slot: proposal.slot.toString(),
        gasUsed: proposal.gas_used.toLocaleString(),
        gasUtilization: `${proposal.gas_utilization.toFixed(1)}%`,
        txCount: proposal.tx_count
      }));
  };

  const getLatestProposals = (limit: number = 5): ProposalTableData[] => {
    if (!proposalsData?.proposals) return [];
    
    const ensNames = validatorData?.ens_names || {};
    
    return proposalsData.proposals
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
      .map(proposal => ({
        date: proposal.date,
        operator: formatOperatorDisplay(proposal.operator, ensNames[proposal.operator]),
        operatorAddress: proposal.operator,
        validatorPubkey: proposal.validator_pubkey,
        ethValue: proposal.total_value_eth.toFixed(4),
        executionRewards: (proposal.execution_fees_eth || 0).toFixed(4),
        consensusRewards: (proposal.consensus_reward_eth || 0).toFixed(4),
        mevRewards: (proposal.mev_breakdown_eth || 0).toFixed(4),
        mevRelay: formatRelayName(proposal.relay_tag || ''),
        slot: proposal.slot.toString(),
        gasUsed: proposal.gas_used.toLocaleString(),
        gasUtilization: `${proposal.gas_utilization.toFixed(1)}%`,
        txCount: proposal.tx_count
      }));
  };

  const getMEVRelayBreakdown = (): MEVRelayBreakdown[] => {
    if (!proposalsData?.proposals) return [];
    
    const relayCounts: { [key: string]: number } = {};
    
    proposalsData.proposals.forEach(proposal => {
      const relayName = formatRelayName(proposal.relay_tag || '');
      relayCounts[relayName] = (relayCounts[relayName] || 0) + 1;
    });

    const totalProposals = proposalsData.proposals.length;
    
    return Object.entries(relayCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name,
        count,
        percentage: `${((count / totalProposals) * 100).toFixed(1)}%`
      }));
  };

  const getMissedProposalsSummary = (): MissedProposalsSummary | null => {
    if (!missedProposalsData?.missed_proposals || !proposalsData?.metadata) {
      return null;
    }

    const totalMissed = missedProposalsData.missed_proposals.length;
    const totalSuccessful = proposalsData.metadata.total_proposals;
    const totalAllProposals = totalMissed + totalSuccessful;
    const missedPercentage = totalAllProposals > 0 ? (totalMissed / totalAllProposals) * 100 : 0;

    return {
      totalMissed,
      totalSuccessful,
      totalAllProposals,
      missedPercentage
    };
  };

  const getMissedProposalsTableData = (): MissedProposalTableData[] => {
    if (!missedProposalsData?.missed_proposals || !proposalsData?.operator_summary) {
      return [];
    }

    const ensNames = validatorData?.ens_names || {};
    
    // Count missed proposals by operator
    const operatorMissedCounts: { [key: string]: number } = {};
    missedProposalsData.missed_proposals.forEach(missed => {
      operatorMissedCounts[missed.operator] = (operatorMissedCounts[missed.operator] || 0) + 1;
    });

    // Get successful proposals count by operator from proposals data
    const operatorSuccessfulCounts: { [key: string]: number } = {};
    if (proposalsData?.operator_summary) {
      Object.entries(proposalsData.operator_summary).forEach(([operator, summary]) => {
        operatorSuccessfulCounts[operator] = summary.proposal_count;
      });
    }

    // Create table data
    return missedProposalsData.missed_proposals
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(missed => {
        const ensName = ensNames[missed.operator];
        const operatorDisplay = ensName ? ensName : `${missed.operator.slice(0, 8)}...${missed.operator.slice(-6)}`;
        
        const totalMissed = operatorMissedCounts[missed.operator] || 0;
        const totalSuccessful = operatorSuccessfulCounts[missed.operator] || 0;
        const totalAttempts = totalMissed + totalSuccessful;
        const missedPercentage = totalAttempts > 0 ? ((totalMissed / totalAttempts) * 100).toFixed(1) : '0.0';

        return {
          dateTime: missed.date,
          slotNumber: missed.slot.toString(),
          operatorName: operatorDisplay,
          operatorAddress: missed.operator,
          totalMissed,
          totalSuccessful,
          missedPercentage: `${missedPercentage}%`
        };
      });
  };

  const getOperatorProposalData = (): OperatorProposalData[] => {
    if (!proposalsData?.operator_summary || !proposalsData?.proposals) return [];
    
    const ensNames = validatorData?.ens_names || {};
    
    return Object.entries(proposalsData.operator_summary)
      .map(([address, summary]) => {
        const operatorProposals = proposalsData.proposals.filter(p => p.operator === address);
        
        if (operatorProposals.length === 0) {
          return null;
        }

        const dates = operatorProposals.map(p => p.date);
        const gasUsed = operatorProposals.reduce((sum, p) => sum + p.gas_used, 0);
        const avgGasUtil = operatorProposals.reduce((sum, p) => sum + p.gas_utilization, 0) / operatorProposals.length;
        const avgTxs = operatorProposals.reduce((sum, p) => sum + p.tx_count, 0) / operatorProposals.length;
        const highestValue = Math.max(...operatorProposals.map(p => p.total_value_eth));

        return {
          operator: address,
          ensName: ensNames[address] || '',
          proposalCount: summary.proposal_count,
          totalValueEth: summary.total_value_eth,
          averageValueEth: summary.average_value_eth,
          highestValueEth: highestValue,
          totalGasUsed: gasUsed,
          avgGasUtilization: avgGasUtil,
          avgTxCount: avgTxs,
          firstProposal: Math.min(...dates.map(d => new Date(d).getTime())),
          lastProposal: Math.max(...dates.map(d => new Date(d).getTime())),
          proposals: operatorProposals
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date, newest first
            .map(p => ({
              ...p,
              mev_relay: formatRelayName(p.relay_tag || '')
            }))
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.proposalCount || 0) - (a?.proposalCount || 0)) as OperatorProposalData[];
  };

  const getFilteredOperators = (): OperatorProposalData[] => {
    const operators = getOperatorProposalData();
    
    if (!searchTerm) return operators;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return operators.filter(op => 
      op.operator.toLowerCase().includes(lowerSearchTerm) ||
      (op.ensName && op.ensName.toLowerCase().includes(lowerSearchTerm))
    );
  };

  const downloadCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!proposalsData) return <ErrorMessage message="No proposals data available" />;

  const metrics = calculateMetrics();
  const largestProposals = getLargestProposals(5);
  const latestProposals = getLatestProposals(5);
  const mevRelayBreakdown = getMEVRelayBreakdown();
  const missedSummary = getMissedProposalsSummary();
  const missedProposalsTable = getMissedProposalsTableData();
  const filteredOperators = getFilteredOperators();
  
  // Filter missed proposals based on search term
  const filteredMissedProposals = missedProposalsTable.filter(missed => 
    missed.operatorName.toLowerCase().includes(missedProposalsSearchTerm.toLowerCase()) ||
    missed.slotNumber.includes(missedProposalsSearchTerm) ||
    missed.dateTime.toLowerCase().includes(missedProposalsSearchTerm.toLowerCase()) ||
    (missed.operatorAddress && missed.operatorAddress.toLowerCase().includes(missedProposalsSearchTerm.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤲 Proposal Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive analysis of Ethereum block proposals from NodeSet validators
        </p>
      </div>
      
      <div className="space-y-6">

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Total Proposals</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.totalProposals.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Block proposals tracked</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Total ETH Value</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.totalValue.toFixed(3)}</div>
          <div className="text-xs text-gray-400">ETH total value</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Operators with Proposals</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.operatorsWithProposals.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Active proposing operators</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Avg Value/Proposal</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.avgValuePerProposal.toFixed(4)}</div>
          <div className="text-xs text-gray-400">ETH average per proposal</div>
        </GlassCard>
      </div>

      {/* Largest Proposals Table */}
      <GlassCard size="large">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">💎 Largest Proposals by Value</h3>
            <p className="text-sm text-gray-600">Showing the 5 highest value proposals across all operators</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(largestProposals, 'largest_proposals.csv')}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="overflow-x-auto">
          <GlassTable>
            <GlassTableHeader>
              <GlassTableRow>
                <GlassTableCell>Date</GlassTableCell>
                <GlassTableCell>Operator</GlassTableCell>
                <GlassTableCell>ETH Value</GlassTableCell>
                <GlassTableCell>MEV Relay</GlassTableCell>
                <GlassTableCell>Gas Used</GlassTableCell>
                <GlassTableCell>TXs</GlassTableCell>
              </GlassTableRow>
            </GlassTableHeader>
            <GlassTableBody>
              {largestProposals.map((proposal, index) => (
                <GlassTableRow key={index}>
                  <GlassTableCell>{proposal.date}</GlassTableCell>
                  <GlassTableCell>{proposal.operator}</GlassTableCell>
                  <GlassTableCell className="font-medium text-green-600">{proposal.ethValue}</GlassTableCell>
                  <GlassTableCell>{proposal.mevRelay}</GlassTableCell>
                  <GlassTableCell>{proposal.gasUsed}</GlassTableCell>
                  <GlassTableCell>{proposal.txCount}</GlassTableCell>
                </GlassTableRow>
              ))}
            </GlassTableBody>
          </GlassTable>
        </div>
      </GlassCard>

      {/* Latest Proposals Table */}
      <GlassCard size="large">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🕘 Latest Proposals</h3>
            <p className="text-sm text-gray-600">Showing the 5 most recent proposals across all operators</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(latestProposals, 'latest_proposals.csv')}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="overflow-x-auto">
          <GlassTable>
            <GlassTableHeader>
              <GlassTableRow>
                <GlassTableCell>Date</GlassTableCell>
                <GlassTableCell>Operator</GlassTableCell>
                <GlassTableCell>ETH Value</GlassTableCell>
                <GlassTableCell>MEV Relay</GlassTableCell>
                <GlassTableCell>Gas Used</GlassTableCell>
                <GlassTableCell>TXs</GlassTableCell>
              </GlassTableRow>
            </GlassTableHeader>
            <GlassTableBody>
              {latestProposals.map((proposal, index) => (
                <GlassTableRow key={index}>
                  <GlassTableCell>{proposal.date}</GlassTableCell>
                  <GlassTableCell>{proposal.operator}</GlassTableCell>
                  <GlassTableCell className="font-medium text-green-600">{proposal.ethValue}</GlassTableCell>
                  <GlassTableCell>{proposal.mevRelay}</GlassTableCell>
                  <GlassTableCell>{proposal.gasUsed}</GlassTableCell>
                  <GlassTableCell>{proposal.txCount}</GlassTableCell>
                </GlassTableRow>
              ))}
            </GlassTableBody>
          </GlassTable>
        </div>
      </GlassCard>

      {/* MEV Relay Breakdown */}
      <GlassCard hoverable={false}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🔗 MEV Relay Usage Breakdown</h3>
            <p className="text-sm text-gray-600">Breakdown of MEV relays used in proposals, sorted by usage count</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(mevRelayBreakdown, 'mev_relay_breakdown.csv')}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell>MEV Relay</GlassTableCell>
                  <GlassTableCell>Proposals</GlassTableCell>
                  <GlassTableCell>Percentage</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {mevRelayBreakdown.map((relay, index) => (
                  <GlassTableRow key={index}>
                    <GlassTableCell>{relay.name}</GlassTableCell>
                    <GlassTableCell>{relay.count}</GlassTableCell>
                    <GlassTableCell>{relay.percentage}</GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
          
          <div className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={mevRelayBreakdown.map((relay, index) => ({
                    name: relay.name,
                    value: relay.count,
                    fill: `hsl(${(index * 137.5) % 360}, 70%, 60%)`
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                >
                  {mevRelayBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${(index * 137.5) % 360}, 70%, 60%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      {/* Missed Proposals Analysis */}
      {(missedSummary || missedProposalsTable.length > 0) && (
        <GlassCard size="large">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">❌ Missed Proposals Analysis</h3>
              {missedProposalsTable.length > 0 && (
                <p className="text-sm text-gray-600">Showing {filteredMissedProposals.length} of {missedProposalsTable.length} missed proposal records</p>
              )}
            </div>
            {missedProposalsTable.length > 0 && (
              <GlassButton
                onClick={() => downloadCSV(filteredMissedProposals, 'missed_proposals.csv')}
                variant="primary"
                size="sm"
              >
                📥 Download CSV
              </GlassButton>
            )}
          </div>
          
          {missedProposalsTable.length > 0 && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Search missed proposals by operator name, slot, date, or address"
                className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={missedProposalsSearchTerm}
                onChange={(e) => setMissedProposalsSearchTerm(e.target.value)}
              />
            </div>
          )}
          
          {missedSummary && (
            <div className="bg-danger-light/30 dark:bg-danger-dark/20 border border-danger/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Summary:</strong> {missedSummary.totalSuccessful.toLocaleString()} successful proposals • {missedSummary.totalMissed.toLocaleString()} missed proposals • {missedSummary.missedPercentage.toFixed(1)}% missed rate
              </p>
            </div>
          )}

          {filteredMissedProposals.length > 0 ? (
            <div className="overflow-x-auto">
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                <GlassTable>
                  <GlassTableHeader>
                    <GlassTableRow>
                      <GlassTableCell>Date & Time</GlassTableCell>
                      <GlassTableCell>Slot Number</GlassTableCell>
                      <GlassTableCell>Operator Name</GlassTableCell>
                      <GlassTableCell>Total Missed</GlassTableCell>
                      <GlassTableCell>Total Successful</GlassTableCell>
                      <GlassTableCell>Missed %</GlassTableCell>
                    </GlassTableRow>
                  </GlassTableHeader>
                  <GlassTableBody>
                    {filteredMissedProposals.map((missed, index) => (
                      <GlassTableRow key={index}>
                        <GlassTableCell>{missed.dateTime}</GlassTableCell>
                        <GlassTableCell>{missed.slotNumber}</GlassTableCell>
                        <GlassTableCell>{missed.operatorName}</GlassTableCell>
                        <GlassTableCell className="text-red-600 font-medium">{missed.totalMissed}</GlassTableCell>
                        <GlassTableCell className="text-green-600 font-medium">{missed.totalSuccessful}</GlassTableCell>
                        <GlassTableCell>{missed.missedPercentage}</GlassTableCell>
                      </GlassTableRow>
                    ))}
                  </GlassTableBody>
                </GlassTable>
              </div>
            </div>
          ) : missedProposalsTable.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">🔍 No missed proposals found matching your search criteria</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">🎉 No missed proposals found!</p>
            </div>
          )}
        </GlassCard>
      )}

      {/* Operators Section */}
      <GlassCard hoverable={false}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🏆 Operators by Proposal Count</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Showing {filteredOperators.length} operators with proposals</p>
          </div>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search proposal operators by address or ENS name"
            className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredOperators.map((operator, index) => (
            <details key={operator.operator} className="border border-white/20 rounded-lg bg-white/30 dark:bg-white/5">
              <summary className="cursor-pointer p-4 hover:bg-white/40 dark:hover:bg-white/10 transition-colors duration-200">
                <span className="font-medium text-gray-900 dark:text-white">
                  #{index + 1} {operator.ensName ? `🏷️ ${operator.ensName} (${operator.operator})` : operator.operator} - {operator.proposalCount} proposals ({operator.totalValueEth.toFixed(4)} ETH)
                </span>
              </summary>
              
              <div className="p-4 border-t border-white/20 bg-white/20 dark:bg-white/5">
                {operator.ensName && (
                  <p className="mb-2 text-gray-900 dark:text-white"><strong>ENS:</strong> {operator.ensName}</p>
                )}
                <p className="mb-4 text-gray-900 dark:text-white"><strong>Address:</strong> <code className="bg-white/30 dark:bg-white/10 px-2 py-1 rounded text-gray-900 dark:text-white">{operator.operator}</code></p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">💰 Proposal Performance</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <li>• Proposals: <strong>{operator.proposalCount}</strong></li>
                      <li>• Total Value: <strong>{operator.totalValueEth.toFixed(4)} ETH</strong></li>
                      <li>• Average: <strong>{operator.averageValueEth.toFixed(4)} ETH</strong></li>
                      <li>• Highest: <strong>{operator.highestValueEth.toFixed(4)} ETH</strong></li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">⚡ Block Performance</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <li>• Gas Used: <strong>{operator.totalGasUsed.toLocaleString()}</strong></li>
                      <li>• Avg Gas Util: <strong>{operator.avgGasUtilization.toFixed(1)}%</strong></li>
                      <li>• Avg TXs: <strong>{operator.avgTxCount.toFixed(0)}</strong></li>
                      <li>• ETH/M Gas: <strong>{(operator.totalValueEth / (operator.totalGasUsed / 1e9)).toFixed(6)}</strong></li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">📅 Activity</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <li>• First: <strong>{new Date(operator.firstProposal).toLocaleDateString()}</strong></li>
                      <li>• Latest: <strong>{new Date(operator.lastProposal).toLocaleDateString()}</strong></li>
                      <li>• Proposals: <strong>{operator.proposalCount}</strong></li>
                    </ul>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">📋 Proposal History</h4>
                  <div className="overflow-x-auto">
                    <GlassTable>
                      <GlassTableHeader>
                        <GlassTableRow>
                          <GlassTableCell>Date</GlassTableCell>
                          <GlassTableCell>Slot</GlassTableCell>
                          <GlassTableCell>ETH Value</GlassTableCell>
                          <GlassTableCell>MEV Relay</GlassTableCell>
                          <GlassTableCell>Gas Used</GlassTableCell>
                          <GlassTableCell>TXs</GlassTableCell>
                        </GlassTableRow>
                      </GlassTableHeader>
                      <GlassTableBody>
                        {operator.proposals.map((proposal, pIndex) => (
                          <GlassTableRow key={pIndex}>
                            <GlassTableCell>{proposal.date}</GlassTableCell>
                            <GlassTableCell>{proposal.slot}</GlassTableCell>
                            <GlassTableCell className="font-medium text-green-600">{proposal.total_value_eth.toFixed(4)}</GlassTableCell>
                            <GlassTableCell>{proposal.mev_relay}</GlassTableCell>
                            <GlassTableCell>{proposal.gas_used.toLocaleString()}</GlassTableCell>
                            <GlassTableCell>{proposal.tx_count}</GlassTableCell>
                          </GlassTableRow>
                        ))}
                      </GlassTableBody>
                    </GlassTable>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </GlassCard>
      </div>
    </div>
  );
};

export default ProposalsTab;