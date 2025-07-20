import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { analyticsService } from '../../services/analytics';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';
import PieChartComponent from '../charts/PieChart';
import { GasAnalysis } from '../../types/api';

const GasAnalysisTab: React.FC = () => {
  const [gasData, setGasData] = useState<GasAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchGasData = async () => {
      try {
        setLoading(true);
        const data = await apiService.getGasAnalysis();
        setGasData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load gas analysis data');
        console.error('Error fetching gas analysis data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGasData();
  }, []);

  const downloadCSV = (data: any[], filename: string) => {
    analyticsService.trackDownload('gas_analysis_csv');
    
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

  const handleDownloadStrategies = () => {
    if (!gasData) return;
    
    const csvData = gasData.operator_details.map(op => ({
      operator: op.operator,
      strategy: op.strategy,
      max_gas_limit: op.max_gas_limit
    }));

    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    downloadCSV(csvData, `gas_strategies_${timestamp}.csv`);
  };

  const getStrategyColor = (strategy: string): string => {
    const colors: Record<string, string> = {
      'ultra': '#16a34a',  // Green for 60M+ (was red)
      'high': '#2563eb',   // Blue for 45M+ (was orange)
      'normal': '#ea580c', // Orange for 36M+ (was blue)
      'low': '#dc2626'     // Red for 30M+ (was green)
    };
    return colors[strategy] || '#6b7280';
  };

  const formatGasLimit = (gasLimit: number): string => {
    if (gasLimit >= 1000000) {
      return (gasLimit / 1000000).toFixed(1) + 'M';
    } else if (gasLimit >= 1000) {
      return (gasLimit / 1000).toFixed(1) + 'K';
    }
    return gasLimit.toString();
  };

  const getStrategyLabel = (strategy: string): string => {
    const labels: Record<string, string> = {
      'ultra': 'Ultra (≥60M)',
      'high': 'High (≥45M)',
      'normal': 'Normal (≥36M)',
      'low': 'Low (≥30M)'
    };
    return labels[strategy] || strategy;
  };

  const getFilteredAndSortedOperators = () => {
    if (!gasData?.operator_details) return [];
    
    // Filter by search term
    let filtered = gasData.operator_details.filter(op => 
      op.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.strategy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.operator_name && op.operator_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    // Sort by max gas limit (high to low)
    filtered.sort((a, b) => b.max_gas_limit - a.max_gas_limit);
    
    return filtered;
  };

  const downloadFilteredCSV = () => {
    const filteredData = getFilteredAndSortedOperators();
    if (filteredData.length === 0) return;
    
    const csvData = filteredData.map(op => ({
      address: op.operator,
      ens_name: op.operator_name || '',
      strategy: op.strategy,
      max_gas_limit: op.max_gas_limit
    }));

    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    downloadCSV(csvData, `filtered_gas_strategies_${timestamp}.csv`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            <Icon name="gasAnalysis" size="lg" color="primary" className="inline mr-2" />Gas Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gas limit strategies and distribution analysis
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="warning" size="lg" color="danger" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Gas Data</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gasData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No gas analysis data available</div>
      </div>
    );
  }

  const strategyChartData = Object.entries(gasData.strategies).map(([strategy, count]) => ({
    name: getStrategyLabel(strategy),
    value: count,
    color: getStrategyColor(strategy)
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          <Icon name="gasAnalysis" size="lg" color="primary" className="inline mr-2" />Gas Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gas limit strategies and distribution analysis
        </p>
      </div>

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassCard>
            <div className="flex items-center">
              <Icon name="metrics" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Average Gas Limit</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {formatGasLimit(gasData.average_gas_limit)}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Network average
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="chart" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Median Gas Limit</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {formatGasLimit(gasData.median_gas_limit)}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Network median
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="trendingUp" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Max Gas Limit</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {formatGasLimit(gasData.gas_limit_range.max)}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Highest observed
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="trendingDown" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Min Gas Limit</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {formatGasLimit(gasData.gas_limit_range.min)}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Lowest observed
            </p>
          </GlassCard>
        </div>

        {/* Strategy Distribution */}
        <GlassCard hoverable={false}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              <Icon name="chart" size="lg" color="primary" className="inline mr-2" />Gas Strategy Distribution
            </h3>
            <GlassButton onClick={handleDownloadStrategies} variant="success" size="sm">
              <Icon name="download" size="sm" color="current" className="mr-2" />
              Download CSV
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div>
              <PieChartComponent
                data={strategyChartData}
                title="Strategy Distribution"
                colorPalette="categorical"
                innerRadius={40}
                outerRadius={100}
                enableAnimations={true}
                showLegend={false}
              />
            </div>

            {/* Strategy Legend & Stats */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Strategy Details
              </h4>
              {strategyChartData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/30 dark:bg-white/5 rounded-lg border border-white/20">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {entry.value}
                    </div>
                    <div className="text-xs text-gray-500">
                      {((entry.value / gasData.operator_details.length) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>


        {/* Full Operator Details Table */}
        <GlassCard size="large" hoverable={false}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <Icon name="chart" size="lg" color="primary" className="inline mr-2" />All Operator Gas Strategies
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sorted by max gas limit (high to low)
              </p>
            </div>
            <GlassButton
              onClick={downloadFilteredCSV}
              variant="primary"
              size="sm"
            >
              <Icon name="download" size="sm" color="current" className="inline mr-2" />Download CSV
            </GlassButton>
          </div>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search operators by address or strategy"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {searchTerm ? (
                  <>Showing {getFilteredAndSortedOperators().length} operators matching '{searchTerm}'</>
                ) : (
                  <>Showing all {getFilteredAndSortedOperators().length} operators (sorted by max gas limit)</>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Total in dataset: {gasData?.operator_details?.length || 0}
              </p>
            </div>
          </div>
          
          <div className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
              <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "2.5fr 2fr 2.5fr 1.8fr", gap: "12px"}}>
                <div>Address</div>
                <div>ENS Name</div>
                <div>Strategy</div>
                <div>Max Gas Limit</div>
              </div>
            </div>
            
            {/* Scrollable Body */}
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <div className="divide-y divide-white/5 dark:divide-white/10">
                {getFilteredAndSortedOperators().map((op, index) => (
                  <div 
                    key={`${op.operator}-${index}`}
                    className="grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium"
                    style={{gridTemplateColumns: "2.5fr 2fr 2.5fr 1.8fr", gap: "12px"}}
                  >
                    <div className="font-mono text-xs">
                      {op.operator}
                    </div>
                    <div>
                      {op.operator_name && op.operator_name !== op.operator ? op.operator_name : '-'}
                    </div>
                    <div>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getStrategyColor(op.strategy) }}
                        ></div>
                        <span className="text-sm capitalize font-medium">
                          {op.strategy.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {formatGasLimit(op.max_gas_limit)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default GasAnalysisTab;