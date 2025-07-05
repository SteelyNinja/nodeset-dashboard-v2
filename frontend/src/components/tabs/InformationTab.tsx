import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassCard from '../common/GlassCard';
import { ValidatorData, ConcentrationMetrics, PerformanceAnalysis, ClientDiversity } from '../../types/api';

const InformationTab: React.FC = () => {
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [concentrationData, setConcentrationData] = useState<ConcentrationMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceAnalysis | null>(null);
  const [clientData, setClientData] = useState<ClientDiversity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Fetch all overview data in parallel
        const [validator, concentration, performance, client] = await Promise.all([
          apiService.getValidatorData(),
          apiService.getConcentrationMetrics(),
          apiService.getPerformanceAnalysis(),
          apiService.getClientDiversity()
        ]);

        setValidatorData(validator);
        setConcentrationData(concentration);
        setPerformanceData(performance);
        setClientData(client);
        setError(null);
      } catch (err) {
        setError('Failed to load network information');
        console.error('Error fetching network information:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const formatDate = (timestamp: string | number): string => {
    try {
      const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp * 1000);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number): string => {
    return (num * 100).toFixed(2) + '%';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            ℹ️ Network Information
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive network overview and statistics
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Network Data</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeValidators = validatorData ? validatorData.total_validators - (validatorData.total_exited || 0) : 0;

  // Calculate health status indicators
  const networkHealthStatus = () => {
    if (!concentrationData || !validatorData) return { status: '🟡', text: 'Loading...' };
    
    const gini = concentrationData.gini_coefficient;
    const exitRate = (validatorData.total_exited || 0) / validatorData.total_validators;
    const avgValidatorsPerOperator = validatorData.total_validators / concentrationData.total_operators;
    
    const wellDecentralized = gini < 0.1; // Lower Gini = more decentralized
    const lowExitRate = exitRate < 0.05; // Less than 5% exit rate
    const smallOperators = avgValidatorsPerOperator < 20; // Average operator size
    const mostlyActivated = activeValidators / validatorData.total_validators > 0.95; // 95%+ active
    
    return {
      wellDecentralized,
      lowExitRate,
      smallOperators,
      mostlyActivated,
      overallStatus: wellDecentralized && lowExitRate && smallOperators ? '🟢' : '🟡'
    };
  };

  const performanceHealthStatus = () => {
    if (!performanceData) return { 
      status: '🟡', 
      text: 'Loading...',
      excellentPerformance: false,
      lowPoorRate: false,
      excellentPercent: 0,
      poorPercent: 0,
      overallStatus: '🟡'
    };
    
    const total = performanceData.excellent_count + performanceData.good_count + 
                  performanceData.average_count + performanceData.poor_count;
    const excellentPercent = total > 0 ? (performanceData.excellent_count / total * 100) : 0;
    const poorPercent = total > 0 ? (performanceData.poor_count / total * 100) : 0;
    
    const excellentPerformance = excellentPercent >= 60; // 60%+ excellent
    const lowPoorRate = poorPercent < 5; // Less than 5% poor
    
    return {
      excellentPerformance,
      lowPoorRate,
      excellentPercent,
      poorPercent,
      overallStatus: excellentPerformance && lowPoorRate ? '🟢' : excellentPerformance ? '🟡' : '🟡'
    };
  };

  const ensResolutionStatus = () => {
    if (!validatorData || !concentrationData) return { 
      status: '🟡', 
      text: 'Loading...',
      ensCount: 0,
      operatorCoverage: 0,
      validatorCoverage: 0
    };
    
    // Count ENS names from validator data
    const ensNames = validatorData.ens_names || {};
    const ensCount = Object.keys(ensNames).length;
    const operatorCoverage = concentrationData.total_operators > 0 ? 
      (ensCount / concentrationData.total_operators * 100) : 0;
    
    // Estimate validator coverage (assuming ENS names cover operators proportionally)
    const validatorCoverage = validatorData.total_validators > 0 ? 
      (ensCount / concentrationData.total_operators * 100) : 0;
    
    return {
      ensCount,
      operatorCoverage,
      validatorCoverage,
      status: operatorCoverage > 30 ? '🟢' : operatorCoverage > 20 ? '🟡' : '🟡'
    };
  };

  const networkHealth = networkHealthStatus();
  const performanceHealth = performanceHealthStatus();
  const ensResolution = ensResolutionStatus();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ℹ️ Network Information
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive NodeSet validator network overview and key statistics
        </p>
      </div>

      <div className="space-y-6">
        {/* Health Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Network Health */}
          <GlassCard>
            <div className="flex items-center mb-3">
              <span className="text-xl mr-2">🌐</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Network Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="mr-2">{networkHealth.wellDecentralized ? '🟢' : '🟡'}</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.wellDecentralized ? 'Well Decentralized' : 'Moderately Decentralized'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">{networkHealth.lowExitRate ? '🟢' : '🟡'}</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.lowExitRate ? 'Low Exit Rate' : 'Moderate Exit Rate'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">{networkHealth.smallOperators ? '🟢' : '🟡'}</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.smallOperators ? 'Small Operators' : 'Medium Operators'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">{networkHealth.mostlyActivated ? '🟢' : '🟡'}</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.mostlyActivated ? 'Mostly Activated' : 'Some Inactive'}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Network Health: {networkHealth.overallStatus} {networkHealth.wellDecentralized && networkHealth.lowExitRate && networkHealth.smallOperators ? 'Well Decentralized' : 'Moderately Decentralized'} • {networkHealth.lowExitRate ? 'Low Exit Rate' : 'Moderate Exit Rate'} • {networkHealth.smallOperators ? 'Small Operators' : 'Medium Operators'} • {networkHealth.mostlyActivated ? 'Mostly Activated' : 'Some Inactive'}
              </div>
            </div>
          </GlassCard>

          {/* Performance Health */}
          <GlassCard>
            <div className="flex items-center mb-3">
              <span className="text-xl mr-2">⚡</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="mr-2">{performanceHealth.excellentPerformance ? '🟢' : '🟡'}</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.excellentPerformance ? 'Excellent Performance' : 'Good Performance'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">📊</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.excellentPercent.toFixed(1)}% Excellent
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">📉</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.poorPercent.toFixed(1)}% Poor
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Performance Health (24 hours): {performanceHealth.overallStatus} {performanceHealth.excellentPerformance ? 'Excellent Performance' : 'Good Performance'} • {performanceHealth.excellentPercent.toFixed(1)}% Excellent • {performanceHealth.poorPercent.toFixed(1)}% Poor
              </div>
            </div>
          </GlassCard>

          {/* ENS Resolution */}
          <GlassCard>
            <div className="flex items-center mb-3">
              <span className="text-xl mr-2">🏷️</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ENS Resolution</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="mr-2">📝</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.ensCount} names found
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">👥</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.operatorCoverage.toFixed(1)}% operator coverage
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="mr-2">🏛️</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.validatorCoverage.toFixed(1)}% validator coverage
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ENS / Discord Name Resolution: {ensResolution.ensCount} names found • {ensResolution.operatorCoverage.toFixed(1)}% operator coverage • {ensResolution.validatorCoverage.toFixed(1)}% validator coverage
              </div>
            </div>
          </GlassCard>
        </div>
        {/* Network Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassCard>
            <div className="flex items-center mb-2">
              <span className="text-xl mr-2">🏛️</span>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Validators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {validatorData ? formatNumber(validatorData.total_validators) : 'Loading...'}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              NodeSet network size
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center mb-2">
              <span className="text-xl mr-2">✅</span>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Active Validators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {formatNumber(activeValidators)}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Currently validating
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center mb-2">
              <span className="text-xl mr-2">👥</span>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Operators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {concentrationData ? formatNumber(concentrationData.total_operators) : 'Loading...'}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Unique operators
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center mb-2">
              <span className="text-xl mr-2">🚪</span>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Exited Validators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {validatorData ? formatNumber(validatorData.total_exited || 0) : 'Loading...'}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              No longer validating
            </p>
          </GlassCard>
        </div>

        {/* Decentralization Metrics */}
        <GlassCard size="large">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            📊 Network Decentralization
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Gini Coefficient</span>
                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {concentrationData ? concentrationData.gini_coefficient.toFixed(4) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Lower is more decentralized
              </p>
            </div>


            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Top 1% Share</span>
                <span className="text-lg font-bold text-danger-dark dark:text-danger">
                  {concentrationData ? formatPercentage(concentrationData.top_1_percent / 100) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Largest operator's share
              </p>
            </div>

            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Top 10% Share</span>
                <span className="text-lg font-bold text-warning-dark dark:text-warning">
                  {concentrationData ? formatPercentage(concentrationData.top_10_percent / 100) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Top operators' combined share
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Performance Overview */}
        <GlassCard size="large">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            ⚡ Network Performance
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-success-light/30 dark:bg-success-dark/20 rounded-lg p-4 border border-success/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800 dark:text-green-300">Excellent</span>
                <span className="text-lg font-bold text-green-600">
                  {performanceData ? formatNumber(performanceData.excellent_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ≥99.5% performance
              </p>
            </div>

            <div className="bg-info-light/30 dark:bg-info-dark/20 rounded-lg p-4 border border-info/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Good</span>
                <span className="text-lg font-bold text-blue-600">
                  {performanceData ? formatNumber(performanceData.good_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ≥98.5% performance
              </p>
            </div>

            <div className="bg-warning-light/30 dark:bg-warning-dark/20 rounded-lg p-4 border border-warning/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Average</span>
                <span className="text-lg font-bold text-yellow-600">
                  {performanceData ? formatNumber(performanceData.average_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                ≥95% performance
              </p>
            </div>

            <div className="bg-danger-light/30 dark:bg-danger-dark/20 rounded-lg p-4 border border-danger/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800 dark:text-red-300">Poor</span>
                <span className="text-lg font-bold text-red-600">
                  {performanceData ? formatNumber(performanceData.poor_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                &lt;95% performance
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Client Diversity */}
        <GlassCard size="large">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            🔧 Client Diversity
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Execution Clients
              </h4>
              <div className="space-y-2">
                {clientData && Object.entries(clientData.execution_clients || {})
                  .sort(([, a], [, b]) => (b || 0) - (a || 0))
                  .slice(0, 5)
                  .map(([client, percentage]) => (
                    <div key={client} className="flex justify-between items-center p-2 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                      <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {client}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {(percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Consensus Clients
              </h4>
              <div className="space-y-2">
                {clientData && Object.entries(clientData.consensus_clients || {})
                  .sort(([, a], [, b]) => (b || 0) - (a || 0))
                  .slice(0, 5)
                  .map(([client, percentage]) => (
                    <div key={client} className="flex justify-between items-center p-2 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                      <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {client}
                      </span>
                      <span className="text-sm font-bold text-purple-600">
                        {(percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          
        </GlassCard>

        {/* Network Status */}
        <GlassCard size="large">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            🌐 Network Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Last Block Checked
                </span>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  {validatorData ? formatNumber(validatorData.last_block || 0) : 'Loading...'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Last Epoch Checked
                </span>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  {validatorData ? formatNumber(validatorData.last_epoch_checked || 0) : 'Loading...'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  ENS Last Updated
                </span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {validatorData ? formatDate(validatorData.ens_last_updated || '') : 'Loading...'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white/30 dark:bg-white/5 rounded border border-gray-300/50 dark:border-white/20">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Cost Last Updated
                </span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {validatorData ? formatDate(validatorData.cost_last_updated || '') : 'Loading...'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default InformationTab;