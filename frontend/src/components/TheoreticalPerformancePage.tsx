import React, { useState, useEffect } from 'react';
import { TheoreticalPerformanceData } from '../types/api';
import { apiService } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import Icon from './common/Icon';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from './common/GlassTable';

const TheoreticalPerformancePage: React.FC = () => {
  const [data, setData] = useState<TheoreticalPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Ensure loading state is visible for at least 500ms
        const [theoreticalData] = await Promise.all([
          apiService.getTheoreticalPerformance(),
          new Promise(resolve => setTimeout(resolve, 500))
        ]);
        
        // Sort by operator_reward_percentage high to low
        const sortedData = theoreticalData.sort((a, b) => b.operator_reward_percentage - a.operator_reward_percentage);
        
        setData(sortedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch theoretical performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to format rewards
  const formatRewards = (rewards: number): string => {
    return (rewards / 1000000000).toFixed(4); // Convert wei to Gwei and format
  };

  // Helper function to get performance color
  const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 99.5) return 'text-blue-600 dark:text-blue-400';
    if (percentage >= 99.0) return 'text-green-600 dark:text-green-400';
    if (percentage >= 98.0) return 'text-yellow-600 dark:text-yellow-400';
    if (percentage >= 97.0) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
              <Icon name="metrics" size="lg" color="primary" />
              Theoretical Performance Analysis
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
                    Loading theoretical performance data from the database...
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Content */}
          <div className="
            bg-glass-light dark:bg-glass-dark 
            backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
            border border-gray-200 dark:border-white/15
            rounded-2xl 
            shadow-glass-light dark:shadow-glass-dark
            p-12
          ">
            <div className="flex flex-col items-center justify-center space-y-6">
              <LoadingSpinner size="lg" />
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Loading, please wait...
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                  Fetching theoretical performance data from the database
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  This may take a few moments as we analyze all operator performance metrics
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="
            bg-glass-light dark:bg-glass-dark 
            backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
            border border-red-200 dark:border-red-800/50
            rounded-2xl 
            shadow-glass-light dark:shadow-glass-dark
            p-6
            bg-red-50/50 dark:bg-red-900/20
          ">
            <div className="flex items-center">
              <Icon name="warning" size="lg" color="danger" className="mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error Loading Data</h3>
                <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <Icon name="metrics" size="lg" color="primary" />
            Theoretical Performance Analysis
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
                  Theoretical performance analysis showing actual vs maximum possible attestation rewards over a 1 day period (225 epochs).
                  Data is aggregated by operator and sorted by reward percentage (high to low).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
            ">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : data.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Operators
              </div>
            </div>
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
            ">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : data.reduce((sum, op) => sum + op.validator_count, 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Validators
              </div>
            </div>
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
            ">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : data.length > 0 ? (data.reduce((sum, op) => sum + op.operator_reward_percentage, 0) / data.length).toFixed(2) + '%' : '0.00%'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Average Performance
              </div>
            </div>
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
            ">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : data.length > 0 ? data[0].operator_reward_percentage.toFixed(2) + '%' : '0.00%'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Best Performance
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="
          bg-glass-light dark:bg-glass-dark 
          backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
          border border-gray-200 dark:border-white/15
          rounded-2xl 
          shadow-glass-light dark:shadow-glass-dark
          overflow-hidden
        ">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="chart" size="lg" color="primary" />
              Theoretical Performance Data
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {loading ? 'Loading data...' : `Showing ${data.length} operators sorted by reward percentage`}
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <LoadingSpinner size="lg" />
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Loading, please wait...
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Fetching theoretical performance data from the database
                </p>
              </div>
            </div>
          ) : (
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell header>Rank</GlassTableCell>
                  <GlassTableCell header>Operator</GlassTableCell>
                  <GlassTableCell header>Validators</GlassTableCell>
                  <GlassTableCell header>Reward %</GlassTableCell>
                  <GlassTableCell header>Actual Rewards (Gwei)</GlassTableCell>
                  <GlassTableCell header>Max Rewards (Gwei)</GlassTableCell>
                  <GlassTableCell header>Attestations Made</GlassTableCell>
                  <GlassTableCell header>Attestations Missed</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {data.map((operator, index) => (
                  <GlassTableRow key={operator.operator} hoverable>
                    <GlassTableCell className="font-medium">
                      {index + 1}
                    </GlassTableCell>
                    <GlassTableCell className="font-mono text-xs">
                      {operator.operator}
                    </GlassTableCell>
                    <GlassTableCell className="text-center">
                      {operator.validator_count}
                    </GlassTableCell>
                    <GlassTableCell className={`font-bold ${getPerformanceColor(operator.operator_reward_percentage)}`}>
                      {operator.operator_reward_percentage.toFixed(3)}%
                    </GlassTableCell>
                    <GlassTableCell className="font-mono text-right">
                      {formatRewards(operator.total_actual_rewards)}
                    </GlassTableCell>
                    <GlassTableCell className="font-mono text-right">
                      {formatRewards(operator.total_theoretical_max_rewards)}
                    </GlassTableCell>
                    <GlassTableCell className="text-center">
                      {operator.total_attestations_made}
                    </GlassTableCell>
                    <GlassTableCell className="text-center">
                      {operator.total_attestations_missed}
                    </GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Analysis period: {data.length > 0 ? `${data[0].epochs_analyzed} epochs` : 'N/A'} | 
            Latest epoch: {data.length > 0 ? data[0].latest_epoch : 'N/A'} | 
            Start epoch: {data.length > 0 ? data[0].start_epoch : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TheoreticalPerformancePage;