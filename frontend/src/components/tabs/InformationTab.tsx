import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassCard from '../common/GlassCard';
import Icon from '../common/Icon';
import { ValidatorData, ConcentrationMetrics, PerformanceAnalysis, ClientDiversity, ENSSourcesData } from '../../types/api';

const InformationTab: React.FC = () => {
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [concentrationData, setConcentrationData] = useState<ConcentrationMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceAnalysis | null>(null);
  const [clientData, setClientData] = useState<ClientDiversity | null>(null);
  const [ensSourcesData, setEnsSourcesData] = useState<ENSSourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Fetch all overview data in parallel including network overview
        const [validator, concentration, performance, client, overview, ensSources] = await Promise.all([
          apiService.getValidatorData(),
          apiService.getConcentrationMetrics(),
          apiService.getPerformanceAnalysis(),
          apiService.getClientDiversity(),
          apiService.getNetworkOverview(),
          apiService.getENSSourcesData()
        ]);

        setValidatorData(validator);
        setConcentrationData(concentration);
        setPerformanceData(performance);
        setClientData(client);
        setEnsSourcesData(ensSources);
        // Store network overview data in validatorData for activation rates
        if (overview && validator) {
          setValidatorData({
            ...validator,
            network_overview: overview
          });
        }
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

  const getGiniCoefficientColor = (gini: number): string => {
    if (gini < 0.03) {
      return 'text-success-600 dark:text-success-400'; // Green for good decentralisation
    } else if (gini >= 0.03 && gini <= 0.05) {
      return 'text-warning-600 dark:text-warning-400'; // Amber for moderate decentralisation
    } else {
      return 'text-danger-600 dark:text-danger-400'; // Red for poor decentralisation
    }
  };

  const getTop1PercentColor = (percentage: number): string => {
    if (percentage < 1) {
      return 'text-success-600 dark:text-success-400'; // Green for good decentralisation
    } else if (percentage >= 1 && percentage <= 2) {
      return 'text-warning-600 dark:text-warning-400'; // Amber for moderate concentration
    } else {
      return 'text-danger-600 dark:text-danger-400'; // Red for high concentration
    }
  };

  const getTop10PercentColor = (percentage: number): string => {
    if (percentage < 10) {
      return 'text-success-600 dark:text-success-400'; // Green for good decentralisation
    } else if (percentage >= 10 && percentage <= 20) {
      return 'text-warning-600 dark:text-warning-400'; // Amber for moderate concentration
    } else {
      return 'text-danger-600 dark:text-danger-400'; // Red for high concentration
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            <Icon name="info" size="lg" color="primary" className="inline mr-2" />Network Information
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive network overview and statistics
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="warning" size="lg" color="danger" />
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
    if (!concentrationData || !validatorData) return { status: 'warning', text: 'Loading...' };
    
    const gini = concentrationData.gini_coefficient;
    const exitRate = (validatorData.total_exited || 0) / validatorData.total_validators;
    const avgValidatorsPerOperator = validatorData.total_validators / concentrationData.total_operators;
    
    const wellDecentralized = gini < 0.1; // Lower Gini = more decentralised
    const lowExitRate = exitRate < 0.05; // Less than 5% exit rate
    const smallOperators = avgValidatorsPerOperator < 20; // Average operator size
    const mostlyActivated = activeValidators / validatorData.total_validators > 0.95; // 95%+ active
    
    return {
      wellDecentralized,
      lowExitRate,
      smallOperators,
      mostlyActivated,
      overallStatus: wellDecentralized && lowExitRate && smallOperators ? 'success' : 'warning'
    };
  };

  const performanceHealthStatus = () => {
    if (!performanceData) return { 
      status: 'warning', 
      text: 'Loading...',
      excellentPerformance: false,
      lowPoorRate: false,
      excellentPercent: 0,
      poorPercent: 0,
      overallStatus: 'warning'
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
      overallStatus: excellentPerformance && lowPoorRate ? 'success' : excellentPerformance ? 'warning' : 'warning'
    };
  };

  const ensResolutionStatus = () => {
    if (!ensSourcesData || !concentrationData) return { 
      status: 'warning', 
      text: 'Loading...',
      ensCount: 0,
      operatorCoverage: 0,
      validatorCoverage: 0,
      onChainCount: 0,
      manualCount: 0,
      onChainPercentage: 0,
      manualPercentage: 0
    };
    
    const operatorCoverage = concentrationData.total_operators > 0 ? 
      (ensSourcesData.total_ens_names / concentrationData.total_operators * 100) : 0;
    
    // Estimate validator coverage (assuming ENS names cover operators proportionally)
    const validatorCoverage = ensSourcesData.total_ens_names > 0 ? 
      (ensSourcesData.total_ens_names / concentrationData.total_operators * 100) : 0;
    
    return {
      ensCount: ensSourcesData.total_ens_names,
      operatorCoverage,
      validatorCoverage,
      onChainCount: ensSourcesData.on_chain_count,
      manualCount: ensSourcesData.manual_count,
      onChainPercentage: ensSourcesData.on_chain_percentage,
      manualPercentage: ensSourcesData.manual_percentage,
      status: operatorCoverage > 30 ? 'success' : operatorCoverage > 20 ? 'warning' : 'warning'
    };
  };

  const networkHealth = networkHealthStatus();
  const performanceHealth = performanceHealthStatus();
  const ensResolution = ensResolutionStatus();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-display-small font-bold text-neutral-900 dark:text-white mb-2">
          <Icon name="info" size="lg" color="primary" className="inline mr-3" />Network Information
        </h1>
        <p className="text-body-large text-neutral-600 dark:text-neutral-400">
          Comprehensive NodeSet validator network overview and key statistics
        </p>
      </div>

      <div className="space-y-6">
        {/* Health Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Network Health */}
          <GlassCard elevation="elevated" className="p-4">
            <div className="flex items-center mb-3">
              <Icon name="dashboard" size="lg" color="primary" className="mr-3" />
              <h3 className="text-headline-small font-semibold text-neutral-900 dark:text-white">Network Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Icon name="success" size="sm" color={networkHealth.wellDecentralized ? 'success' : 'warning'} className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.wellDecentralized ? 'Well Decentralised' : 'Moderately Decentralised'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="success" size="sm" color={networkHealth.lowExitRate ? 'success' : 'warning'} className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.lowExitRate ? 'Low Exit Rate' : 'Moderate Exit Rate'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="success" size="sm" color={networkHealth.smallOperators ? 'success' : 'warning'} className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.smallOperators ? 'Small Operators' : 'Medium Operators'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="success" size="sm" color={networkHealth.mostlyActivated ? 'success' : 'warning'} className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {networkHealth.mostlyActivated ? 'Mostly Activated' : 'Some Inactive'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Performance Health */}
          <GlassCard elevation="elevated" className="p-4">
            <div className="flex items-center mb-3">
              <Icon name="performance" size="lg" color="primary" className="mr-3" />
              <h3 className="text-headline-small font-semibold text-neutral-900 dark:text-white">Performance Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Icon name="success" size="sm" color={performanceHealth.excellentPerformance ? 'success' : 'warning'} className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.excellentPerformance ? 'Excellent Performance' : 'Good Performance'}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="metrics" size="sm" color="primary" className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.excellentPercent.toFixed(1)}% Excellent
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="trendingDown" size="sm" color="warning" className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {performanceHealth.poorPercent.toFixed(1)}% Poor
                </span>
              </div>
            </div>
          </GlassCard>

          {/* ENS / Discord Names */}
          <GlassCard elevation="elevated" className="p-4">
            <div className="flex items-center mb-3">
              <Icon name="info" size="lg" color="primary" className="mr-3" />
              <h3 className="text-headline-small font-semibold text-neutral-900 dark:text-white">ENS / Discord Names</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Icon name="info" size="sm" color="primary" className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.ensCount} names ({ensResolution.onChainCount} on-chain, {ensResolution.manualCount} manual)
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="operators" size="sm" color="primary" className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.operatorCoverage.toFixed(1)}% operator coverage
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Icon name="building" size="sm" color="primary" className="mr-2" />
                <span className="text-gray-700 dark:text-gray-300">
                  {ensResolution.validatorCoverage.toFixed(1)}% validator coverage
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
        {/* Network Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassCard elevation="raised" className="p-4">
            <div className="flex items-center mb-2">
              <Icon name="building" size="md" color="primary" className="mr-2" />
              <div className="text-label-medium font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Total Validators</div>
            </div>
            <div className="text-display-small font-bold text-neutral-900 dark:text-white mb-1 tracking-tight">
              {validatorData ? formatNumber(validatorData.total_validators) : 'Loading...'}
            </div>
            <p className="text-label-small font-medium text-neutral-500 dark:text-neutral-400">
              NodeSet network size
            </p>
          </GlassCard>

          <GlassCard elevation="raised" className="p-4">
            <div className="flex items-center mb-2">
              <Icon name="success" size="md" color="success" className="mr-2" />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Active Validators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {validatorData?.network_overview ? formatNumber(validatorData.network_overview.active_validators) : formatNumber(activeValidators)}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Currently validating
            </p>
          </GlassCard>

          <GlassCard elevation="raised" className="p-4">
            <div className="flex items-center mb-2">
              <Icon name="operators" size="md" color="primary" className="mr-2" />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Operators</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
              {concentrationData ? formatNumber(concentrationData.total_operators) : 'Loading...'}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Unique operators
            </p>
          </GlassCard>

          <GlassCard elevation="raised" className="p-4">
            <div className="flex items-center mb-2">
              <Icon name="exitAnalysis" size="md" color="warning" className="mr-2" />
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

        {/* Activation Queue Metrics */}
        <GlassCard size="large" elevation="floating">
          <h3 className="text-headline-large font-semibold text-neutral-900 dark:text-white mb-6">
            <Icon name="info" size="lg" color="primary" className="inline mr-3" />Validator Activation Queue
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Validators in Queue</span>
                <Icon name="warning" size="lg" color="warning" />
              </div>
              <div className="text-3xl font-bold text-black dark:text-white mb-1">
                {validatorData?.pending_pubkeys ? validatorData.pending_pubkeys.length.toLocaleString() : 'Loading...'}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Waiting for activation
              </p>
            </div>

            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Activation Rate</span>
                <Icon name="success" size="lg" color="success" />
              </div>
              <div className="text-3xl font-bold text-black dark:text-white mb-1">
                {validatorData?.network_overview ? 
                  `${validatorData.network_overview.activation_rate}%`
                  : 'Loading...'}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {validatorData?.network_overview ? 
                  `${validatorData.network_overview.active_validators.toLocaleString()} of ${(validatorData.total_validators - (validatorData.total_exited || 0)).toLocaleString()} activated`
                  : 'Activated validators'}
              </p>
            </div>

            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Queue Rate</span>
                <Icon name="info" size="lg" color="warning" />
              </div>
              <div className="text-3xl font-bold text-black dark:text-white mb-1">
                {validatorData?.network_overview ? 
                  `${validatorData.network_overview.queue_rate}%`
                  : 'Loading...'}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {validatorData?.network_overview ? 
                  `${validatorData.network_overview.validators_in_queue.toLocaleString()} validators waiting`
                  : 'Pending activation'}
              </p>
            </div>
          </div>
          
          {validatorData?.pending_pubkeys && validatorData.pending_pubkeys.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
              <div className="flex items-center">
                <Icon name="info" size="lg" color="primary" className="mr-2 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Queue Status:</strong> {validatorData.pending_pubkeys.length} validators are waiting for activation on the Ethereum beacon chain. 
                  These validators have made their deposits but are awaiting their turn in the activation queue.
                </div>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Decentralisation Metrics */}
        <GlassCard size="large" elevation="floating">
          <h3 className="text-headline-large font-semibold text-neutral-900 dark:text-white mb-6">
            <Icon name="metrics" size="lg" color="primary" className="inline mr-3" />Network Decentralisation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Gini Coefficient</span>
                <span className={`text-lg font-bold ${concentrationData ? getGiniCoefficientColor(concentrationData.gini_coefficient) : 'text-gray-600 dark:text-gray-400'}`}>
                  {concentrationData ? concentrationData.gini_coefficient.toFixed(4) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Lower is more decentralised
              </p>
            </div>


            <div className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Top 1% Share</span>
                <span className={`text-lg font-bold ${concentrationData ? getTop1PercentColor(concentrationData.top_1_percent) : 'text-gray-600 dark:text-gray-400'}`}>
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
                <span className={`text-lg font-bold ${concentrationData ? getTop10PercentColor(concentrationData.top_10_percent) : 'text-gray-600 dark:text-gray-400'}`}>
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
        <GlassCard size="large" elevation="floating">
          <h3 className="text-headline-large font-semibold text-neutral-900 dark:text-white mb-6">
            <Icon name="performance" size="lg" color="primary" className="inline mr-3" />Network Performance
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-success-100/30 dark:bg-success-900/20 rounded-lg p-4 border border-success-200/30 dark:border-success-700/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-success-800 dark:text-success-300">Excellent</span>
                <span className="text-lg font-bold text-success-600 dark:text-success-400">
                  {performanceData ? formatNumber(performanceData.excellent_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-success-600 dark:text-success-400 mt-1">
                ≥99.5% performance
              </p>
            </div>

            <div className="bg-info-100/30 dark:bg-info-900/20 rounded-lg p-4 border border-info-200/30 dark:border-info-700/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-info-800 dark:text-info-300">Good</span>
                <span className="text-lg font-bold text-info-600 dark:text-info-400">
                  {performanceData ? formatNumber(performanceData.good_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-info-600 dark:text-info-400 mt-1">
                ≥98.5% performance
              </p>
            </div>

            <div className="bg-warning-100/30 dark:bg-warning-900/20 rounded-lg p-4 border border-warning-200/30 dark:border-warning-700/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-warning-800 dark:text-warning-300">Average</span>
                <span className="text-lg font-bold text-warning-600 dark:text-warning-400">
                  {performanceData ? formatNumber(performanceData.average_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-warning-600 dark:text-warning-400 mt-1">
                ≥95% performance
              </p>
            </div>

            <div className="bg-danger-100/30 dark:bg-danger-900/20 rounded-lg p-4 border border-danger-200/30 dark:border-danger-700/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-danger-800 dark:text-danger-300">Poor</span>
                <span className="text-lg font-bold text-danger-600 dark:text-danger-400">
                  {performanceData ? formatNumber(performanceData.poor_count) : 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-danger-600 dark:text-danger-400 mt-1">
                &lt;95% performance
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Client Diversity */}
        <GlassCard size="large" elevation="floating">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            <Icon name="clientDiversity" size="lg" color="primary" className="inline mr-3" />Client Diversity
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
                      <span className="text-sm font-bold text-black dark:text-white">
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
                      <span className="text-sm font-bold text-black dark:text-white">
                        {(percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          
        </GlassCard>

        {/* Network Status */}
        <GlassCard size="large" elevation="floating">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            <Icon name="cloud" size="lg" color="primary" className="inline mr-3" />Network Status
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