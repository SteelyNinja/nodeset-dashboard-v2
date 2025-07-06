import React, { useState, useEffect } from 'react';
import { SyncCommitteeData, ValidatorData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';

interface SyncCommitteeMetrics {
  overallParticipation: number;
  totalPeriodsTracked: number;
  totalAttestations: number;
  successRate: number;
}

interface OperatorTableData {
  rank: number;
  address: string;
  ensName: string;
  participationRate: string;
  participationRaw: number;
  totalPeriods: number;
  totalSlots: string;
  successful: string;
  missed: string;
}

interface PeriodTableData {
  period: string;
  validators: number;
  totalSlots: string;
  successful: string;
  missed: string;
  participationRate: string;
  participationRaw: number;
}

interface DetailedTableData {
  period: number;
  operator: string;
  operatorAddress: string;
  validatorIndex: number;
  validatorPubkey: string;
  participationRate: string;
  totalSlots: string;
  successful: string;
  missed: string;
  startEpoch: number;
  endEpoch: number;
  partialPeriod: string;
}

const SyncCommitteeTab: React.FC = () => {
  const [syncCommitteeData, setSyncCommitteeData] = useState<SyncCommitteeData | null>(null);
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [operatorSearchTerm, setOperatorSearchTerm] = useState('');
  const [periodSearchTerm, setPeriodSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [syncData, validators] = await Promise.all([
          apiService.getSyncCommitteeData(),
          apiService.getValidatorData().catch(() => null)
        ]);
        
        setSyncCommitteeData(syncData);
        setValidatorData(validators);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sync committee data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatOperatorDisplay = (address: string, ensName?: string): string => {
    if (ensName) {
      return ensName;
    }
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const calculateMetrics = (): SyncCommitteeMetrics => {
    if (!syncCommitteeData?.metadata) {
      return { overallParticipation: 0, totalPeriodsTracked: 0, totalAttestations: 0, successRate: 0 };
    }

    const { overall_participation_rate, total_periods_tracked, total_attestations_tracked, total_successful_attestations } = syncCommitteeData.metadata;
    const successRate = total_attestations_tracked > 0 ? (total_successful_attestations / total_attestations_tracked) * 100 : 0;

    return {
      overallParticipation: overall_participation_rate,
      totalPeriodsTracked: total_periods_tracked,
      totalAttestations: total_attestations_tracked,
      successRate
    };
  };

  const getOperatorTableData = (): OperatorTableData[] => {
    if (!syncCommitteeData?.operator_summary) return [];

    const ensNames = validatorData?.ens_names || {};
    
    const data = Object.entries(syncCommitteeData.operator_summary).map(([address, stats]) => ({
      rank: 0,
      address,
      ensName: ensNames[address] || '',
      participationRate: `${stats.participation_rate.toFixed(2)}%`,
      participationRaw: stats.participation_rate,
      totalPeriods: stats.total_periods,
      totalSlots: stats.total_slots.toLocaleString(),
      successful: stats.total_successful.toLocaleString(),
      missed: stats.total_missed.toLocaleString()
    }));

    // Sort by Total Periods (highest first), then by Participation Rate for ties
    data.sort((a, b) => {
      if (b.totalPeriods !== a.totalPeriods) {
        return b.totalPeriods - a.totalPeriods;
      }
      return b.participationRaw - a.participationRaw;
    });

    // Assign ranks
    data.forEach((item, index) => {
      item.rank = index + 1;
    });

    return data;
  };

  const getPeriodTableData = (): PeriodTableData[] => {
    if (!syncCommitteeData?.period_summary) return [];

    const data = Object.entries(syncCommitteeData.period_summary).map(([period, stats]) => ({
      period,
      validators: stats.our_validators_count,
      totalSlots: stats.total_slots.toLocaleString(),
      successful: stats.total_successful.toLocaleString(),
      missed: stats.total_missed.toLocaleString(),
      participationRate: `${stats.participation_rate.toFixed(2)}%`,
      participationRaw: stats.participation_rate
    }));

    // Sort by period (descending - newest first)
    data.sort((a, b) => parseInt(b.period) - parseInt(a.period));

    return data;
  };

  const getDetailedTableData = (): DetailedTableData[] => {
    if (!syncCommitteeData?.detailed_stats) return [];

    const ensNames = validatorData?.ens_names || {};

    const data = syncCommitteeData.detailed_stats.map(entry => {
      const ensName = ensNames[entry.operator];
      const operatorDisplay = ensName || `${entry.operator.slice(0, 8)}...${entry.operator.slice(-6)}`;

      return {
        period: entry.period,
        operator: operatorDisplay,
        operatorAddress: entry.operator,
        validatorIndex: entry.validator_index,
        validatorPubkey: entry.validator_pubkey,
        participationRate: `${entry.participation_rate.toFixed(2)}%`,
        totalSlots: entry.total_slots.toLocaleString(),
        successful: entry.successful_attestations.toLocaleString(),
        missed: entry.missed_attestations.toLocaleString(),
        startEpoch: entry.start_epoch,
        endEpoch: entry.end_epoch,
        partialPeriod: entry.is_partial_period ? 'Yes' : 'No'
      };
    });

    // Sort by period (descending), then by participation rate (descending)
    data.sort((a, b) => {
      if (b.period !== a.period) {
        return b.period - a.period;
      }
      return parseFloat(b.participationRate) - parseFloat(a.participationRate);
    });

    return data;
  };

  const getFilteredOperatorData = (): OperatorTableData[] => {
    const data = getOperatorTableData();
    
    if (!operatorSearchTerm) return data;
    
    const lowerSearchTerm = operatorSearchTerm.toLowerCase();
    return data.filter(item => 
      item.address.toLowerCase().includes(lowerSearchTerm) ||
      item.ensName.toLowerCase().includes(lowerSearchTerm)
    );
  };

  const getFilteredPeriodData = (): PeriodTableData[] => {
    const data = getPeriodTableData();
    
    if (!periodSearchTerm) return data;
    
    const lowerSearchTerm = periodSearchTerm.toLowerCase();
    return data.filter(item => 
      item.period.toLowerCase().includes(lowerSearchTerm)
    );
  };

  const getFilteredDetailedData = (): DetailedTableData[] => {
    const data = getDetailedTableData();
    
    if (!searchTerm) return data;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter(item => 
      item.operatorAddress.toLowerCase().includes(lowerSearchTerm) ||
      item.operator.toLowerCase().includes(lowerSearchTerm)
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
  if (!syncCommitteeData) return <ErrorMessage message="No sync committee data available" />;

  const metrics = calculateMetrics();
  const filteredOperatorData = getFilteredOperatorData();
  const filteredPeriodData = getFilteredPeriodData();
  const filteredDetailedData = getFilteredDetailedData();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📡 Sync Committee Participation Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Analysis of validator participation in Ethereum sync committees
        </p>
      </div>
      
      <div className="space-y-6">

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Overall Participation</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.overallParticipation.toFixed(2)}%</div>
          <div className="text-xs text-gray-400">Average participation rate</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Total Periods Tracked</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.totalPeriodsTracked.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Sync committee periods</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Total Attestations</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.totalAttestations.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Sync committee attestations</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-medium text-gray-500 mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-black dark:text-white">{metrics.successRate.toFixed(2)}%</div>
          <div className="text-xs text-gray-400">Successful attestations</div>
        </GlassCard>
      </div>

      {/* Operator Rankings Section */}
      <GlassCard size="large" hoverable={false}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🏆 Operator Participation Rankings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Operators ranked by sync committee participation rate</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(getOperatorTableData(), `sync_committee_operators_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`)}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search operators by address or ENS name"
            className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={operatorSearchTerm}
            onChange={(e) => setOperatorSearchTerm(e.target.value)}
          />
          {operatorSearchTerm && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Showing {filteredOperatorData.length} operators matching '{operatorSearchTerm}'
            </p>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell>Rank</GlassTableCell>
                  <GlassTableCell>Address</GlassTableCell>
                  <GlassTableCell>ENS / Discord Name</GlassTableCell>
                  <GlassTableCell>Participation Rate</GlassTableCell>
                  <GlassTableCell>Total Periods</GlassTableCell>
                  <GlassTableCell>Total Slots</GlassTableCell>
                  <GlassTableCell>Successful</GlassTableCell>
                  <GlassTableCell>Missed</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {filteredOperatorData.map((operator, index) => (
                  <GlassTableRow key={index}>
                    <GlassTableCell className="font-medium">{operator.rank}</GlassTableCell>
                    <GlassTableCell className="font-mono text-xs">{operator.address}</GlassTableCell>
                    <GlassTableCell>{operator.ensName || '-'}</GlassTableCell>
                    <GlassTableCell className="font-medium text-green-600">{operator.participationRate}</GlassTableCell>
                    <GlassTableCell>{operator.totalPeriods}</GlassTableCell>
                    <GlassTableCell>{operator.totalSlots}</GlassTableCell>
                    <GlassTableCell className="text-green-600">{operator.successful}</GlassTableCell>
                    <GlassTableCell className="text-red-600">{operator.missed}</GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
        </div>
      </GlassCard>

      {/* Period-by-Period Analysis Section */}
      <GlassCard size="large" hoverable={false}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📊 Period-by-Period Analysis</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sync committee performance across different periods</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(getPeriodTableData(), `sync_committee_periods_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`)}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search periods by period number"
            className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={periodSearchTerm}
            onChange={(e) => setPeriodSearchTerm(e.target.value)}
          />
          {periodSearchTerm && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Showing {filteredPeriodData.length} periods matching '{periodSearchTerm}'
            </p>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell>Period</GlassTableCell>
                  <GlassTableCell>Validators</GlassTableCell>
                  <GlassTableCell>Total Slots</GlassTableCell>
                  <GlassTableCell>Successful</GlassTableCell>
                  <GlassTableCell>Missed</GlassTableCell>
                  <GlassTableCell>Participation Rate</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {filteredPeriodData.map((period, index) => (
                  <GlassTableRow key={index}>
                    <GlassTableCell className="font-medium">{period.period}</GlassTableCell>
                    <GlassTableCell>{period.validators}</GlassTableCell>
                    <GlassTableCell>{period.totalSlots}</GlassTableCell>
                    <GlassTableCell className="text-green-600">{period.successful}</GlassTableCell>
                    <GlassTableCell className="text-red-600">{period.missed}</GlassTableCell>
                    <GlassTableCell className="font-medium text-blue-600">{period.participationRate}</GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
        </div>
      </GlassCard>

      {/* Detailed Validator Analysis Section */}
      <GlassCard size="large" hoverable={false}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🔍 Detailed Validator Analysis</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Individual validator performance in sync committees</p>
          </div>
          <GlassButton
            onClick={() => downloadCSV(filteredDetailedData, `sync_committee_detailed_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`)}
            variant="primary"
            size="sm"
          >
            📥 Download CSV
          </GlassButton>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search by operator address or ENS name"
            className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Showing {filteredDetailedData.length} records matching '{searchTerm}'
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell>Period</GlassTableCell>
                  <GlassTableCell>Operator</GlassTableCell>
                  <GlassTableCell>Validator Index</GlassTableCell>
                  <GlassTableCell>Participation Rate</GlassTableCell>
                  <GlassTableCell>Total Slots</GlassTableCell>
                  <GlassTableCell>Successful</GlassTableCell>
                  <GlassTableCell>Missed</GlassTableCell>
                  <GlassTableCell>Start Epoch</GlassTableCell>
                  <GlassTableCell>End Epoch</GlassTableCell>
                  <GlassTableCell>Partial Period</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {filteredDetailedData.map((record, index) => (
                  <GlassTableRow key={index}>
                    <GlassTableCell className="font-medium">{record.period}</GlassTableCell>
                    <GlassTableCell>{record.operator}</GlassTableCell>
                    <GlassTableCell>{record.validatorIndex}</GlassTableCell>
                    <GlassTableCell className="font-medium text-green-600">{record.participationRate}</GlassTableCell>
                    <GlassTableCell>{record.totalSlots}</GlassTableCell>
                    <GlassTableCell className="text-green-600">{record.successful}</GlassTableCell>
                    <GlassTableCell className="text-red-600">{record.missed}</GlassTableCell>
                    <GlassTableCell>{record.startEpoch}</GlassTableCell>
                    <GlassTableCell>{record.endEpoch}</GlassTableCell>
                    <GlassTableCell>{record.partialPeriod}</GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
        </div>
      </GlassCard>
      </div>
    </div>
  );
};

export default SyncCommitteeTab;