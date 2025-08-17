import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExitData } from '../../types/api';
import { apiService } from '../../services/api';
import { analyticsService } from '../../services/analytics';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';
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
  const hasInitialized = useRef(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPage7d, setCurrentPage7d] = useState(1);
  const [currentPage31d, setCurrentPage31d] = useState(1);
  const itemsPerPage = 20;

  const calculateAttestationPerformanceFromOperatorData = (
    operatorSummaryData: any,
    proposalsData: any,
    syncCommitteeData: any,
    days: number,
    validatorData: any
  ): AttestationPerformanceData[] => {
    const now = Date.now() / 1000;
    const lookbackDays = days === 7 ? 10 : 34; // 10 days for 7-day analysis, 34 for 31-day
    const lookbackTimestamp = now - (lookbackDays * 24 * 60 * 60);

    console.log(`=== NEW METHOD: Calculating ${days}-day attestation performance using operator daily data ===`);
    console.log(`Lookback period: ${lookbackDays} days (timestamp: ${lookbackTimestamp})`);
    console.log(`Operator summary data contains ${Object.keys(operatorSummaryData).length} operators`);
    
    const validatorsWithProposals = new Set<number>();
    if (proposalsData?.proposals) {
      console.log(`Processing ${proposalsData.proposals.length} proposals`);
      proposalsData.proposals.forEach((proposal: any) => {
        const proposalTimestamp = proposal.timestamp || 0;
        if (proposalTimestamp >= lookbackTimestamp) {
          const validatorIndex = proposal.validator_index || proposal.proposer_index;
          if (validatorIndex) {
            validatorsWithProposals.add(validatorIndex);
          }
        }
      });
    }

    const validatorsWithSyncDuties = new Set<number>();
    if (syncCommitteeData?.detailed_stats) {
      const GENESIS_TIME = 1606824023;
      console.log(`Processing ${syncCommitteeData.detailed_stats.length} sync committee entries`);
      
      syncCommitteeData.detailed_stats.forEach((stat: any) => {
        if (stat.validator_index && stat.end_slot) {
          const endTimestamp = GENESIS_TIME + (stat.end_slot * 12);
          if (endTimestamp >= lookbackTimestamp) {
            validatorsWithSyncDuties.add(stat.validator_index);
          }
        }
      });
    }

    const excludedOperators = new Set<string>();
    
    if (validatorData?.operator_validators) {
      Object.entries(validatorData.operator_validators).forEach(([operatorAddress, validatorCount]: [string, any]) => {
        const operatorValidators = Object.entries(validatorData.validators || {})
          .filter(([_, validator]: [string, any]) => validator.operator === operatorAddress)
          .map(([_, validator]: [string, any]) => validator.validator_index)
          .filter(Boolean);

        const hasExcludedValidator = operatorValidators.some(validatorIndex => 
          validatorsWithProposals.has(validatorIndex) || 
          validatorsWithSyncDuties.has(validatorIndex)
        );

        if (hasExcludedValidator) {
          excludedOperators.add(operatorAddress);
        }
      });
    }

    console.log(`Found ${validatorsWithProposals.size} validators with proposals, ${validatorsWithSyncDuties.size} with sync duties`);
    console.log(`Excluding ${excludedOperators.size} operators with recent proposals/sync duties`);
    console.log(`Remaining attestation-only operators: ${Object.keys(operatorSummaryData).length - excludedOperators.size}`);

    const attestationOnlyOperators = Object.entries(operatorSummaryData)
      .filter(([operatorAddress, _]) => !excludedOperators.has(operatorAddress))
      .map(([operatorAddress, summary]: [string, any]) => ({
        operator: operatorAddress,
        address: operatorAddress,
        ens_name: validatorData?.ens_names?.[operatorAddress] || '',
        regular_performance_gwei: summary.avg_attestation_performance || 0,
        attestation_validators: summary.validator_count || 0,
        excluded_validators: 0,
        total_validators: summary.validator_count || 0,
        relative_score: 0
      }));

    if (attestationOnlyOperators.length > 0) {
      const highestPerformance = Math.max(...attestationOnlyOperators.map(op => op.regular_performance_gwei));
      console.log(`Highest attestation performance: ${highestPerformance}%`);
      
      // Debug: Show performance range
      const lowestPerformance = Math.min(...attestationOnlyOperators.map(op => op.regular_performance_gwei));
      console.log(`Performance range: ${lowestPerformance}% to ${highestPerformance}%`);
      
      attestationOnlyOperators.forEach(op => {
        op.relative_score = highestPerformance > 0 ? (op.regular_performance_gwei / highestPerformance) * 100 : 0;
      });

      attestationOnlyOperators.sort((a, b) => b.regular_performance_gwei - a.regular_performance_gwei);
    }

    return attestationOnlyOperators;
  };


  const fetchData = useCallback(async () => {
    // Prevent double execution in React strict mode
    if (hasInitialized.current) {
      console.log('fetchData already running, skipping...');
      return;
    }
    hasInitialized.current = true;
    
    try {
      setLoading(true);
      
      const [validatorData, exitData] = await Promise.all([
        apiService.getValidatorData(),
        apiService.getData<ExitData>('exit-data')
      ]);

      // Try to fetch 24-hour performance data
      try {
        const performanceResponse = await apiService.getOperatorsSummary(1);
        
        if (performanceResponse && Object.keys(performanceResponse).length > 0) {
          // We have 24-hour performance data
          setHasPerformanceData(true);
          
          // Create a map of exits by operator
          const operatorExits: Record<string, number> = {};
          if (exitData?.operators_with_exits) {
            exitData.operators_with_exits.forEach((op) => {
              operatorExits[op.operator] = op.exits || 0;
            });
          }

          // Transform the getOperatorsSummary data to match expected format
          const data = Object.entries(performanceResponse)
            .map(([address, operatorData]) => {
              const exits = operatorExits[address] || 0;
              const totalValidators = validatorData.operator_validators[address] || operatorData.validator_count;
              const activeValidators = Math.max(0, totalValidators - exits);
              const ensName = validatorData.ens_names?.[address] || '';
              const performance = operatorData.avg_attestation_performance || 0;
              
              return {
                operator: ensName || address,
                address: address,
                performance: performance,
                validator_count: activeValidators,
                category: getPerformanceCategory(performance),
                active: activeValidators,
                total: totalValidators,
                exited: exits,
                ens_name: ensName
              };
            })
            .filter(operator => operator.active > 0); // Only include operators with active validators

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

      // Fetch attestation-only performance data using operator daily performance cache
      try {
        const [operatorSummary7d, operatorSummary31d, proposalsData, syncCommitteeData] = await Promise.all([
          apiService.getOperatorsSummary(7),
          apiService.getOperatorsSummary(31), 
          apiService.getData('proposals'),
          apiService.getData('sync-committee')
        ]);

        if (operatorSummary7d && Object.keys(operatorSummary7d).length > 0) {
          setHasAttestationData(true);
          
          // Calculate 7-day attestation performance using operator daily performance data
          console.log('=== STARTING 7-DAY CALCULATION (NEW METHOD) ===');
          const attestation7d = calculateAttestationPerformanceFromOperatorData(operatorSummary7d, proposalsData, syncCommitteeData, 7, validatorData);
          console.log('=== COMPLETED 7-DAY CALCULATION (NEW METHOD) ===', attestation7d.length, 'operators');
          setAttestation7dData(attestation7d);
          
          // Calculate 31-day attestation performance using operator daily performance data
          console.log('=== STARTING 31-DAY CALCULATION (NEW METHOD) ===');
          const attestation31d = calculateAttestationPerformanceFromOperatorData(operatorSummary31d, proposalsData, syncCommitteeData, 31, validatorData);
          console.log('=== COMPLETED 31-DAY CALCULATION (NEW METHOD) ===', attestation31d.length, 'operators');
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

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  
  useEffect(() => {
    setCurrentPage7d(1);
  }, [searchTerm7d]);
  
  useEffect(() => {
    setCurrentPage31d(1);
  }, [searchTerm31d]);

  // Pagination handlers
  const handleMainPageNext = useCallback(() => {
    setCurrentPage(prev => {
      const newPage = prev + 1;
      console.log(`Main page next: ${prev} -> ${newPage}`);
      return newPage;
    });
  }, []);
  
  const handleMainPagePrev = useCallback(() => {
    setCurrentPage(prev => {
      const newPage = prev - 1;
      console.log(`Main page prev: ${prev} -> ${newPage}`);
      return newPage;
    });
  }, []);
  
  const handle7dPageNext = useCallback(() => {
    setCurrentPage7d(prev => prev + 1);
  }, []);
  
  const handle7dPagePrev = useCallback(() => {
    setCurrentPage7d(prev => prev - 1);
  }, []);
  
  const handle31dPageNext = useCallback(() => {
    setCurrentPage31d(prev => prev + 1);
  }, []);
  
  const handle31dPagePrev = useCallback(() => {
    setCurrentPage31d(prev => prev - 1);
  }, []);

  const downloadCSV = () => {
    analyticsService.trackDownload('performance_csv');
    
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
    analyticsService.trackDownload('performance_csv');
    
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

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Debug logging
  console.log(`Main pagination: currentPage=${currentPage}, totalPages=${totalPages}, itemsOnPage=${paginatedData.length}`);
  
  // 7-day pagination logic
  const totalPages7d = Math.ceil(filtered7dData.length / itemsPerPage);
  const paginatedData7d = filtered7dData.slice(
    (currentPage7d - 1) * itemsPerPage,
    currentPage7d * itemsPerPage
  );
  
  // 31-day pagination logic
  const totalPages31d = Math.ceil(filtered31dData.length / itemsPerPage);
  const paginatedData31d = filtered31dData.slice(
    (currentPage31d - 1) * itemsPerPage,
    currentPage31d * itemsPerPage
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
                24 Hour / 7 day / 31 day data. Refreshes daily.
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
              data={(() => {
                // Group operators by validator count and calculate average performance
                const groupedData = performanceData.reduce((acc, operator) => {
                  const count = operator.validator_count;
                  if (!acc[count]) {
                    acc[count] = {
                      validator_count: count,
                      performances: [],
                      total_performance: 0,
                      operator_count: 0
                    };
                  }
                  acc[count].performances.push(operator.performance);
                  acc[count].total_performance += operator.performance;
                  acc[count].operator_count += 1;
                  return acc;
                }, {} as Record<number, { validator_count: number; performances: number[]; total_performance: number; operator_count: number; }>);

                // Convert to array with average performance
                return Object.values(groupedData)
                  .map(group => ({
                    validator_count: group.validator_count,
                    performance: group.total_performance / group.operator_count,
                    operator_count: group.operator_count
                  }))
                  .sort((a, b) => a.validator_count - b.validator_count);
              })()}
              title="Performance by Operator Size (Average)"
              lines={[{
                dataKey: 'performance',
                stroke: '#8884d8',
                strokeWidth: 2,
                name: 'Avg Performance',
                dot: true
              }]}
              xAxisDataKey="validator_count"
              xAxisLabel="Number of Validators"
              yAxisLabel="Average Performance (%)"
              yDomain={performanceData.length > 0 ? 
                [Math.max(0, Math.min(...performanceData.map(d => d.performance)) - 1), 100] : 
                [0, 100]
              }
              showLegend={false}
            />
          </div>

          {/* Performance Table */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <Icon name="trophy" size="lg" color="primary" className="inline mr-2" />Operators by Performance - 24 hours
              </h3>
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search by address, operator name, or ENS name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                    placeholder-gray-500 dark:placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                    min-h-[44px]"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Showing {paginatedData.length} of {filteredAndSortedData.length} operators on this page • {performanceData.length} total operators
            </div>
            
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4">
              <div className="space-y-3">
                {paginatedData.map((operator, index) => {
                // Find original rank from the full unfiltered sorted data
                const originalRank = performanceData
                  .slice()
                  .sort((a, b) => b.performance - a.performance)
                  .findIndex(op => op.address === operator.address) + 1;
                
                const truncateAddress = (address: string) => {
                  return `${address.slice(0, 6)}...${address.slice(-4)}`;
                };
                
                return (
                  <div 
                    key={operator.address}
                    className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rank #{originalRank}</div>
                        <div className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                          {truncateAddress(operator.address)}
                        </div>
                        {operator.ens_name && (
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            {operator.ens_name}
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        operator.category === 'Excellent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        operator.category === 'Good' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        operator.category === 'Average' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {operator.category}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Performance</div>
                        <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                          {operator.performance.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Validators</div>
                        <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                          {operator.active}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</div>
                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {operator.total}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exited</div>
                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {operator.exited}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
              
              {/* Mobile Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15">
                  <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left" key={`main-page-${currentPage}-${totalPages}`}>
                    Page {currentPage} of {totalPages} • {filteredAndSortedData.length} total operators
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <GlassButton
                      onClick={handleMainPagePrev}
                      disabled={currentPage === 1}
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px] px-4"
                    >
                      <Icon name="left" size="sm" />
                      Previous
                    </GlassButton>

                    <GlassButton
                      onClick={handleMainPageNext}
                      disabled={currentPage === totalPages}
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px] px-4"
                    >
                      Next
                      <Icon name="right" size="sm" />
                    </GlassButton>
                  </div>
                </div>
              )}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
                <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr", gap: "12px"}}>
                  <div>Rank</div>
                  <div>Address</div>
                  <div>ENS / Discord Name</div>
                  <div>Performance</div>
                  <div>Category</div>
                  <div>Active</div>
                  <div>Total</div>
                  <div>Exited</div>
                </div>
              </div>
              
              {/* Scrollable Body */}
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                <div className="divide-y divide-white/5 dark:divide-white/10">
                  {filteredAndSortedData.map((operator, index) => {
                    // Find original rank from the full unfiltered sorted data
                    const originalRank = performanceData
                      .slice()
                      .sort((a, b) => b.performance - a.performance)
                      .findIndex(op => op.address === operator.address) + 1;
                    
                    return (
                      <div 
                        key={operator.address}
                        className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                          index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                        }`}
                        style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr", gap: "12px"}}
                      >
                        <div className="font-medium">
                          {originalRank}
                        </div>
                        <div className="font-mono text-xs">
                          {operator.address}
                        </div>
                        <div>
                          {operator.ens_name || '-'}
                        </div>
                        <div>
                          {operator.performance.toFixed(2)}%
                        </div>
                        <div>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Download CSV Button */}
            <div className="flex justify-center md:justify-start px-4 py-4">
              <GlassButton onClick={downloadCSV} variant="primary" size="sm" className="w-full md:w-auto min-h-[44px]">
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
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
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
                      className="w-full lg:w-auto min-h-[44px]"
                    >
                      <Icon name="download" size="sm" color="current" className="mr-2" />
                      Download 7-Day CSV
                    </GlassButton>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {paginatedData7d.length} of {filtered7dData.length} operators on this page • {attestation7dData.length} total operators
                    </div>
                    <div className="w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search by address, operator name, or ENS name..."
                        value={searchTerm7d}
                        onChange={(e) => setSearchTerm7d(e.target.value)}
                        className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                          placeholder-gray-500 dark:placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                          min-h-[44px]"
                      />
                    </div>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="block lg:hidden space-y-4">
                    <div className="space-y-3">
                      {paginatedData7d.map((operator, index) => {
                        // Find original rank from the full unfiltered sorted data
                        const originalRank = attestation7dData.findIndex(op => op.address === operator.address) + 1;
                      
                      const truncateAddress = (address: string) => {
                        return `${address.slice(0, 6)}...${address.slice(-4)}`;
                      };
                      
                      return (
                        <div 
                          key={operator.address}
                          className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm p-4 space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rank #{originalRank}</div>
                              <div className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                                {truncateAddress(operator.operator)}
                              </div>
                              {operator.ens_name && (
                                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                  {operator.ens_name}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Relative Score</div>
                              <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {operator.relative_score.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Performance</div>
                              <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                                {Math.round(operator.regular_performance_gwei).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attestation Validators</div>
                              <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                {operator.attestation_validators}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Validators</div>
                              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                {operator.total_validators}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Excluded</div>
                              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                {operator.excluded_validators}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    
                    {/* Mobile Pagination Controls for 7-day */}
                    {totalPages7d > 1 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15">
                        <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left" key={`7d-page-${currentPage7d}-${totalPages7d}`}>
                          Page {currentPage7d} of {totalPages7d} • {filtered7dData.length} total operators
                        </div>
                        
                        <div className="flex items-center justify-center gap-2">
                          <GlassButton
                            onClick={handle7dPagePrev}
                            disabled={currentPage7d === 1}
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] px-4"
                          >
                            <Icon name="left" size="sm" />
                            Previous
                          </GlassButton>

                          <GlassButton
                            onClick={handle7dPageNext}
                            disabled={currentPage7d === totalPages7d}
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] px-4"
                          >
                            Next
                            <Icon name="right" size="sm" />
                          </GlassButton>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden lg:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
                      <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.5fr 1.8fr 2fr 1.5fr 1.7fr", gap: "12px"}}>
                        <div>Rank</div>
                        <div>Address</div>
                        <div>ENS/Discord Name</div>
                        <div>Avg Performance</div>
                        <div>Attestation Validators</div>
                        <div>Excluded (Proposals/Sync)</div>
                        <div>Total Validators</div>
                        <div>Relative Score (%)</div>
                      </div>
                    </div>
                    
                    {/* Scrollable Body */}
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                      <div className="divide-y divide-white/5 dark:divide-white/10">
                        {filtered7dData.map((operator, index) => {
                          // Find original rank from the full unfiltered sorted data
                          const originalRank = attestation7dData.findIndex(op => op.address === operator.address) + 1;
                          
                          return (
                            <div 
                              key={operator.address}
                              className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                                index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                              }`}
                              style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.5fr 1.8fr 2fr 1.5fr 1.7fr", gap: "12px"}}
                            >
                              <div className="font-medium">
                                {originalRank}
                              </div>
                              <div className="font-mono text-xs">
                                {operator.operator}
                              </div>
                              <div>
                                {operator.ens_name || '-'}
                              </div>
                              <div className="font-mono">
                                {Math.round(operator.regular_performance_gwei).toLocaleString()}
                              </div>
                              <div>
                                {operator.attestation_validators}
                              </div>
                              <div>
                                {operator.excluded_validators}
                              </div>
                              <div>
                                {operator.total_validators}
                              </div>
                              <div className="font-mono">
                                {operator.relative_score.toFixed(2)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 31-Day Attestation Performance */}
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
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
                      className="w-full lg:w-auto min-h-[44px]"
                    >
                      <Icon name="download" size="sm" color="current" className="mr-2" />
                      Download 31-Day CSV
                    </GlassButton>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {paginatedData31d.length} of {filtered31dData.length} operators on this page • {attestation31dData.length} total operators
                    </div>
                    <div className="w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search by address, operator name, or ENS name..."
                        value={searchTerm31d}
                        onChange={(e) => setSearchTerm31d(e.target.value)}
                        className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                          placeholder-gray-500 dark:placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                          min-h-[44px]"
                      />
                    </div>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="block lg:hidden space-y-4">
                    <div className="space-y-3">
                      {paginatedData31d.map((operator, index) => {
                      // Find original rank from the full unfiltered sorted data
                      const originalRank = attestation31dData.findIndex(op => op.address === operator.address) + 1;
                      
                      const truncateAddress = (address: string) => {
                        return `${address.slice(0, 6)}...${address.slice(-4)}`;
                      };
                      
                      return (
                        <div 
                          key={operator.address}
                          className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm p-4 space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rank #{originalRank}</div>
                              <div className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                                {truncateAddress(operator.operator)}
                              </div>
                              {operator.ens_name && (
                                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                  {operator.ens_name}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Relative Score</div>
                              <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {operator.relative_score.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Performance</div>
                              <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                                {Math.round(operator.regular_performance_gwei).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attestation Validators</div>
                              <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                {operator.attestation_validators}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Validators</div>
                              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                {operator.total_validators}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Excluded</div>
                              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                {operator.excluded_validators}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    
                    {/* Mobile Pagination Controls for 31-day */}
                    {totalPages31d > 1 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15">
                        <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left" key={`31d-page-${currentPage31d}-${totalPages31d}`}>
                          Page {currentPage31d} of {totalPages31d} • {filtered31dData.length} total operators
                        </div>
                        
                        <div className="flex items-center justify-center gap-2">
                          <GlassButton
                            onClick={handle31dPagePrev}
                            disabled={currentPage31d === 1}
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] px-4"
                          >
                            <Icon name="left" size="sm" />
                            Previous
                          </GlassButton>

                          <GlassButton
                            onClick={handle31dPageNext}
                            disabled={currentPage31d === totalPages31d}
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] px-4"
                          >
                            Next
                            <Icon name="right" size="sm" />
                          </GlassButton>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden lg:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
                      <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.5fr 1.8fr 2fr 1.5fr 1.7fr", gap: "12px"}}>
                        <div>Rank</div>
                        <div>Address</div>
                        <div>ENS/Discord Name</div>
                        <div>Avg Performance</div>
                        <div>Attestation Validators</div>
                        <div>Excluded (Proposals/Sync)</div>
                        <div>Total Validators</div>
                        <div>Relative Score (%)</div>
                      </div>
                    </div>
                    
                    {/* Scrollable Body */}
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                      <div className="divide-y divide-white/5 dark:divide-white/10">
                        {filtered31dData.map((operator, index) => {
                          // Find original rank from the full unfiltered sorted data
                          const originalRank = attestation31dData.findIndex(op => op.address === operator.address) + 1;
                          
                          return (
                            <div 
                              key={operator.address}
                              className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                                index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                              }`}
                              style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.5fr 1.8fr 2fr 1.5fr 1.7fr", gap: "12px"}}
                            >
                              <div className="font-medium">
                                {originalRank}
                              </div>
                              <div className="font-mono text-xs">
                                {operator.operator}
                              </div>
                              <div>
                                {operator.ens_name || '-'}
                              </div>
                              <div className="font-mono">
                                {Math.round(operator.regular_performance_gwei).toLocaleString()}
                              </div>
                              <div>
                                {operator.attestation_validators}
                              </div>
                              <div>
                                {operator.excluded_validators}
                              </div>
                              <div>
                                {operator.total_validators}
                              </div>
                              <div className="font-mono">
                                {operator.relative_score.toFixed(2)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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