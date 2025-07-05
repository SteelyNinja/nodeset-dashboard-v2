import React, { useState, useEffect } from 'react';
import { ValidatorData, ExitData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import BarChartComponent from '../charts/BarChart';
import GlassCard from '../common/GlassCard';

interface DistributionStats {
  maxValidators: number;
  avgValidators: number;
  medianValidators: number;
  minValidators: number;
  totalValidators: number;
  totalOperators: number;
  top3Percentage: number;
  top5Percentage: number;
  top10Percentage: number;
  belowAvgPercentage: number;
  validatorsToCapLevel: number;
  ethToCapLevel: number;
  operatorsAtCapPercentage: number;
  operatorsAtCapCount: number;
  operatorsNearCapPercentage: number;
  operatorsNearCapCount: number;
}

const DistributionTab: React.FC = () => {
  const [distributionStats, setDistributionStats] = useState<DistributionStats | null>(null);
  const [histogramData, setHistogramData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [validatorData, exitData] = await Promise.all([
        apiService.getValidatorData(),
        apiService.getData<ExitData>('exit-data')
      ]);
      
      const operatorValidators = validatorData.operator_validators || {};
      
      // Create a map of exits by operator
      const operatorExits: Record<string, number> = {};
      if (exitData?.operators_with_exits) {
        exitData.operators_with_exits.forEach((op) => {
          operatorExits[op.operator] = op.exits || 0;
        });
      }
      
      // Calculate active validators for each operator (total - exits)
      const activeValidatorsByOperator: Record<string, number> = {};
      Object.entries(operatorValidators).forEach(([operator, total]) => {
        const exits = operatorExits[operator] || 0; // 0 exits if not in exit data
        const active = Math.max(0, total - exits); // Ensure non-negative
        if (active > 0) { // Only include operators with active validators
          activeValidatorsByOperator[operator] = active;
        }
      });
      
      // Calculate distribution statistics using ACTIVE validators
      const activeValidatorCounts = Object.values(activeValidatorsByOperator);
      
      if (activeValidatorCounts.length === 0) {
        setError('No active validator data available');
        return;
      }
      
      const totalActiveValidators = activeValidatorCounts.reduce((sum, count) => sum + count, 0);
      const totalActiveOperators = activeValidatorCounts.length;
      const avgValidators = totalActiveValidators / totalActiveOperators;
      const sortedCounts = [...activeValidatorCounts].sort((a, b) => b - a);
      
      const maxValidators = Math.max(...activeValidatorCounts);
      const minValidators = Math.min(...activeValidatorCounts);
      const medianValidators = sortedCounts[Math.floor(sortedCounts.length / 2)];
      
      console.log('Distribution Debug:', {
        maxValidators,
        minValidators,
        totalActiveOperators,
        totalActiveValidators,
        operatorsWithMaxValidators: activeValidatorCounts.filter(count => count === maxValidators).length
      });
      
      // Calculate top operator percentages
      const top3Sum = sortedCounts.slice(0, 3).reduce((sum, count) => sum + count, 0);
      const top5Sum = sortedCounts.slice(0, 5).reduce((sum, count) => sum + count, 0);
      const top10Sum = sortedCounts.slice(0, 10).reduce((sum, count) => sum + count, 0);
      
      const top3Percentage = (top3Sum / totalActiveValidators) * 100;
      const top5Percentage = (top5Sum / totalActiveValidators) * 100;
      const top10Percentage = (top10Sum / totalActiveValidators) * 100;
      
      // Calculate below average operators
      const belowAvgCount = activeValidatorCounts.filter(count => count < avgValidators).length;
      const belowAvgPercentage = (belowAvgCount / totalActiveOperators) * 100;
      
      // Calculate validators needed to reach cap (max level)
      const capLevel = maxValidators;
      const validatorsToCapLevel = activeValidatorCounts.reduce((sum, count) => sum + Math.max(0, capLevel - count), 0);
      const ethToCapLevel = validatorsToCapLevel * 32; // 32 ETH per validator
      
      // Calculate operators at cap and near cap
      const operatorsAtCapCount = activeValidatorCounts.filter(count => count === capLevel).length;
      const operatorsAtCapPercentage = (operatorsAtCapCount / totalActiveOperators) * 100;
      const operatorsNearCapCount = activeValidatorCounts.filter(count => count >= capLevel * 0.75).length;
      const operatorsNearCapPercentage = (operatorsNearCapCount / totalActiveOperators) * 100;
      
      setDistributionStats({
        maxValidators,
        avgValidators,
        medianValidators,
        minValidators,
        totalValidators: totalActiveValidators,
        totalOperators: totalActiveOperators,
        top3Percentage,
        top5Percentage,
        top10Percentage,
        belowAvgPercentage,
        validatorsToCapLevel,
        ethToCapLevel,
        operatorsAtCapPercentage,
        operatorsAtCapCount,
        operatorsNearCapPercentage,
        operatorsNearCapCount
      });
      
      // Create histogram data for chart - one bar per validator count up to max
      const histogramData: Record<number, number> = {};
      
      // Initialize all possible validator counts from 1 to max with 0
      for (let i = 1; i <= maxValidators; i++) {
        histogramData[i] = 0;
      }
      
      // Count operators for each active validator count
      activeValidatorCounts.forEach(count => {
        if (count >= 1 && count <= maxValidators) {
          histogramData[count]++;
        }
      });
      
      // Convert to chart format
      const chartData = Object.entries(histogramData).map(([validatorCount, operatorCount]) => ({
        name: validatorCount,
        value: operatorCount
      }));
      
      setHistogramData(chartData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch distribution data');
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

  if (!distributionStats) {
    return <ErrorMessage message="No distribution data available" className="m-4" />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📈 Distribution Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Validator distribution across all operators
        </p>
      </div>

      {/* Histogram Chart */}
      <div className="mb-8">
        <BarChartComponent
          data={histogramData}
          title="Distribution of Validators per Operator"
          color="#667eea"
          xAxisDataKey="name"
          xAxisLabel="Validators per Operator"
          yAxisLabel="Number of Operators"
          className="shadow-lg border border-gray-200 dark:border-gray-700"
        />
      </div>

      {/* Key Insights Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          📊 Key Insights
        </h2>
        
        {/* Basic Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Largest Operator</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.maxValidators.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Average per Operator</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.avgValidators.toFixed(1)}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Median per Operator</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.medianValidators.toFixed(1)}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Smallest Operator</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.minValidators.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">validators</div>
          </GlassCard>
        </div>

        {/* Concentration Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Top 3 Operators Control</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.top3Percentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">of all validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Top 5 Operators Control</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.top5Percentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">of all validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Top 10 Operators Control</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.top10Percentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">of all validators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Below Average Operators</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.belowAvgPercentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">of all operators</div>
          </GlassCard>
        </div>

        {/* Cap Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Validators to Cap</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.validatorsToCapLevel.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total needed to reach cap level</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">ETH to Cap</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.ethToCapLevel.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">@ 32 ETH per validator</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Operators at Cap</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.operatorsAtCapPercentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{distributionStats.operatorsAtCapCount} operators</div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Operators at 75%+ of Cap</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{distributionStats.operatorsNearCapPercentage.toFixed(1)}%</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{distributionStats.operatorsNearCapCount} ops (≥75% of cap)</div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default DistributionTab;