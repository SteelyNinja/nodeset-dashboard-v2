import React, { useState, useEffect, useCallback } from 'react';
import { ValidatorPerformanceData, ExitData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';
import ScatterChartComponent from '../charts/ScatterChart';
import BarChartComponent from '../charts/BarChart';
import PieChartComponent from '../charts/PieChart';
import LineChartComponent from '../charts/LineChart';

interface PerformanceData {
  operator: string;
  address: string;
  performance: number;
  validator_count: number;
  category: string;
  active: number;
  total: number;
  exited: number;
  ens_name: string;
}

interface PerformanceSummary {
  average: number;
  median: number;
  best: number;
  worst: number;
  stdDev: number;
}

interface AttestationPerformanceData {
  operator: string;
  address: string;
  ens_name: string;
  regular_performance_gwei: number;
  attestation_validators: number;
  excluded_validators: number;
  total_validators: number;
  relative_score: number;
}

// Performance category color mapping
const getPerformanceColor = (performance: number): string => {
  if (performance >= 99.5) return '#17a2b8'; // Excellent - teal
  if (performance >= 98.5) return '#28a745'; // Good - green  
  if (performance >= 95) return '#ffc107';   // Average - yellow
  return '#dc3545';                          // Poor - red
};

const getPerformanceCategory = (performance: number): string => {
  if (performance >= 99.5) return 'Excellent';
  if (performance >= 98.5) return 'Good';
  if (performance >= 95) return 'Average';
  return 'Poor';
};

const PerformanceTab: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [histogramData, setHistogramData] = useState<any[]>([]);
  const [attestation7dData, setAttestation7dData] = useState<AttestationPerformanceData[]>([]);
  const [attestation31dData, setAttestation31dData] = useState<AttestationPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPerformanceData, setHasPerformanceData] = useState(false);
  const [hasAttestationData, setHasAttestationData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTerm7d, setSearchTerm7d] = useState('');
  const [searchTerm31d, setSearchTerm31d] = useState('');

  // Calculate attestation-only performance analysis (matching original Streamlit logic exactly)
  const calculateAttestationPerformance = (
    validators: any,
    proposalsData: any,
    syncCommitteeData: any,
    days: number,
    validatorData: any // Add main validator data for ENS names
  ): AttestationPerformanceData[] => {
    const now = Date.now() / 1000;
    const lookbackDays = days === 7 ? 10 : 34; // 10 days for 7-day analysis, 34 for 31-day
    const lookbackTimestamp = now - (lookbackDays * 24 * 60 * 60);
    
    // Activity requirement timestamps (matching original logic)
    const activityDays = days === 7 ? 7 : 32; // Must be active for 7+ days for 7-day analysis, 32+ days for 31-day
    const activityTimestamp = now - (activityDays * 24 * 60 * 60);

    console.log(`Calculating ${days}-day attestation performance, excluding proposals/sync from last ${lookbackDays} days`);
    
    // Debug: Check the ENS names data structure from validatorData
    console.log(`=== ${days}-day Attestation Performance Debug ===`);
    console.log('validatorData parameter passed:', !!validatorData);
    console.log('validatorData keys:', validatorData ? Object.keys(validatorData).slice(0, 10) : 'null');
    console.log('ens_names exists:', !!validatorData?.ens_names);
    console.log('ens_names type:', typeof validatorData?.ens_names);
    console.log('ens_names count:', validatorData?.ens_names ? Object.keys(validatorData.ens_names).length : 0);
    console.log('ens_names sample entries:', validatorData?.ens_names ? Object.entries(validatorData.ens_names).slice(0, 3) : 'none');
    
    // Also debug the first validators data structure
    if (validators?.validators) {
      const firstValidatorKey = Object.keys(validators.validators)[0];
      const firstValidator = validators.validators[firstValidatorKey];
      console.log('First validator structure:', {
        key: firstValidatorKey,
        operator: firstValidator?.operator,
        hasOperator: !!firstValidator?.operator
      });
    }

    // Get validators with proposals in lookback window
    const validatorsWithProposals = new Set<number>();
    if (proposalsData?.proposals) {
      console.log(`Processing ${proposalsData.proposals.length} proposals`);
      proposalsData.proposals.forEach((proposal: any, index: number) => {
        if (index < 3) { // Log first few proposals for debugging
          console.log(`Proposal ${index}:`, {
            timestamp: proposal.timestamp,
            validator_index: proposal.validator_index,
            proposer_index: proposal.proposer_index,
            timestampDate: proposal.timestamp ? new Date(proposal.timestamp * 1000).toISOString() : 'no timestamp'
          });
        }
        
        const proposalTimestamp = proposal.timestamp || 0;
        if (proposalTimestamp >= lookbackTimestamp) {
          const validatorIndex = proposal.validator_index || proposal.proposer_index;
          if (validatorIndex) {
            validatorsWithProposals.add(validatorIndex);
          }
        }
      });
    } else {
      console.log('No proposals data available');
    }

    // Get validators with sync committee duties in lookback window (using end_slot as per original)
    const validatorsWithSyncDuties = new Set<number>();
    if (syncCommitteeData?.detailed_stats) {
      const GENESIS_TIME = 1606824023; // Ethereum beacon chain genesis time
      console.log(`Processing ${syncCommitteeData.detailed_stats.length} sync committee entries`);
      
      syncCommitteeData.detailed_stats.forEach((stat: any, index: number) => {
        if (index < 3) { // Log first few sync entries for debugging
          const endTimestamp = stat.end_slot ? GENESIS_TIME + (stat.end_slot * 12) : 0;
          console.log(`Sync entry ${index}:`, {
            validator_index: stat.validator_index,
            end_slot: stat.end_slot,
            endTimestamp: endTimestamp,
            endDate: endTimestamp ? new Date(endTimestamp * 1000).toISOString() : 'no end slot'
          });
        }
        
        if (stat.validator_index && stat.end_slot) {
          const endTimestamp = GENESIS_TIME + (stat.end_slot * 12); // Genesis + slot * 12 seconds
          if (endTimestamp >= lookbackTimestamp) {
            validatorsWithSyncDuties.add(stat.validator_index);
          }
        }
      });
    } else {
      console.log('No sync committee data available');
    }

    // Combine excluded validators (those with proposals or sync duties)
    const excludedValidators = new Set<number>();
    validatorsWithProposals.forEach(val => excludedValidators.add(val));
    validatorsWithSyncDuties.forEach(val => excludedValidators.add(val));

    console.log(`Found ${validatorsWithProposals.size} validators with proposals, ${validatorsWithSyncDuties.size} with sync duties`);
    console.log(`Total excluded validators: ${excludedValidators.size}`);

    // Group validators by operator
    const operatorData: Record<string, {
      totalValidators: number;
      attestationOnlyValidators: number;
      excludedValidators: number;
      regularPerformances: number[]; // Array to calculate average (excluding zeros)
      operator: string;
      address: string;
      ens_name: string;
    }> = {};

    if (validators?.validators) {
      console.log(`Processing ${Object.keys(validators.validators).length} validators`);
      let processedCount = 0;
      let excludedCount = 0;
      let activeValidatorCount = 0;
      
      Object.entries(validators.validators).forEach(([validatorIndex, individualValidator]: [string, any], index) => {
        const operator = individualValidator.operator || 'Unknown';
        const operatorAddress = individualValidator.operator || 'Unknown';
        
 
        
        // Use correct performance field based on analysis period
        const performanceGwei = days === 7 
          ? (individualValidator.performance_metrics?.performance_7d || 0)
          : (individualValidator.performance_metrics?.performance_31d || 0);
          
        const validatorIndexNum = individualValidator.validator_index; // Use actual validator index from data, not the hex key
        
        
        // Check activity requirement (must be active long enough)
        const activationTimestamp = individualValidator.activation_data?.activation_timestamp || 0;
        if (activationTimestamp > activityTimestamp) {
          return; // Skip validators that haven't been active long enough
        }
        
        activeValidatorCount++;

        // Initialize operator data if needed
        if (!operatorData[operator]) {
          // Get ENS name from validatorData (main validator cache with ENS names)
          let ensName = validatorData?.ens_names?.[operator] || '';
          
          // If no ENS name found, try case-insensitive lookup (addresses might have different casing)
          if (!ensName && validatorData?.ens_names) {
            const ensKeys = Object.keys(validatorData.ens_names);
            const matchingKey = ensKeys.find(key => key.toLowerCase() === operator.toLowerCase());
            if (matchingKey) {
              ensName = validatorData.ens_names[matchingKey];
            }
          }
          
          operatorData[operator] = {
            totalValidators: 0,
            attestationOnlyValidators: 0,
            excludedValidators: 0,
            regularPerformances: [],
            operator: operator,
            address: operatorAddress,
            ens_name: ensName
          };
        }

        operatorData[operator].totalValidators++;
        processedCount++;

        // Check if this validator should be excluded (had proposals or sync duties)
        if (excludedValidators.has(validatorIndexNum)) {
          operatorData[operator].excludedValidators++;
          excludedCount++;
          if (index < 10) console.log(`EXCLUDED validator ${validatorIndex} (${validatorIndexNum})`);
        } else if (performanceGwei > 0) {
          // This is an attestation-only validator with positive performance
          operatorData[operator].attestationOnlyValidators++;
          operatorData[operator].regularPerformances.push(performanceGwei);
        }
      });
      
      console.log(`Processed ${processedCount} validators, ${activeValidatorCount} met activity requirements, ${excludedCount} were excluded`);
    }

    // Calculate average performance per validator for each operator (attestation-only validators only)
    const operatorResults = Object.values(operatorData)
      .filter(op => op.regularPerformances.length > 0) // Only operators with attestation-only validators with positive performance
      .map(op => {
        // Calculate average performance excluding zero rewards (matching original logic)
        const regularPerformances = op.regularPerformances.filter(p => p > 0);
        const averagePerformance = regularPerformances.length > 0 
          ? regularPerformances.reduce((sum, p) => sum + p, 0) / regularPerformances.length
          : 0;
          
        return {
          operator: op.operator,
          address: op.address,
          ens_name: op.ens_name,
          regular_performance_gwei: averagePerformance,
          attestation_validators: op.attestationOnlyValidators,
          excluded_validators: op.excludedValidators,
          total_validators: op.totalValidators,
          average_performance_per_validator: averagePerformance
        };
      })
      .sort((a, b) => b.average_performance_per_validator - a.average_performance_per_validator);

    // Calculate relative scores (percentage of highest performer)
    const highestPerformance = operatorResults.length > 0 ? operatorResults[0].average_performance_per_validator : 1;
    
    const results: AttestationPerformanceData[] = operatorResults.map(op => ({
      operator: op.operator,
      address: op.address,
      ens_name: op.ens_name,
      regular_performance_gwei: op.regular_performance_gwei, // Average performance per validator
      attestation_validators: op.attestation_validators,
      excluded_validators: op.excluded_validators,
      total_validators: op.total_validators,
      relative_score: highestPerformance > 0 ? (op.average_performance_per_validator / highestPerformance) * 100 : 0
    }));

    
    return results;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [validatorData, exitData] = await Promise.all([
        apiService.getValidatorData(),
        apiService.getData<ExitData>('exit-data')
      ]);

      // Try to fetch performance data
      try {
        const performanceResponse = await apiService.getPerformanceAnalysis();
        
        if (performanceResponse && performanceResponse.operator_details) {
          // We have performance data
          setHasPerformanceData(true);
          
          // Create a map of exits by operator
          const operatorExits: Record<string, number> = {};
          if (exitData?.operators_with_exits) {
            exitData.operators_with_exits.forEach((op) => {
              operatorExits[op.operator] = op.exits || 0;
            });
          }

          const data = performanceResponse.operator_details.map((item) => {
            const exits = operatorExits[item.full_address] || 0;
            const totalValidators = validatorData.operator_validators[item.full_address] || item.validator_count;
            const activeValidators = Math.max(0, totalValidators - exits);
            const ensName = validatorData.ens_names?.[item.full_address] || '';
            
            return {
              operator: item.operator,
              address: item.full_address,
              performance: item.performance,
              validator_count: activeValidators,
              category: getPerformanceCategory(item.performance),
              active: activeValidators,
              total: totalValidators,
              exited: exits,
              ens_name: ensName
            };
          });

          // Sort by performance (high to low), then by active validators (high to low) as tiebreaker
          data.sort((a, b) => {
            if (b.performance !== a.performance) {
              return b.performance - a.performance; // Primary sort: performance descending
            }
            return b.active - a.active; // Secondary sort: active validators descending
          });
          
          setPerformanceData(data);
          
          // Calculate summary statistics
          const performances = data.map(d => d.performance);
          if (performances.length > 0) {
            const sorted = [...performances].sort((a, b) => a - b);
            const median = sorted.length % 2 === 0 
              ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
              : sorted[Math.floor(sorted.length / 2)];
            
            const average = performances.reduce((sum, p) => sum + p, 0) / performances.length;
            const variance = performances.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / performances.length;
            const stdDev = Math.sqrt(variance);
            
            setPerformanceSummary({
              average,
              median,
              best: Math.max(...performances),
              worst: Math.min(...performances),
              stdDev
            });
          }
          
          // Create histogram data aligned with performance categories (low to high)
          const ranges = [
            { range: '<95% (Poor)', min: 0, max: 95, color: '#ef4444' },
            { range: '95-98% (Average)', min: 95, max: 98, color: '#f59e0b' },
            { range: '98-98.5%', min: 98, max: 98.5, color: '#eab308' },
            { range: '98.5-99% (Good)', min: 98.5, max: 99, color: '#22c55e' },
            { range: '99-99.5%', min: 99, max: 99.5, color: '#16a34a' },
            { range: '≥99.5% (Excellent)', min: 99.5, max: 100, color: '#3b82f6' }
          ];
          
          const histogram = ranges.map(range => ({
            name: range.range,
            count: performances.filter(p => p >= range.min && (p < range.max || (range.max === 100 && p <= 100))).length
          }));
          
          setHistogramData(histogram);
          
        } else {
          setHasPerformanceData(false);
        }
      } catch (apiError) {
        console.log('Performance API not available:', apiError);
        setHasPerformanceData(false);
      }

      // Fetch attestation-only performance data
      try {
        const [validatorPerformanceData, proposalsData, syncCommitteeData] = await Promise.all([
          apiService.getData<ValidatorPerformanceData>('validator-performance'),
          apiService.getData('proposals'),
          apiService.getData('sync-committee')
        ]);

        if (validatorPerformanceData?.validators) {
          setHasAttestationData(true);
          
          
          // Calculate 7-day and 31-day attestation performance
          const attestation7d = calculateAttestationPerformance(validatorPerformanceData, proposalsData, syncCommitteeData, 7, validatorData);
          const attestation31d = calculateAttestationPerformance(validatorPerformanceData, proposalsData, syncCommitteeData, 31, validatorData);
          
          console.log('Attestation 7d data:', attestation7d.length, 'operators');
          console.log('Attestation 31d data:', attestation31d.length, 'operators');
          
          setAttestation7dData(attestation7d);
          setAttestation31dData(attestation31d);
        } else {
          setHasAttestationData(false);
        }
      } catch (attestationError) {
        console.error('Attestation performance data error:', attestationError);
        setHasAttestationData(false);
      }

    } catch (err) {
      console.error('Failed to fetch performance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const downloadCSV = () => {
    if (!hasPerformanceData) return;
    
    const headers = ['Rank', 'Address', 'ENS / Discord Name', 'Performance', 'Category', 'Active', 'Total', 'Exited'];
    const csvContent = [
      headers.join(','),
      ...performanceData.map((op, index) => [
        index + 1,
        op.address,
        op.ens_name || '', // Use actual ENS name from data
        `${op.performance.toFixed(2)}%`,
        op.category,
        op.active,
        op.total,
        op.exited
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `nodeset_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAttestationCSV = (data: AttestationPerformanceData[], period: string) => {
    if (!data || data.length === 0) return;
    
    const headers = ['Rank', 'Address', 'ENS / Discord Name', 'Avg Performance', 'Attestation Validators', 'Excluded (Proposals/Sync)', 'Total Validators', 'Relative Score (%)'];
    const csvContent = [
      headers.join(','),
      ...data.map((op, index) => [
        index + 1,
        op.address,
        op.ens_name || '',
        Math.round(op.regular_performance_gwei).toLocaleString(),
        op.attestation_validators,
        op.excluded_validators,
        op.total_validators,
        op.relative_score.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `nodeset_attestation_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-8" />;
  }

  // Filter and sort performance data
  const filteredAndSortedData = performanceData
    .filter(operator => 
      operator.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.ens_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice() // Create a copy using slice()
    .sort((a, b) => b.performance - a.performance); // Sort by performance descending

  // Filter attestation data
  const filtered7dData = attestation7dData
    .filter(operator => 
      operator.address.toLowerCase().includes(searchTerm7d.toLowerCase()) ||
      operator.operator.toLowerCase().includes(searchTerm7d.toLowerCase()) ||
      operator.ens_name.toLowerCase().includes(searchTerm7d.toLowerCase())
    );

  const filtered31dData = attestation31dData
    .filter(operator => 
      operator.address.toLowerCase().includes(searchTerm31d.toLowerCase()) ||
      operator.operator.toLowerCase().includes(searchTerm31d.toLowerCase()) ||
      operator.ens_name.toLowerCase().includes(searchTerm31d.toLowerCase())
    );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
          <Icon name="performance" size="lg" color="primary" />
          Operator Performance Analysis (24 hours)
        </h1>
        <div className="
          bg-glass-light dark:bg-glass-dark 
          backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
          border border-gray-200 dark:border-white/15
          rounded-2xl 
          shadow-glass-light dark:shadow-glass-dark
          p-6
          bg-info-light/30 dark:bg-info-dark/20 border-l-4 border-info
        ">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="info" size="lg" color="primary" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-200">
                24 hour data refreshes every hour. Scroll down for 7 / 31 day data
              </p>
            </div>
          </div>
        </div>
      </div>

      {!hasPerformanceData ? (
        <div className="
          bg-glass-light dark:bg-glass-dark 
          backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
          border border-gray-200 dark:border-white/15
          rounded-2xl 
          shadow-glass-light dark:shadow-glass-dark
          p-6
          bg-info-light/30 dark:bg-info-dark/20 border border-info/30
        ">
          <p className="text-blue-800 dark:text-blue-200 text-center">
            No performance data available in cache file.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Scatter Plot */}
          <ScatterChartComponent
            data={performanceData}
            title="Operator Performance vs Validator Count"
            xDataKey="validator_count"
            yDataKey="performance"
            xAxisLabel="Number of Validators"
            yAxisLabel="Performance (%)"
            getColor={(entry) => getPerformanceColor(entry.performance)}
            yDomain={performanceData.length > 0 ? 
              [Math.max(0, Math.min(...performanceData.map(d => d.performance)) - 1), 'auto'] : 
              ['auto', 'auto']
            }
            legend={
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#17a2b8' }}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Excellent (≥99.5%)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28a745' }}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Good (≥98.5%)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ffc107' }}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Average (≥95%)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dc3545' }}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Poor (&lt;95%)</span>
                </div>
              </div>
            }
          />

          {/* Histogram and Summary Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Histogram */}
            <BarChartComponent
              data={histogramData}
              title="Performance Distribution"
              dataKey="count"
              color="#4ECDC4"
              xAxisDataKey="name"
              xAxisLabel="Performance Range"
              yAxisLabel="Number of Operators"
            />

            {/* Enhanced Performance Summary Cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <Icon name="metrics" size="lg" color="primary" className="inline mr-2" />Performance Statistics
              </h3>
              
              {performanceSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Average Performance */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${performanceSummary.average >= 99 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      performanceSummary.average >= 98 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon 
                        name="metrics" 
                        size="lg" 
                        color={
                          performanceSummary.average >= 99 ? 'success' :
                          performanceSummary.average >= 98 ? 'warning' :
                          'danger'
                        }
                      />
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        performanceSummary.average >= 99 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        performanceSummary.average >= 98 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {performanceSummary.average >= 99 ? 'Excellent' : performanceSummary.average >= 98 ? 'Good' : 'Needs Attention'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      performanceSummary.average >= 99 ? 'text-green-700 dark:text-green-300' :
                      performanceSummary.average >= 98 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {performanceSummary.average.toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      performanceSummary.average >= 99 ? 'text-green-600 dark:text-green-400' :
                      performanceSummary.average >= 98 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Average Performance
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      performanceSummary.average >= 99 ? 'bg-green-200 dark:bg-green-800' :
                      performanceSummary.average >= 98 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          performanceSummary.average >= 99 ? 'bg-green-500' :
                          performanceSummary.average >= 98 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(performanceSummary.average, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Median Performance */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${performanceSummary.median >= 99 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      performanceSummary.median >= 98 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon 
                        name="metrics" 
                        size="lg" 
                        color={
                          performanceSummary.median >= 99 ? 'success' :
                          performanceSummary.median >= 98 ? 'warning' :
                          'danger'
                        }
                      />
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        performanceSummary.median >= 99 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        performanceSummary.median >= 98 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {performanceSummary.median >= 99 ? 'Excellent' : performanceSummary.median >= 98 ? 'Good' : 'Needs Attention'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      performanceSummary.median >= 99 ? 'text-green-700 dark:text-green-300' :
                      performanceSummary.median >= 98 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {performanceSummary.median.toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      performanceSummary.median >= 99 ? 'text-green-600 dark:text-green-400' :
                      performanceSummary.median >= 98 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Median Performance
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      performanceSummary.median >= 99 ? 'bg-green-200 dark:bg-green-800' :
                      performanceSummary.median >= 98 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          performanceSummary.median >= 99 ? 'bg-green-500' :
                          performanceSummary.median >= 98 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(performanceSummary.median, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Best Performance */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${performanceSummary.best >= 99 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      performanceSummary.best >= 98 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl ${
                        performanceSummary.best >= 99 ? 'text-green-600 dark:text-green-400' :
                        performanceSummary.best >= 98 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}><Icon name="trophy" size="lg" color="warning" /></span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        performanceSummary.best >= 99 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        performanceSummary.best >= 98 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        Best
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      performanceSummary.best >= 99 ? 'text-green-700 dark:text-green-300' :
                      performanceSummary.best >= 98 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {performanceSummary.best.toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      performanceSummary.best >= 99 ? 'text-green-600 dark:text-green-400' :
                      performanceSummary.best >= 98 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Best Performance
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      performanceSummary.best >= 99 ? 'bg-green-200 dark:bg-green-800' :
                      performanceSummary.best >= 98 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          performanceSummary.best >= 99 ? 'bg-green-500' :
                          performanceSummary.best >= 98 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(performanceSummary.best, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Worst Performance */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${performanceSummary.worst >= 98 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      performanceSummary.worst >= 95 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl ${
                        performanceSummary.worst >= 98 ? 'text-green-600 dark:text-green-400' :
                        performanceSummary.worst >= 95 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}><Icon name="warning" size="lg" color="warning" /></span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        performanceSummary.worst >= 98 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        performanceSummary.worst >= 95 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {performanceSummary.worst >= 98 ? 'Good' : performanceSummary.worst >= 95 ? 'Concerning' : 'Critical'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      performanceSummary.worst >= 98 ? 'text-green-700 dark:text-green-300' :
                      performanceSummary.worst >= 95 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {performanceSummary.worst.toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      performanceSummary.worst >= 98 ? 'text-green-600 dark:text-green-400' :
                      performanceSummary.worst >= 95 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Worst Performance
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      performanceSummary.worst >= 98 ? 'bg-green-200 dark:bg-green-800' :
                      performanceSummary.worst >= 95 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          performanceSummary.worst >= 98 ? 'bg-green-500' :
                          performanceSummary.worst >= 95 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(performanceSummary.worst, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Standard Deviation */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${performanceSummary.stdDev <= 1 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      performanceSummary.stdDev <= 3 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl ${
                        performanceSummary.stdDev <= 1 ? 'text-green-600 dark:text-green-400' :
                        performanceSummary.stdDev <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>📏</span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        performanceSummary.stdDev <= 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        performanceSummary.stdDev <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {performanceSummary.stdDev <= 1 ? 'Consistent' : performanceSummary.stdDev <= 3 ? 'Variable' : 'Volatile'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      performanceSummary.stdDev <= 1 ? 'text-green-700 dark:text-green-300' :
                      performanceSummary.stdDev <= 3 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {performanceSummary.stdDev.toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      performanceSummary.stdDev <= 1 ? 'text-green-600 dark:text-green-400' :
                      performanceSummary.stdDev <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Standard Deviation
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      performanceSummary.stdDev <= 1 ? 'bg-green-200 dark:bg-green-800' :
                      performanceSummary.stdDev <= 3 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          performanceSummary.stdDev <= 1 ? 'bg-green-500' :
                          performanceSummary.stdDev <= 3 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(performanceSummary.stdDev * 10, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Network Consistency Score */}
                  <div className={`
                    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                    rounded-xl 
                    shadow-glass-light dark:shadow-glass-dark
                    p-4 transform hover:scale-105 transition-all duration-300
                    ${(performanceSummary.best - performanceSummary.worst) <= 5 ? 
                      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
                      (performanceSummary.best - performanceSummary.worst) <= 10 ? 
                      'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
                      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50'
                    }
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon 
                        name="chart" 
                        size="lg" 
                        color={
                          (performanceSummary.best - performanceSummary.worst) <= 5 ? 'success' :
                          (performanceSummary.best - performanceSummary.worst) <= 10 ? 'warning' :
                          'danger'
                        }
                      />
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (performanceSummary.best - performanceSummary.worst) <= 5 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                        (performanceSummary.best - performanceSummary.worst) <= 10 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {(performanceSummary.best - performanceSummary.worst) <= 5 ? 'Tight' : 
                         (performanceSummary.best - performanceSummary.worst) <= 10 ? 'Moderate' : 'Wide'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      (performanceSummary.best - performanceSummary.worst) <= 5 ? 'text-green-700 dark:text-green-300' :
                      (performanceSummary.best - performanceSummary.worst) <= 10 ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {(performanceSummary.best - performanceSummary.worst).toFixed(2)}%
                    </div>
                    <div className={`text-xs uppercase tracking-wider ${
                      (performanceSummary.best - performanceSummary.worst) <= 5 ? 'text-green-600 dark:text-green-400' :
                      (performanceSummary.best - performanceSummary.worst) <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      Performance Range
                    </div>
                    <div className={`mt-2 rounded-full h-2 ${
                      (performanceSummary.best - performanceSummary.worst) <= 5 ? 'bg-green-200 dark:bg-green-800' :
                      (performanceSummary.best - performanceSummary.worst) <= 10 ? 'bg-yellow-200 dark:bg-yellow-800' :
                      'bg-red-200 dark:bg-red-800'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (performanceSummary.best - performanceSummary.worst) <= 5 ? 'bg-green-500' :
                          (performanceSummary.best - performanceSummary.worst) <= 10 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((performanceSummary.best - performanceSummary.worst) * 5, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* New Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Categories Pie Chart */}
            <PieChartComponent
              data={[
                { name: 'Excellent', value: performanceData.filter(d => d.category === 'Excellent').length, color: '#10b981' },
                { name: 'Good', value: performanceData.filter(d => d.category === 'Good').length, color: '#3b82f6' },
                { name: 'Average', value: performanceData.filter(d => d.category === 'Average').length, color: '#f59e0b' },
                { name: 'Poor', value: performanceData.filter(d => d.category === 'Poor').length, color: '#ef4444' }
              ]}
              title="Performance Categories"
              showLegend={true}
            />

            {/* Performance Trend Line Chart */}
            <LineChartComponent
              data={performanceData.slice().sort((a, b) => a.validator_count - b.validator_count).slice(0, 20)}
              title="Performance by Operator Size"
              lines={[{
                dataKey: 'performance',
                stroke: '#8884d8',
                strokeWidth: 2,
                name: 'Performance',
                dot: false
              }]}
              xAxisDataKey="validator_count"
              xAxisLabel="Number of Validators"
              yAxisLabel="Performance (%)"
              yDomain={performanceData.length > 0 ? 
                [Math.max(0, Math.min(...performanceData.map(d => d.performance)) - 1), 'auto'] : 
                ['auto', 'auto']
              }
              showLegend={false}
            />
          </div>

          {/* Performance Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <Icon name="trophy" size="lg" color="primary" className="inline mr-2" />Operators by Performance
              </h3>
              <div className="w-72">
                <input
                  type="text"
                  placeholder="Search by address, operator name, or ENS name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                    placeholder-gray-500 dark:placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Showing {filteredAndSortedData.length} of {performanceData.length} operators (sorted by performance)
            </div>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              <GlassTable>
                <GlassTableHeader>
                  <GlassTableRow>
                    <GlassTableCell header>Rank</GlassTableCell>
                    <GlassTableCell header>Address</GlassTableCell>
                    <GlassTableCell header>ENS / Discord Name</GlassTableCell>
                    <GlassTableCell header>Performance</GlassTableCell>
                    <GlassTableCell header>Category</GlassTableCell>
                    <GlassTableCell header>Active</GlassTableCell>
                    <GlassTableCell header>Total</GlassTableCell>
                    <GlassTableCell header>Exited</GlassTableCell>
                  </GlassTableRow>
                </GlassTableHeader>
                <GlassTableBody>
                  {filteredAndSortedData.map((operator) => {
                    // Find original rank from the full unfiltered sorted data
                    const originalRank = performanceData
                      .slice()
                      .sort((a, b) => b.performance - a.performance)
                      .findIndex(op => op.address === operator.address) + 1;
                    
                    return (
                      <GlassTableRow key={operator.address} hoverable>
                        <GlassTableCell className="font-medium">
                          {originalRank}
                        </GlassTableCell>
                      <GlassTableCell className="font-mono text-xs">
                        {operator.address}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.ens_name || '-'}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.performance.toFixed(2)}%
                      </GlassTableCell>
                      <GlassTableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          operator.category === 'Excellent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          operator.category === 'Good' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          operator.category === 'Average' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {operator.category === 'Excellent' ? 'Excellent' :
                           operator.category === 'Good' ? 'Good' :
                           operator.category === 'Average' ? 'Average' :
                           'Poor'}
                        </span>
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.active}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.total}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.exited}
                      </GlassTableCell>
                    </GlassTableRow>
                    );
                  })}
                </GlassTableBody>
              </GlassTable>
            </div>
            
            {/* Download CSV Button */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <GlassButton onClick={downloadCSV} variant="primary" size="sm">
                <Icon name="download" size="sm" color="current" className="mr-2" />
                Download Performance Data
              </GlassButton>
            </div>
          </div>

          {/* Attestation-Only Performance Analysis */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                <Icon name="metrics" size="lg" color="primary" className="inline mr-2" />Attestation-Only Performance Analysis
              </h2>
              <div className="
                bg-glass-light dark:bg-glass-dark 
                backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                border border-gray-200 dark:border-white/15
                rounded-2xl 
                shadow-glass-light dark:shadow-glass-dark
                p-6
                bg-info-light/30 dark:bg-info-dark/20 border-l-4 border-info
              ">
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Performance analysis of validators doing ONLY attestations (excluding proposals and sync committee duties)
                </p>
              </div>
            </div>
            
            {!hasAttestationData ? (
              <div className="
                bg-glass-light dark:bg-glass-dark 
                backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                border border-gray-200 dark:border-white/15
                rounded-2xl 
                shadow-glass-light dark:shadow-glass-dark
                p-6
              ">
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No attestation performance data available.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 7-Day Attestation Performance */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        7-Day Attestation Performance
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Validators active for 7+ days, excluding those with proposals/sync duties in the last 10 days
                      </p>
                    </div>
                    <GlassButton 
                      onClick={() => downloadAttestationCSV(attestation7dData, '7-day')} 
                      variant="primary" 
                      size="sm"
                    >
                      <Icon name="download" size="sm" color="current" className="mr-2" />
                      Download 7-Day CSV
                    </GlassButton>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {filtered7dData.length} of {attestation7dData.length} operators with attestation-only performance
                    </div>
                    <div className="w-72">
                      <input
                        type="text"
                        placeholder="Search by address, operator name, or ENS name..."
                        value={searchTerm7d}
                        onChange={(e) => setSearchTerm7d(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                          placeholder-gray-500 dark:placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    <GlassTable>
                      <GlassTableHeader>
                        <GlassTableRow>
                          <GlassTableCell header>Rank</GlassTableCell>
                          <GlassTableCell header>Address</GlassTableCell>
                          <GlassTableCell header>ENS/Discord Name</GlassTableCell>
                          <GlassTableCell header>Avg Performance</GlassTableCell>
                          <GlassTableCell header>Attestation Validators</GlassTableCell>
                          <GlassTableCell header>Excluded (Proposals/Sync)</GlassTableCell>
                          <GlassTableCell header>Total Validators</GlassTableCell>
                          <GlassTableCell header>Relative Score (%)</GlassTableCell>
                        </GlassTableRow>
                      </GlassTableHeader>
                      <GlassTableBody>
                        {filtered7dData.map((operator) => {
                          // Find original rank from the full unfiltered sorted data
                          const originalRank = attestation7dData.findIndex(op => op.address === operator.address) + 1;
                          
                          return (
                            <GlassTableRow key={operator.address} hoverable>
                              <GlassTableCell className="font-medium">
                                {originalRank}
                              </GlassTableCell>
                            <GlassTableCell className="font-mono text-xs">
                              {operator.operator}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.ens_name || '-'}
                            </GlassTableCell>
                            <GlassTableCell className="font-mono">
                              {Math.round(operator.regular_performance_gwei).toLocaleString()}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.attestation_validators}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.excluded_validators}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.total_validators}
                            </GlassTableCell>
                            <GlassTableCell className="font-mono">
                              {operator.relative_score.toFixed(2)}%
                            </GlassTableCell>
                          </GlassTableRow>
                          );
                        })}
                      </GlassTableBody>
                    </GlassTable>
                  </div>
                </div>

                {/* 31-Day Attestation Performance */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        31-Day Attestation Performance
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Validators active for 32+ days, excluding those with proposals/sync duties in the last 34 days
                      </p>
                    </div>
                    <GlassButton 
                      onClick={() => downloadAttestationCSV(attestation31dData, '31-day')} 
                      variant="primary" 
                      size="sm"
                    >
                      <Icon name="download" size="sm" color="current" className="mr-2" />
                      Download 31-Day CSV
                    </GlassButton>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {filtered31dData.length} of {attestation31dData.length} operators with attestation-only performance
                    </div>
                    <div className="w-72">
                      <input
                        type="text"
                        placeholder="Search by address, operator name, or ENS name..."
                        value={searchTerm31d}
                        onChange={(e) => setSearchTerm31d(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                          placeholder-gray-500 dark:placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    <GlassTable>
                      <GlassTableHeader>
                        <GlassTableRow>
                          <GlassTableCell header>Rank</GlassTableCell>
                          <GlassTableCell header>Address</GlassTableCell>
                          <GlassTableCell header>ENS/Discord Name</GlassTableCell>
                          <GlassTableCell header>Avg Performance</GlassTableCell>
                          <GlassTableCell header>Attestation Validators</GlassTableCell>
                          <GlassTableCell header>Excluded (Proposals/Sync)</GlassTableCell>
                          <GlassTableCell header>Total Validators</GlassTableCell>
                          <GlassTableCell header>Relative Score (%)</GlassTableCell>
                        </GlassTableRow>
                      </GlassTableHeader>
                      <GlassTableBody>
                        {filtered31dData.map((operator) => {
                          // Find original rank from the full unfiltered sorted data
                          const originalRank = attestation31dData.findIndex(op => op.address === operator.address) + 1;
                          
                          return (
                            <GlassTableRow key={operator.address} hoverable>
                              <GlassTableCell className="font-medium">
                                {originalRank}
                              </GlassTableCell>
                            <GlassTableCell className="font-mono text-xs">
                              {operator.operator}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.ens_name || '-'}
                            </GlassTableCell>
                            <GlassTableCell className="font-mono">
                              {Math.round(operator.regular_performance_gwei).toLocaleString()}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.attestation_validators}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.excluded_validators}
                            </GlassTableCell>
                            <GlassTableCell>
                              {operator.total_validators}
                            </GlassTableCell>
                            <GlassTableCell className="font-mono">
                              {operator.relative_score.toFixed(2)}%
                            </GlassTableCell>
                          </GlassTableRow>
                          );
                        })}
                      </GlassTableBody>
                    </GlassTable>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTab;