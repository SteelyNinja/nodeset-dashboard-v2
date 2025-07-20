import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { analyticsService } from '../services/analytics';
import {
  OperatorPerformanceData,
  OperatorChartData,
  OperatorSummary
} from '../types/api';
import GlassCard from './common/GlassCard';
import GlassButton from './common/GlassButton';
import LoadingSpinner from './common/LoadingSpinner';
import ErrorMessage from './common/ErrorMessage';
import LineChart from './charts/LineChart';
import Icon from './common/Icon';
import { PROFESSIONAL_CHART_COLORS } from '../constants/chartThemes';

interface OperatorDashboardProps {
  operatorAddress?: string;
}

const OperatorDashboard: React.FC<OperatorDashboardProps> = ({ operatorAddress: propOperatorAddress }) => {
  const { operatorAddress: paramOperatorAddress } = useParams<{ operatorAddress: string }>();
  const navigate = useNavigate();
  
  const operatorAddress = propOperatorAddress || paramOperatorAddress;
  
  const [performanceData, setPerformanceData] = useState<OperatorPerformanceData | null>(null);
  const [chartData, setChartData] = useState<OperatorChartData | null>(null);
  const [allOperatorsSummary, setAllOperatorsSummary] = useState<Record<string, OperatorSummary>>({});
  const [previousDayOperatorsSummary, setPreviousDayOperatorsSummary] = useState<Record<string, OperatorSummary>>({});
  const [validatorsList, setValidatorsList] = useState<any[]>([]);
  const [mevAnalytics, setMevAnalytics] = useState<any>(null);
  const [syncCommitteeData, setSyncCommitteeData] = useState<any>(null);
  const [comprehensiveData, setComprehensiveData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(7);
  // ENS name lookup (simplified - you may want to expand this)
  const getOperatorDisplayName = (address: string): string => {
    // This could be enhanced to load ENS names from your existing ENS data
    if (address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  // Load operator data
  useEffect(() => {
    if (!operatorAddress) {
      setError('No operator address provided');
      setLoading(false);
      return;
    }

    const loadOperatorData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Track operator dashboard view
        analyticsService.trackOperatorDashboard(operatorAddress);

        // Load operator performance data and enhanced analytics in parallel
        const [performance, chart, allSummary, previousDaySummary, validatorPerformanceData, exitData, mevData, syncData, comprehensiveAnalytics, validatorData] = await Promise.all([
          apiService.getOperatorPerformance(operatorAddress, selectedDays),
          apiService.getOperatorChartData(operatorAddress, selectedDays),
          apiService.getOperatorsSummary(7), // Always use 7-day data for network ranking
          apiService.getOperatorsSummary(8).catch(() => ({})), // Get 8-day data to calculate previous day rank
          apiService.getValidatorPerformanceData(), // Get active validator data
          apiService.getExitData(), // Get exit data for exited validators
          apiService.getOperatorMevAnalytics(operatorAddress).catch(() => null), // MEV analytics
          apiService.getOperatorSyncCommitteeAnalytics(operatorAddress).catch(() => null), // Sync committee data
          apiService.getOperatorComprehensiveAnalytics(operatorAddress).catch(() => null), // Comprehensive analytics
          apiService.getValidatorData().catch(() => null) // Cost data
        ]);

        // Get active validators for this operator
        const activeValidators = Object.entries(validatorPerformanceData.validators || {})
          .filter(([, validator]: [string, any]) => validator.operator === operatorAddress)
          .map(([validatorIndex, validator]: [string, any]) => ({
            validator_index: validator.validator_index,
            public_key: validatorIndex, // The key is the validator public key
            activation_timestamp: validator.activation_data?.activation_timestamp,
            activation_date: validator.activation_data?.activation_date || 
              (validator.activation_data?.activation_timestamp ? 
                new Date(validator.activation_data.activation_timestamp * 1000).toISOString().split('T')[0] : null),
            exit_timestamp: null,
            exit_date: null,
            status: validator.activation_data?.status || 'Active'
          }));

        // Get exited validators for this operator
        const exitedValidators = (exitData.recent_exits || [])
          .filter((exit: any) => exit.operator === operatorAddress)
          .map((exit: any) => {
            // Try to find the real public key from performance data
            const performanceValidator = Object.entries(validatorPerformanceData.validators || {})
              .find(([, validator]: [string, any]) => validator.validator_index === exit.validator_index);
            
            return {
              validator_index: exit.validator_index,
              public_key: performanceValidator ? performanceValidator[0] : (exit.validator_pubkey || `validator_${exit.validator_index}`),
              activation_timestamp: null,
              activation_date: null,
              exit_timestamp: exit.exit_timestamp,
              exit_date: exit.exit_date || 
                (exit.exit_timestamp ? 
                  new Date(exit.exit_timestamp * 1000).toISOString().split('T')[0] : null),
              status: exit.slashed ? 'Slashed' : 'Exited'
            };
          });

        // Combine and deduplicate validators (prioritize exit data over active data)
        const validatorMap = new Map();
        
        // Add active validators first
        activeValidators.forEach(validator => {
          validatorMap.set(validator.validator_index, validator);
        });
        
        // Add/update with exited validators (overwrites active if same validator_index)
        exitedValidators.forEach(validator => {
          validatorMap.set(validator.validator_index, validator);
        });
        
        const operatorValidators = Array.from(validatorMap.values())
          .sort((a, b) => a.validator_index - b.validator_index);

        // Debug logging for API responses
        console.log('API Response - Performance Data Structure:', {
          operatorAddress,
          dailyPerformanceLength: performance?.daily_performance?.length,
          firstDayData: performance?.daily_performance?.[0],
          lastDayData: performance?.daily_performance?.[performance?.daily_performance?.length - 1]
        });

        setPerformanceData(performance);
        setChartData(chart);
        setAllOperatorsSummary(allSummary);
        setPreviousDayOperatorsSummary(previousDaySummary);
        setValidatorsList(operatorValidators);
        setMevAnalytics(mevData);
        setSyncCommitteeData(syncData);
        setComprehensiveData(comprehensiveAnalytics);
        setCostData(validatorData);
      } catch (err) {
        console.error('Failed to load operator data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load operator data');
      } finally {
        setLoading(false);
      }
    };

    loadOperatorData();
  }, [operatorAddress, selectedDays]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    // Try comprehensive data first, then fall back to performance data
    const dailyPerf = comprehensiveData?.daily_performance || performanceData?.daily_performance;
    if (!dailyPerf || dailyPerf.length === 0) {
      return null;
    }

    const days = dailyPerf;
    const latestDay = days[0]; // Newest first
    
    // Debug logging to help diagnose issues
    console.log(`OperatorDashboard: Processing ${days.length} days of data for operator ${operatorAddress}`);
    console.log('Latest day data:', {
      date: latestDay.date,
      attestation_performance: latestDay.attestation_performance,
      participation_rate: latestDay.participation_rate,
      head_accuracy: latestDay.head_accuracy,
      validator_count: latestDay.validator_count
    });
    
    // Validate data ranges - performance metrics should be 0-100
    if (latestDay.attestation_performance > 100 || latestDay.participation_rate > 100) {
      console.warn(`OperatorDashboard: Unusual performance values detected for ${operatorAddress}:`, {
        performance: latestDay.attestation_performance,
        participation: latestDay.participation_rate
      });
    }
    
    const daysToUse = Math.min(selectedDays, days.length);
    const periodsToUse = days.slice(0, daysToUse);
    const avgPerformance = periodsToUse.reduce((sum: number, day: any) => sum + day.attestation_performance, 0) / periodsToUse.length;
    const avgParticipation = periodsToUse.reduce((sum: number, day: any) => sum + day.participation_rate, 0) / periodsToUse.length;
    const avgHeadAccuracy = periodsToUse.reduce((sum: number, day: any) => sum + day.head_accuracy, 0) / periodsToUse.length;
    const avgInclusionDelay = periodsToUse.reduce((sum: number, day: any) => sum + day.avg_inclusion_delay, 0) / periodsToUse.length;

    // Calculate 7-day trend (recent 7 days vs previous 7 days)
    let performanceTrend = 0;
    let trendDisplay = { icon: "→", text: "stable", color: "text-gray-600 dark:text-gray-400" };
    
    if (days.length >= 13) {
      const recent7Days = days.slice(0, 7);
      const previous6Days = days.slice(7, 13);
      
      const recentAvg = recent7Days.reduce((sum: number, day: any) => sum + day.attestation_performance, 0) / 7;
      const previousAvg = previous6Days.reduce((sum: number, day: any) => sum + day.attestation_performance, 0) / 6;
      
      performanceTrend = recentAvg - previousAvg;
      
      if (performanceTrend > 0.1) {
        trendDisplay = { 
          icon: "↗", 
          text: `+${performanceTrend.toFixed(2)}% improving`, 
          color: "text-green-600 dark:text-green-400" 
        };
      } else if (performanceTrend < -0.1) {
        trendDisplay = { 
          icon: "↘", 
          text: `${performanceTrend.toFixed(2)}% declining`, 
          color: "text-red-600 dark:text-red-400" 
        };
      }
    }

    // Debug trend calculation for this specific operator
    if (operatorAddress === "0x1762Bb8347f074d1dE732812488291eA55977B61") {
      console.log("🔍 Trend Debug:", {
        daysLength: days.length,
        recent7Days: days.slice(0, 7).map((d: any) => d.attestation_performance),
        previous6Days: days.slice(7, 13).map((d: any) => d.attestation_performance),
        performanceTrend,
        trendDisplay
      });
    }

    // Additional debugging for suspected 100% issues
    if (latestDay.attestation_performance >= 99.9 || latestDay.participation_rate >= 99.9) {
      console.log(`📊 [${operatorAddress}] High performance detected - checking recent trends:`, {
        last7Days: days.slice(0, 7).map((d: any) => ({
          date: d.date,
          performance: d.attestation_performance,
          participation: d.participation_rate
        })),
        performanceRange: {
          min: Math.min(...days.map((d: any) => d.attestation_performance)),
          max: Math.max(...days.map((d: any) => d.attestation_performance)),
          variation: Math.max(...days.map((d: any) => d.attestation_performance)) - Math.min(...days.map((d: any) => d.attestation_performance))
        }
      });
    }

    const metrics = {
      // Changed to use averages for selected period instead of latest day
      latestPerformance: avgPerformance,
      avgPerformance,
      latestParticipation: avgParticipation,
      avgParticipation,
      latestHeadAccuracy: avgHeadAccuracy,
      avgHeadAccuracy,
      latestInclusionDelay: avgInclusionDelay,
      avgInclusionDelay,
      validatorCount: latestDay.validator_count,
      totalDays: days.length,
      latestDate: latestDay.date,
      // Keep actual latest day values for reference
      actualLatestPerformance: latestDay.attestation_performance,
      actualLatestParticipation: latestDay.participation_rate,
      actualLatestHeadAccuracy: latestDay.head_accuracy,
      // Trend data
      performanceTrend,
      trendDisplay
    };

    console.log('Calculated summary metrics:', {
      latestPerformance: metrics.latestPerformance,
      avgPerformance: metrics.avgPerformance,
      latestParticipation: metrics.latestParticipation,
      avgParticipation: metrics.avgParticipation
    });

    return metrics;
  }, [performanceData, comprehensiveData, operatorAddress]);

  // Calculate network comparison with rank change tracking
  const networkComparison = useMemo(() => {
    if (!summaryMetrics || Object.keys(allOperatorsSummary).length === 0 || !operatorAddress) {
      return null;
    }

    const operatorSummaries = Object.values(allOperatorsSummary);
    const networkAvgPerformance = operatorSummaries.reduce((sum, op) => sum + op.avg_attestation_performance, 0) / operatorSummaries.length;
    
    // Get current operator's 7-day performance for ranking
    const currentOperatorData = allOperatorsSummary[operatorAddress];
    if (!currentOperatorData) {
      console.warn(`No summary data found for operator ${operatorAddress}`);
      return null;
    }
    
    const currentOperator7DayPerf = currentOperatorData.avg_attestation_performance;
    
    // Calculate percentile ranking based on 7-day performance
    const betterCount = operatorSummaries.filter(op => op.avg_attestation_performance < currentOperator7DayPerf).length;
    const percentile = Math.round((betterCount / operatorSummaries.length) * 100);
    
    // Calculate current rank based on 7-day performance with proper tie handling
    const sortedOperators = operatorSummaries.sort((a, b) => b.avg_attestation_performance - a.avg_attestation_performance);
    
    let currentRank = 1;
    for (const op of sortedOperators) {
      if (op.avg_attestation_performance > currentOperator7DayPerf) {
        currentRank++;
      } else {
        break; // Found first operator with same or lower performance
      }
    }

    // Calculate previous rank if we have previous day data
    let rankChange = null;
    let previousRank = null;
    
    if (Object.keys(previousDayOperatorsSummary).length > 0) {
      const previousOperatorSummaries = Object.values(previousDayOperatorsSummary);
      const previousOperatorData = previousDayOperatorsSummary[operatorAddress];
      
      if (previousOperatorData) {
        const previousOperator8DayPerf = previousOperatorData.avg_attestation_performance;
        const sortedPreviousOperators = previousOperatorSummaries.sort((a, b) => b.avg_attestation_performance - a.avg_attestation_performance);
        
        previousRank = 1;
        for (const op of sortedPreviousOperators) {
          if (op.avg_attestation_performance > previousOperator8DayPerf) {
            previousRank++;
          } else {
            break;
          }
        }
        
        rankChange = previousRank - currentRank; // Positive means improved rank (moved up)
      }
    }

    console.log(`Operator ${operatorAddress}: Performance=${currentOperator7DayPerf.toFixed(4)}, Rank=${currentRank}, Previous=${previousRank}, Change=${rankChange}`);

    return {
      networkAvgPerformance,
      percentile,
      rank: currentRank,
      previousRank,
      rankChange,
      totalOperators: operatorSummaries.length,
      performanceDiff: currentOperator7DayPerf - networkAvgPerformance,
      period: '7-day' // Indicate this is based on 7-day data
    };
  }, [summaryMetrics, allOperatorsSummary, previousDayOperatorsSummary, operatorAddress]);

  // Performance status based on latest day only
  const getPerformanceStatus = (latestDayPerformance: number) => {
    // Ensure performance is a valid number within expected range
    const validPerformance = isNaN(latestDayPerformance) ? 0 : Math.max(0, Math.min(100, latestDayPerformance));
    
    if (validPerformance >= 99) return { label: 'Healthy', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    if (validPerformance >= 95) return { label: 'Warning', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
    return { label: 'Issues Detected', color: 'text-error-500', bgColor: 'bg-error-100 dark:bg-error-900/30' };
  };

  // Helper function to safely format performance metrics
  const formatPerformanceMetric = (value: number, decimals: number = 3): string => {
    if (isNaN(value) || value === null || value === undefined) {
      return 'N/A';
    }
    
    // Clamp value to reasonable range (0-100 for percentages)
    const clampedValue = Math.max(0, Math.min(100, value));
    
    // Warn if original value was outside expected range
    if (Math.abs(value - clampedValue) > 0.001) {
      console.warn(`Performance metric outside expected range: ${value}, clamped to ${clampedValue}`);
    }
    
    return clampedValue.toFixed(decimals);
  };

  // Chart configuration for Recharts
  const chartConfig = useMemo(() => {
    if (!chartData) return null;

    // Transform data for Recharts format
    const transformedData = chartData.dates.map((date, index) => ({
      date,
      performance: chartData.attestation_performance[index],
      headAccuracy: chartData.head_accuracy[index],
      participation: chartData.participation_rate[index]
    }));

    // Debug chart data vs summary metrics discrepancy
    const chartLatestDay = transformedData[transformedData.length - 1]; // Chart data is in ascending order (oldest first)
    console.log('Chart vs Summary Data Comparison:', {
      chartDataSource: 'API chart endpoint (ascending order)',
      summaryDataSource: 'API performance endpoint (descending order)',
      chartFirstDay: {
        date: transformedData[0]?.date,
        performance: transformedData[0]?.performance,
        participation: transformedData[0]?.participation
      },
      chartLatestDay: {
        date: chartLatestDay?.date,
        performance: chartLatestDay?.performance,
        participation: chartLatestDay?.participation
      },
      summaryLatestDay: summaryMetrics ? {
        date: summaryMetrics.latestDate,
        performance: summaryMetrics.latestPerformance,
        participation: summaryMetrics.latestParticipation
      } : null,
      dataMismatch: summaryMetrics && chartLatestDay ? 
        Math.abs(chartLatestDay.performance - summaryMetrics.latestPerformance) > 0.001 : false
    });

    return {
      data: transformedData,
      lines: [
        {
          dataKey: 'headAccuracy',
          stroke: PROFESSIONAL_CHART_COLORS.status.success,
          strokeWidth: 2,
          name: 'Head Accuracy %'
        },
        {
          dataKey: 'participation',
          stroke: PROFESSIONAL_CHART_COLORS.status.warning,
          strokeWidth: 3,
          name: 'Participation %',
          strokeDasharray: '5,5'
        },
        {
          dataKey: 'performance',
          stroke: PROFESSIONAL_CHART_COLORS.status.info,
          strokeWidth: 3,
          name: 'Performance %'
        }
      ]
    };
  }, [chartData, summaryMetrics]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!performanceData || !summaryMetrics) {
    // Friendly "no data" page for operators without performance data
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <GlassButton
              onClick={() => navigate('/', { state: { tab: 'operators' } })}
              variant="secondary"
              size="sm"
            >
              <Icon name="left" size="sm" />
              Back to Rankings
            </GlassButton>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Operator Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {getOperatorDisplayName(operatorAddress!)}
              </p>
            </div>
          </div>
        </div>

        {/* No Data Message */}
        <div className="flex items-center justify-center min-h-[400px]">
          <GlassCard className="max-w-md text-center">
            <div className="py-8 px-6">
              <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Icon name="chart" size="lg" color="neutral" />
              </div>
              <h3 className="text-headline-medium font-medium text-neutral-900 dark:text-white mb-2">
                No Performance Data Available
              </h3>
              <p className="text-label-medium text-neutral-600 dark:text-neutral-400 mb-4">
                This operator doesn't have any recent performance data in our system. This could be because:
              </p>
              <ul className="text-label-medium text-neutral-600 dark:text-neutral-400 text-left space-y-1 mb-6">
                <li>• All validators have been exited</li>
                <li>• The operator is newly registered</li>
                <li>• No recent attestation activity</li>
              </ul>
              <div className="space-y-3">
                <GlassButton
                  onClick={() => navigate('/', { state: { tab: 'operators' } })}
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  View All Operators
                </GlassButton>
                <GlassButton
                  onClick={() => navigate('/', { state: { tab: 'exit-analysis' } })}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Check Exit Analysis
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  const performanceStatus = getPerformanceStatus(summaryMetrics.actualLatestPerformance);

  return (
    <div className="p-6">
      <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <GlassButton
            onClick={() => navigate('/', { state: { tab: 'operators' } })}
            variant="secondary"
            size="sm"
          >
            <Icon name="left" size="sm" />
            Back to Rankings
          </GlassButton>
          <div>
            <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
              <Icon name="chart" size="lg" color="primary" />
              Operator Dashboard
            </h1>
            <p className="text-body-medium text-neutral-600 dark:text-neutral-400">
              {getOperatorDisplayName(operatorAddress!)}
            </p>
          </div>
        </div>
      </div>


      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">Network Rank</div>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <div className="text-display-large font-bold text-primary-500">
                #{networkComparison?.rank || '?'}
              </div>
              {networkComparison && networkComparison.rankChange !== null && (
                <div className={`flex items-center text-lg font-bold ${
                  networkComparison.rankChange >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {networkComparison.rankChange > 0 && (
                    <>
                      <Icon name="up" size="sm" />
                      <span className="ml-1">+{networkComparison.rankChange}</span>
                    </>
                  )}
                  {networkComparison.rankChange < 0 && (
                    <>
                      <Icon name="down" size="sm" />
                      <span className="ml-1">{networkComparison.rankChange}</span>
                    </>
                  )}
                  {networkComparison.rankChange === 0 && (
                    <>
                      <span className="ml-1">= 0</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
              of {networkComparison?.totalOperators || '?'} operators
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {networkComparison?.performanceDiff && networkComparison.performanceDiff > 0 ? '+' : ''}
              {networkComparison?.performanceDiff?.toFixed(2) || '0'}% vs network avg
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-display-small font-bold text-neutral-900 dark:text-white">
              {formatPerformanceMetric(summaryMetrics.latestPerformance)}%
            </div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400">{selectedDays}d Avg Performance</div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {summaryMetrics.totalDays} days of data
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-display-small font-bold text-neutral-900 dark:text-white">
              {formatPerformanceMetric(summaryMetrics.latestParticipation)}%
            </div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400">{selectedDays}d Avg Participation</div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {summaryMetrics.totalDays} days of data
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-display-small font-bold text-neutral-900 dark:text-white">
              {formatPerformanceMetric(summaryMetrics.latestHeadAccuracy)}%
            </div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400">{selectedDays}d Avg Head Accuracy</div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {summaryMetrics.totalDays} days of data
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-display-small font-bold text-neutral-900 dark:text-white">
              {summaryMetrics.latestInclusionDelay.toFixed(2)}s
            </div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400">Avg Delay</div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {summaryMetrics.totalDays} days avg
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-display-small font-bold text-neutral-900 dark:text-white">
              {syncCommitteeData?.participation_rate?.toFixed(1) || '0'}%
            </div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400">Sync Committee</div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {syncCommitteeData?.periods_participated || 0} periods
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Performance Chart */}
      <div className="relative">
        <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            Daily Performance Trends
          </h2>
          <div className="flex space-x-2">
            {[7, 30, 90].map(days => (
              <GlassButton
                key={days}
                onClick={() => setSelectedDays(days)}
                variant={selectedDays === days ? "primary" : "secondary"}
                size="sm"
              >
                {days}d
              </GlassButton>
            ))}
          </div>
        </div>
        
        {chartConfig && (
          <div className="pt-16">
            <LineChart
              data={chartConfig.data}
              lines={chartConfig.lines}
              xAxisDataKey="date"
              xAxisType="category"
              xAxisLabel="Date"
              yAxisLabel="Percentage (%)"
              yDomain={[95, 100]}
              showLegend={true}
            />
          </div>
        )}
      </div>

      {/* Current Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">7-Day Trend</div>
            <div className={`text-sm mt-2 ${summaryMetrics.trendDisplay.color}`}>
              {summaryMetrics.trendDisplay.icon} {summaryMetrics.trendDisplay.text}
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              Recent vs previous week
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">Validators</div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mt-2">
              {validatorsList.filter(v => v.status?.toLowerCase().includes('active')).length} Active
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {validatorsList.filter(v => v.status === 'Exited' || v.status === 'Slashed').length} Exited
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">Latest Day Status</div>
            <div className={`inline-flex px-3 py-2 rounded-full text-sm font-medium mt-2 ${performanceStatus.bgColor} ${performanceStatus.color}`}>
              {performanceStatus.label}
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
              {formatPerformanceMetric(summaryMetrics.actualLatestPerformance)}% today
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">MEV Analytics</div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mt-2">
              {mevAnalytics?.mev_blocks_percentage?.toFixed(0) || '0'}% MEV-boost
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {(mevAnalytics?.total_value_eth || 0).toFixed(3)} ETH earned
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <div className="text-center">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">Sync Committee</div>
            <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mt-2">
              {syncCommitteeData?.successful_attestations || 0} successful
            </div>
            <div className="text-label-small text-neutral-500 dark:text-neutral-500">
              {syncCommitteeData?.missed_attestations || 0} missed
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard size="medium">
          <h3 className="text-headline-medium font-semibold text-neutral-900 dark:text-white mb-4">
            Accuracy Breakdown
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Head', value: summaryMetrics.avgHeadAccuracy, color: 'bg-green-500' },
              { label: 'Target', value: performanceData.daily_performance.reduce((sum, day) => sum + day.target_accuracy, 0) / performanceData.daily_performance.length, color: 'bg-blue-500' },
              { label: 'Source', value: performanceData.daily_performance.reduce((sum, day) => sum + day.source_accuracy, 0) / performanceData.daily_performance.length, color: 'bg-purple-500' }
            ].map(item => (
              <div key={item.label} className="flex items-center">
                <div className="w-16 text-label-medium text-neutral-600 dark:text-neutral-400">{item.label}:</div>
                <div className="flex-1 mx-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${item.value}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-12 text-sm font-medium text-neutral-900 dark:text-white text-right">
                  {formatPerformanceMetric(item.value)}%
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-label-medium text-neutral-600 dark:text-neutral-400">
            <div>Inclusion Delay: {summaryMetrics.avgInclusionDelay.toFixed(2)}s avg</div>
            <div>Best Day: {formatPerformanceMetric(Math.max(...performanceData.daily_performance.map(d => d.attestation_performance)))}%</div>
            <div>Worst Day: {formatPerformanceMetric(Math.min(...performanceData.daily_performance.map(d => d.attestation_performance)))}%</div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <h3 className="text-headline-medium font-semibold text-neutral-900 dark:text-white mb-4">
            Performance Distribution
          </h3>
          <div className="space-y-3">
            {[
              { label: '99-100%', min: 99, max: 100, color: 'bg-green-500' },
              { label: '98-99%', min: 98, max: 99, color: 'bg-yellow-500' },
              { label: '97-98%', min: 97, max: 98, color: 'bg-orange-500' },
              { label: 'Below 97%', min: 0, max: 97, color: 'bg-red-500' }
            ].map((item, index) => {
              const count = performanceData.daily_performance.filter(d => {
                const perf = d.attestation_performance;
                if (index === 0) return perf >= 99; // 99-100%
                if (index === 1) return perf >= 98 && perf < 99; // 98-99%
                if (index === 2) return perf >= 97 && perf < 98; // 97-98%
                return perf < 97; // Below 97%
              }).length;
              const percentage = (count / performanceData.daily_performance.length) * 100;
              
              return (
                <div key={item.label} className="flex items-center">
                  <div className="w-24 text-label-medium text-neutral-600 dark:text-neutral-400">{item.label}:</div>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-sm font-medium text-neutral-900 dark:text-white text-right">
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-label-medium text-neutral-600 dark:text-neutral-400">
            <div>Consistency Score: {Math.max(0, (10 - (Math.max(...performanceData.daily_performance.map(d => d.attestation_performance)) - Math.min(...performanceData.daily_performance.map(d => d.attestation_performance))))).toFixed(1)}/10</div>
            <div>Better than {networkComparison?.percentile || 0}% of operators</div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <h3 className="text-headline-medium font-semibold text-neutral-900 dark:text-white mb-4">
            MEV & Proposal Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Proposal Success Rate:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{mevAnalytics?.proposal_success_rate?.toFixed(1) || '100.0'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">MEV-boost Usage:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{mevAnalytics?.mev_blocks_percentage?.toFixed(1) || '0.0'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Total Proposal Rewards:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{(mevAnalytics?.total_value_eth || 0).toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">MEV Rewards:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{(mevAnalytics?.mev_rewards_eth || 0).toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Avg Proposal Value:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{(mevAnalytics?.average_value_eth || 0).toFixed(6)} ETH</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard size="medium">
          <h3 className="text-headline-medium font-semibold text-neutral-900 dark:text-white mb-4">
            Sync Committee Analytics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Participation Rate:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{syncCommitteeData?.participation_rate?.toFixed(2) || '0.00'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Periods Served:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{syncCommitteeData?.periods_participated || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Total Attestations:</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{syncCommitteeData?.total_attestations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Successful:</span>
              <span className="text-sm font-medium text-success-500">{syncCommitteeData?.successful_attestations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-medium text-neutral-600 dark:text-neutral-400">Missed:</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{syncCommitteeData?.missed_attestations || 0}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Recent Performance Table */}
      <GlassCard hoverable={false}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            Recent Performance (Last 7 Days)
          </h2>
          <GlassButton size="sm" variant="secondary">
            Export CSV
          </GlassButton>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden lg:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
            <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr", gap: "12px"}}>
              <div>Date</div>
              <div className="text-right">Performance</div>
              <div className="text-right">Head</div>
              <div className="text-right">Target</div>
              <div className="text-right">Source</div>
              <div className="text-right">Delay</div>
              <div className="text-right">Sync Comm</div>
              <div className="text-right">Net Rewards</div>
            </div>
          </div>
          
          {/* Scrollable Body */}
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <div className="divide-y divide-white/5 dark:divide-white/10">
              {performanceData.daily_performance.slice(0, 7).map((day, index) => (
                <div 
                  key={day.date}
                  className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                    index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                  }`}
                  style={{gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr", gap: "12px"}}
                >
                  <div>{day.date}</div>
                  <div className="text-right font-medium">
                    {formatPerformanceMetric(day.attestation_performance)}%
                  </div>
                  <div className="text-right">
                    {formatPerformanceMetric(day.head_accuracy)}%
                  </div>
                  <div className="text-right">
                    {formatPerformanceMetric(day.target_accuracy)}%
                  </div>
                  <div className="text-right">
                    {formatPerformanceMetric(day.source_accuracy)}%
                  </div>
                  <div className="text-right">
                    {day.avg_inclusion_delay.toFixed(2)}s
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 dark:text-gray-400">-</span>
                  </div>
                  <div className="text-right">
                    {(day.net_rewards / 1e9).toFixed(6)} ETH
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden space-y-3">
          {performanceData.daily_performance.slice(0, 7).map((day, index) => (
            <div 
              key={day.date}
              className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-lg border border-white/10 dark:border-white/15 p-4"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">{day.date}</div>
                <div className="text-lg font-bold text-primary-500">
                  {formatPerformanceMetric(day.attestation_performance)}%
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Head:</span>
                  <span className="text-neutral-900 dark:text-white font-medium">{formatPerformanceMetric(day.head_accuracy)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Target:</span>
                  <span className="text-neutral-900 dark:text-white font-medium">{formatPerformanceMetric(day.target_accuracy)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Source:</span>
                  <span className="text-neutral-900 dark:text-white font-medium">{formatPerformanceMetric(day.source_accuracy)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Delay:</span>
                  <span className="text-neutral-900 dark:text-white font-medium">{day.avg_inclusion_delay.toFixed(2)}s</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-white/10 dark:border-white/15">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400 text-xs">Net Rewards:</span>
                  <span className="text-neutral-900 dark:text-white font-medium text-sm">{(day.net_rewards / 1e9).toFixed(6)} ETH</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Validators List Table */}
      <GlassCard size="large" hoverable={false}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            Validators ({validatorsList.length})
          </h2>
          <GlassButton size="sm" variant="secondary">
            Export CSV
          </GlassButton>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
            <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "1fr 2.5fr 1.2fr 1.5fr 1.5fr", gap: "12px"}}>
              <div>Validator Index</div>
              <div>Public Key</div>
              <div>Status</div>
              <div>Activation Date</div>
              <div>Exit Date</div>
            </div>
          </div>
          
          {/* Scrollable Body */}
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <div className="divide-y divide-white/5 dark:divide-white/10">
              {validatorsList.map((validator, index) => (
                <div 
                  key={validator.validator_index}
                  className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                    index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                  }`}
                  style={{gridTemplateColumns: "1fr 2.5fr 1.2fr 1.5fr 1.5fr", gap: "12px"}}
                >
                  <div className="font-mono">
                    {validator.validator_index}
                  </div>
                  <div className="font-mono text-xs break-all">
                    {validator.public_key || '-'}
                  </div>
                  <div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      validator.status?.toLowerCase().includes('active') 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : validator.status?.toLowerCase().includes('exit') || validator.status?.toLowerCase().includes('slashed')
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {validator.status}
                    </span>
                  </div>
                  <div>
                    {validator.activation_date || '-'}
                  </div>
                  <div>
                    {validator.exit_date || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3 max-h-96 overflow-y-auto">
          {validatorsList.map((validator, index) => (
            <div 
              key={validator.validator_index}
              className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-lg border border-white/10 dark:border-white/15 p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white font-mono">
                    Validator #{validator.validator_index}
                  </div>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      validator.status?.toLowerCase().includes('active') 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : validator.status?.toLowerCase().includes('exit') || validator.status?.toLowerCase().includes('slashed')
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {validator.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-600 dark:text-neutral-400">Public Key:</span>
                  <div className="font-mono text-neutral-900 dark:text-white break-all mt-1">
                    {validator.public_key ? 
                      `${validator.public_key.slice(0, 20)}...${validator.public_key.slice(-20)}` 
                      : '-'
                    }
                  </div>
                </div>
                
                {validator.activation_date && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Activated:</span>
                    <span className="text-neutral-900 dark:text-white font-medium">{validator.activation_date}</span>
                  </div>
                )}
                
                {validator.exit_date && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Exited:</span>
                    <span className="text-neutral-900 dark:text-white font-medium">{validator.exit_date}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Cost Analysis Section */}
      {costData && costData.operator_costs && operatorAddress && costData.operator_costs[operatorAddress] && (
        <GlassCard size="large" hoverable={false}>
          <h2 className="text-headline-large font-semibold text-neutral-900 dark:text-white mb-6">
            Cost Analysis
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Cost */}
            <GlassCard size="small" className="p-4">
              <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mb-1">Total Gas Cost</div>
              <div className="text-display-small font-bold text-neutral-900 dark:text-white">
                {costData.operator_costs[operatorAddress].total_cost_eth.toFixed(6)} ETH
              </div>
              <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
                ${(costData.operator_costs[operatorAddress].total_cost_eth * 3200).toFixed(2)} USD
              </div>
            </GlassCard>

            {/* Transaction Success Rate */}
            <GlassCard size="small" className="p-4">
              <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mb-1">Transaction Success</div>
              <div className="text-display-small font-bold text-neutral-900 dark:text-white">
                {((costData.operator_costs[operatorAddress].successful_txs / costData.operator_costs[operatorAddress].total_txs) * 100).toFixed(1)}%
              </div>
              <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
                {costData.operator_costs[operatorAddress].successful_txs} of {costData.operator_costs[operatorAddress].total_txs} transactions
              </div>
            </GlassCard>

            {/* Cost Per Validator */}
            <GlassCard size="small" className="p-4">
              <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mb-1">Cost Per Validator</div>
              <div className="text-display-small font-bold text-neutral-900 dark:text-white">
                {(costData.operator_costs[operatorAddress].total_cost_eth / Math.max(1, costData.operator_costs[operatorAddress].total_validators_created)).toFixed(6)} ETH
              </div>
              <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
                {costData.operator_costs[operatorAddress].total_validators_created} validators created
              </div>
            </GlassCard>

            {/* Average Cost Per Transaction */}
            <GlassCard size="small" className="p-4">
              <div className="text-label-medium text-neutral-600 dark:text-neutral-400 mb-1">Avg Cost Per Tx</div>
              <div className="text-display-small font-bold text-neutral-900 dark:text-white">
                {costData.operator_costs[operatorAddress].avg_cost_per_tx.toFixed(6)} ETH
              </div>
              <div className="text-label-small text-neutral-500 dark:text-neutral-500 mt-1">
                Gas efficiency metric
              </div>
            </GlassCard>
          </div>

          {/* Recent Transactions */}
          {costData.operator_transactions && operatorAddress && costData.operator_transactions[operatorAddress] && (
            <div>
              <h3 className="text-headline-medium font-semibold text-neutral-900 dark:text-white mb-4">
                Recent Transactions ({costData.operator_transactions[operatorAddress].length})
              </h3>
              
              {/* Desktop Table */}
              <div className="hidden md:block bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 overflow-hidden">
                {/* Header */}
                <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15 px-4 py-3">
                  <div className="grid grid-cols-5 gap-4 font-semibold text-neutral-900 dark:text-white text-sm">
                    <div>Date</div>
                    <div>Transaction Hash</div>
                    <div>Status</div>
                    <div>Validators</div>
                    <div>Cost (ETH)</div>
                  </div>
                </div>
                
                {/* Transactions */}
                <div className="max-h-64 overflow-y-auto">
                  {costData.operator_transactions[operatorAddress]
                    .slice(0, 10) // Show only last 10 transactions
                    .map((tx: any, index: number) => (
                    <div 
                      key={tx.hash}
                      className={`px-4 py-3 border-b border-white/5 dark:border-white/10 last:border-b-0 hover:bg-white/5 dark:hover:bg-white/2 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-50/20 dark:bg-gray-800/10' : 'bg-transparent'
                      }`}
                    >
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div className="text-neutral-900 dark:text-white">
                          {tx.date}
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tx.time}</div>
                        </div>
                        <div className="font-mono text-xs text-gray-700 dark:text-gray-300">
                          <a 
                            href={`https://etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {tx.hash.slice(0, 12)}...{tx.hash.slice(-8)}
                          </a>
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            tx.status === 'Successful'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-neutral-900 dark:text-white font-medium">
                          {tx.validator_count}
                        </div>
                        <div className="text-neutral-900 dark:text-white font-mono">
                          {tx.total_cost_eth.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3 max-h-80 overflow-y-auto">
                {costData.operator_transactions[operatorAddress]
                  .slice(0, 10)
                  .map((tx: any, index: number) => (
                  <div 
                    key={tx.hash}
                    className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-lg border border-white/10 dark:border-white/15 p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {tx.date}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {tx.time}
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          tx.status === 'Successful'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-neutral-600 dark:text-neutral-400">Transaction:</span>
                        <div className="font-mono text-neutral-900 dark:text-white mt-1">
                          <a 
                            href={`https://etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-all"
                          >
                            {tx.hash.slice(0, 16)}...{tx.hash.slice(-16)}
                          </a>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-neutral-400">Validators:</span>
                          <span className="text-neutral-900 dark:text-white font-medium">{tx.validator_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-neutral-400">Cost:</span>
                          <span className="text-neutral-900 dark:text-white font-mono font-medium">{tx.total_cost_eth.toFixed(6)} ETH</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}
      </div>
    </div>
  );
};

export default OperatorDashboard;