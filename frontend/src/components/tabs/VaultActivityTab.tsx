import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import { analyticsService } from '../../services/analytics';
import { VaultEventsData } from '../../types/api';
import GlassCard from '../common/GlassCard';
// Removed unused GlassTable imports
import GlassButton from '../common/GlassButton';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import LineChart from '../charts/LineChart';
// Removed unused BarChart import
import Icon from '../common/Icon';

interface OverviewMetrics {
  totalDeposits: number;
  totalValidators: number;
  totalWithdrawals: number;
  netFlow: number;
  totalDepositAmount: number;
  totalWithdrawalAmount: number;
  uniqueDepositors: number;
}

interface TimeSeriesData {
  date: string;
  deposits: number;
  withdrawals: number;
  validators: number;
  depositAmount: number;
  withdrawalAmount: number;
  cumulativeDeposits: number;
  cumulativeNetFlow: number;
}

interface TopParticipant {
  address: string;
  totalDeposits: number;
  totalWithdrawals: number;
  netAmount: number;
  depositTransactions: number;
  withdrawalTransactions: number;
  totalTransactions: number;
  sharePercent: number;
}

const VaultActivityTab: React.FC = () => {
  const [vaultData, setVaultData] = useState<VaultEventsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);

  const weiToEth = (wei: string): number => {
    return parseFloat(wei) / 1e18;
  };

  useEffect(() => {
    const fetchVaultData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching vault data...');
        const data = await apiService.getVaultEventsData();
        console.log('Vault data received:', data);
        setVaultData(data);
      } catch (err) {
        console.error('Error fetching vault data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vault data');
      } finally {
        setLoading(false);
      }
    };

    fetchVaultData();
  }, []);

  const overviewMetrics = useMemo((): OverviewMetrics => {
    if (!vaultData || !vaultData.events || !Array.isArray(vaultData.events)) {
      return {
        totalDeposits: 0,
        totalValidators: 0,
        totalWithdrawals: 0,
        netFlow: 0,
        totalDepositAmount: 0,
        totalWithdrawalAmount: 0,
        uniqueDepositors: 0
      };
    }

    const deposits = vaultData.events.filter(event => event && event.type === 'deposit');
    const withdrawals = vaultData.events.filter(event => event && event.type === 'withdrawal');
    const validators = vaultData.events.filter(event => event && event.type === 'validator_registration');
    
    // Helper function to convert wei string to ETH
    const weiToEth = (weiString: string): number => {
      try {
        const wei = parseFloat(weiString);
        return wei / 1e18; // Convert wei to ETH
      } catch (error) {
        console.warn('Failed to parse wei amount:', weiString, error);
        return 0;
      }
    };

    const totalDepositAmount = deposits.reduce((sum, event) => sum + (event.assets_eth || 0), 0);
    
    // Debug logging for withdrawal events
    console.log('Withdrawal events debug:', withdrawals.slice(0, 3).map(event => ({
      estimated_assets_eth: event.estimated_assets_eth,
      estimated_assets: event.estimated_assets,
      shares: event.shares
    })));
    
    const totalWithdrawalAmount = withdrawals.reduce((sum, event) => {
      // If estimated_assets_eth is available and non-zero, use it
      if (event.estimated_assets_eth && event.estimated_assets_eth > 0) {
        return sum + event.estimated_assets_eth;
      }
      // Otherwise, convert estimated_assets from wei to ETH
      if (event.estimated_assets) {
        return sum + weiToEth(event.estimated_assets);
      }
      // Fallback to assets_eth if available
      return sum + (event.assets_eth || 0);
    }, 0);
    
    console.log('Total withdrawal amount calculated:', totalWithdrawalAmount);
    
    const uniqueDepositors = new Set(deposits.filter(event => event.caller).map(event => event.caller)).size;

    return {
      totalDeposits: deposits.length,
      totalValidators: validators.length,
      totalWithdrawals: withdrawals.length,
      netFlow: totalDepositAmount - totalWithdrawalAmount,
      totalDepositAmount,
      totalWithdrawalAmount,
      uniqueDepositors
    };
  }, [vaultData]);

  const timeSeriesData = useMemo((): TimeSeriesData[] => {
    if (!vaultData || !vaultData.events || !Array.isArray(vaultData.events)) {
      return [];
    }

    const dailyData = new Map<string, { deposits: number; withdrawals: number; validators: number; depositAmount: number; withdrawalAmount: number }>();
    
    vaultData.events.filter(event => event && event.timestamp).forEach(event => {
      const date = new Date(event.timestamp * 1000).toISOString().split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { deposits: 0, withdrawals: 0, validators: 0, depositAmount: 0, withdrawalAmount: 0 });
      }
      
      const dayData = dailyData.get(date)!;
      
      if (event.type === 'deposit') {
        dayData.deposits += 1;
        const depositAmount = event.assets_eth || (event.assets ? weiToEth(event.assets) : 0);
        dayData.depositAmount += depositAmount;
      } else if (event.type === 'withdrawal') {
        dayData.withdrawals += 1;
        const withdrawalAmount = event.estimated_assets_eth || (event.estimated_assets ? weiToEth(event.estimated_assets) : 0);
        dayData.withdrawalAmount += withdrawalAmount;
      } else if (event.type === 'validator_registration') {
        dayData.validators += 1;
      }
    });

    const sortedDates = Array.from(dailyData.keys()).sort();
    let cumulativeDeposits = 0;
    let cumulativeNetFlow = 0;

    const allData = sortedDates.map(date => {
      const data = dailyData.get(date)!;
      cumulativeDeposits += data.depositAmount;
      cumulativeNetFlow += (data.depositAmount - data.withdrawalAmount);
      
      return {
        date,
        deposits: data.deposits,
        withdrawals: data.withdrawals,
        validators: data.validators,
        depositAmount: data.depositAmount,
        withdrawalAmount: data.withdrawalAmount,
        cumulativeDeposits,
        cumulativeNetFlow
      };
    });

    // Filter by selected period (0 means all time)
    const result = selectedPeriod === 0 ? allData : allData.slice(-selectedPeriod);

    // Debug final result once
    if (result.length > 0) {
      const maxNetFlow = Math.max(...result.map(d => d.cumulativeNetFlow));
      const lastNetFlow = result[result.length - 1].cumulativeNetFlow;
      console.log(`CHART DEBUG: ${result.length} days, max net flow: ${maxNetFlow}, last net flow: ${lastNetFlow}`);
    }

    return result;
  }, [vaultData, selectedPeriod]);

  const topParticipants = useMemo((): TopParticipant[] => {
    if (!vaultData || !vaultData.events || !Array.isArray(vaultData.events)) return [];

    const participantStats = new Map<string, { 
      deposits: number; 
      depositCount: number; 
      withdrawals: number; 
      withdrawalCount: number; 
    }>();
    
    // Helper function to convert wei string to ETH (reused from above)
    const weiToEth = (weiString: string): number => {
      try {
        const wei = parseFloat(weiString);
        return wei / 1e18;
      } catch (error) {
        console.warn('Failed to parse wei amount:', weiString, error);
        return 0;
      }
    };
    
    // Process deposits
    vaultData.events
      .filter(event => event && event.type === 'deposit' && event.caller)
      .forEach(event => {
        const caller = event.caller!;
        const current = participantStats.get(caller) || { deposits: 0, depositCount: 0, withdrawals: 0, withdrawalCount: 0 };
        current.deposits += (event.assets_eth || 0);
        current.depositCount += 1;
        participantStats.set(caller, current);
      });
    
    // Process withdrawals
    vaultData.events
      .filter(event => event && event.type === 'withdrawal' && (event.caller || event.owner))
      .forEach(event => {
        const address = event.caller || event.owner!;
        const current = participantStats.get(address) || { deposits: 0, depositCount: 0, withdrawals: 0, withdrawalCount: 0 };
        
        // Calculate withdrawal amount using same logic as in overviewMetrics
        let withdrawalAmount = 0;
        if (event.estimated_assets_eth && event.estimated_assets_eth > 0) {
          withdrawalAmount = event.estimated_assets_eth;
        } else if (event.estimated_assets) {
          withdrawalAmount = weiToEth(event.estimated_assets);
        } else {
          withdrawalAmount = event.assets_eth || 0;
        }
        
        current.withdrawals += withdrawalAmount;
        current.withdrawalCount += 1;
        participantStats.set(address, current);
      });

    // Calculate remaining total (deposits - withdrawals) for percentage calculation
    const remainingTotal = overviewMetrics.totalDepositAmount - overviewMetrics.totalWithdrawalAmount;

    return Array.from(participantStats.entries())
      .map(([address, stats]) => {
        const netAmount = stats.deposits - stats.withdrawals;
        return {
          address,
          totalDeposits: stats.deposits,
          totalWithdrawals: stats.withdrawals,
          netAmount,
          depositTransactions: stats.depositCount,
          withdrawalTransactions: stats.withdrawalCount,
          totalTransactions: stats.depositCount + stats.withdrawalCount,
          sharePercent: remainingTotal > 0 ? (netAmount / remainingTotal) * 100 : 0
        };
      })
      .sort((a, b) => b.netAmount - a.netAmount);
  }, [vaultData, overviewMetrics.totalDepositAmount, overviewMetrics.totalWithdrawalAmount]);

  const allTransactions = useMemo(() => {
    if (!vaultData || !vaultData.events || !Array.isArray(vaultData.events)) return [];
    
    // Helper function to convert wei string to ETH (reused from above)
    const weiToEth = (weiString: string): number => {
      try {
        const wei = parseFloat(weiString);
        return wei / 1e18; // Convert wei to ETH
      } catch (error) {
        console.warn('Failed to parse wei amount:', weiString, error);
        return 0;
      }
    };
    
    return vaultData.events
      .filter(event => event && event.transaction_hash && (event.caller || event.owner))
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(event => {
        // Handle different address fields for different event types
        const address = event.caller || event.owner || 'Unknown';
        
        // Handle different amount fields for different event types
        let amount = 0;
        if (event.type === 'withdrawal') {
          // If estimated_assets_eth is available and non-zero, use it
          if (event.estimated_assets_eth && event.estimated_assets_eth > 0) {
            amount = event.estimated_assets_eth;
          }
          // Otherwise, convert estimated_assets from wei to ETH
          else if (event.estimated_assets) {
            amount = weiToEth(event.estimated_assets);
          }
          // Fallback to assets_eth if available
          else {
            amount = event.assets_eth || 0;
          }
        } else {
          amount = event.assets_eth || 0;
        }
        
        return {
          type: event.type || 'unknown',
          amount: amount,
          address: address && typeof address === 'string' ? address : 'Unknown',
          time: event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : 'Unknown',
          txHash: event.transaction_hash || 'Unknown'
        };
      });
  }, [vaultData]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return allTransactions;
    
    return allTransactions.filter(tx => 
      tx.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.txHash.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTransactions, searchTerm]);

  const downloadCSV = () => {
    analyticsService.trackDownload('vault_activity_csv');
    
    const headers = ['Type', 'Amount (ETH)', 'Address', 'Time'];
    const csvData = [
      headers,
      ...filteredTransactions.map(tx => [
        tx.type,
        tx.amount > 0 ? tx.amount.toFixed(6) : '0',
        tx.address,
        tx.time
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vault-transactions.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" />
        <div className="text-center mt-4 text-gray-600 dark:text-gray-400">
          Loading vault activity data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const formatEth = (value: number): string => {
    return value.toFixed(3) + ' ETH';
  };


  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
          <Icon name="metrics" size="lg" color="primary" />
          Vault Activity Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Tracking of vault deposits, withdrawals, and validator registrations
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard elevation="raised" size="medium" className="p-4">
          <div className="flex items-center">
            <Icon name="trendingUp" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Total Deposits</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {formatEth(overviewMetrics.totalDepositAmount)}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            {overviewMetrics.totalDeposits} transactions
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4">
          <div className="flex items-center">
            <Icon name="trendingDown" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Total Withdrawals</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {formatEth(overviewMetrics.totalWithdrawalAmount)}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            {overviewMetrics.totalWithdrawals} transactions
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4">
          <div className="flex items-center">
            <Icon name="server" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Total Validators</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {overviewMetrics.totalValidators.toLocaleString()}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            Validator registrations
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4">
          <div className="flex items-center">
            <Icon name={overviewMetrics.netFlow >= 0 ? "up" : "down"} size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Net Flow</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {overviewMetrics.netFlow >= 0 ? '+' : ''}{formatEth(overviewMetrics.netFlow)}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            Deposits - Withdrawals
          </p>
        </GlassCard>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard elevation="raised" size="medium" className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <div className="flex items-center">
            <Icon name="operators" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Unique Depositors</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {overviewMetrics.uniqueDepositors}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            Individual addresses
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <div className="flex items-center">
            <Icon name="scale" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Avg Deposit Size</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {(overviewMetrics.totalDepositAmount / overviewMetrics.totalDeposits || 0).toFixed(2)} ETH
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            Per transaction
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
          <div className="flex items-center">
            <Icon name="performance" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Withdrawal Rate</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {((overviewMetrics.totalWithdrawalAmount / (overviewMetrics.totalDepositAmount + overviewMetrics.totalWithdrawalAmount)) * 100 || 0).toFixed(1)}%
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            Of total ETH value
          </p>
        </GlassCard>

        <GlassCard elevation="raised" size="medium" className="p-4 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950">
          <div className="flex items-center">
            <Icon name="dashboard" size="lg" color="primary" className="mr-2" />
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Total Events</div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {vaultData?.total_events.toLocaleString() || 0}
          </div>
          <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">
            All vault activities
          </p>
        </GlassCard>
      </div>

      {/* Charts Section with Period Selection */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-headline-small text-neutral-900 dark:text-neutral-100">Vault Activity Charts</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400 mr-2">Period:</span>
            {[7, 30, 90, 0].map(period => (
              <GlassButton
                key={period}
                onClick={() => setSelectedPeriod(period)}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                className="px-3 py-1"
              >
                {period === 0 ? 'All' : `${period}d`}
              </GlassButton>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Net Flow Value Chart */}
          <GlassCard size="large" elevation="floating" hoverable={false} className="border border-white/20 dark:border-white/10">
            <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Net Flow Value</h4>
            <div className="h-[320px] overflow-hidden">
              {(() => {
                const chartData = timeSeriesData.map(d => ({ date: d.date, netFlow: d.cumulativeNetFlow }));
                console.log('Chart component data:', chartData.slice(0, 3), '...', chartData.slice(-3));
                return (
                  <LineChart
                    data={chartData}
                    lines={[
                      {
                        dataKey: 'netFlow',
                        stroke: 'rgb(59, 130, 246)',
                        strokeWidth: 2,
                        name: 'Net Flow (ETH)'
                      }
                    ]}
                    xAxisDataKey="date"
                    xAxisType="category"
                    xAxisLabel="Date"
                    yAxisLabel="ETH"
                    showLegend={true}
                  />
                );
              })()}
            </div>
          </GlassCard>

          {/* Flows Per Day Chart */}
          <GlassCard size="large" elevation="floating" hoverable={false} className="border border-white/20 dark:border-white/10">
            <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Flows Per Day</h4>
            <div className="h-[320px] overflow-hidden">
              {(() => {
                const flowChartData = timeSeriesData.map(d => ({
                  date: d.date,
                  deposits: d.depositAmount,
                  withdrawals: d.withdrawalAmount
                }));
                return (
                  <LineChart
                    data={flowChartData}
                    lines={[
                      {
                        dataKey: 'deposits',
                        stroke: 'rgb(34, 197, 94)',
                        strokeWidth: 2,
                        name: 'Deposits'
                      },
                      {
                        dataKey: 'withdrawals',
                        stroke: 'rgb(239, 68, 68)',
                        strokeWidth: 2,
                        name: 'Withdrawals'
                      }
                    ]}
                    xAxisDataKey="date"
                    xAxisType="category"
                    xAxisLabel="Date"
                    yAxisLabel="ETH Amount"
                    showLegend={true}
                  />
                );
              })()}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Vault Transactions */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-headline-small text-neutral-900 dark:text-neutral-100">Vault Transactions</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search transactions..."
              className="w-64 px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <GlassButton onClick={downloadCSV} variant="primary" size="sm" className="flex items-center gap-2">
              <Icon name="download" size="sm" color="current" />
              Download CSV
            </GlassButton>
          </div>
        </div>
        
        <div className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
            <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "1.2fr 1.5fr 3fr 2.5fr", gap: "12px"}}>
              <div>Type</div>
              <div>Amount</div>
              <div>Address</div>
              <div>Time</div>
            </div>
          </div>
          
          {/* Scrollable Body */}
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <div className="divide-y divide-white/5 dark:divide-white/10">
              {filteredTransactions.map((tx, i) => (
                <div 
                  key={i}
                  className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                    i % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                  }`}
                  style={{gridTemplateColumns: "1.2fr 1.5fr 3fr 2.5fr", gap: "12px"}}
                >
                  <div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tx.type === 'deposit' ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200' :
                      tx.type === 'withdrawal' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                    }`}>
                      {tx.type}
                    </span>
                  </div>
                  <div>{tx.amount > 0 ? formatEth(tx.amount) : '-'}</div>
                  <div>{tx.address}</div>
                  <div>{tx.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Vault Participants */}
      <div className="mb-8">
        <h3 className="text-headline-small text-neutral-900 dark:text-neutral-100 mb-4">Top Vault Participants</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          All vault participants ranked by net contribution (deposits - withdrawals). Share % represents portion of total remaining vault value.
        </p>
        
        <div className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
            <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "2.5fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr", gap: "12px"}}>
              <div>Address</div>
              <div>Deposits</div>
              <div>Withdrawals</div>
              <div>Net Amount</div>
              <div>Total Txns</div>
              <div>Share %</div>
            </div>
          </div>
          
          {/* Scrollable Body */}
          <div style={{ maxHeight: '600px', overflow: 'auto' }}>
            <div className="divide-y divide-white/5 dark:divide-white/10">
              {topParticipants.map((participant, i) => (
                <div 
                  key={i}
                  className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                    i % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                  }`}
                  style={{gridTemplateColumns: "2.5fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr", gap: "12px"}}
                >
                  <div className="font-mono text-xs">{participant.address}</div>
                  <div className="text-success-600 dark:text-success-400">
                    {formatEth(participant.totalDeposits)}
                    {participant.depositTransactions > 0 && (
                      <span className="text-xs text-gray-500 ml-1">({participant.depositTransactions})</span>
                    )}
                  </div>
                  <div className="text-red-600 dark:text-red-400">
                    {participant.totalWithdrawals > 0 ? formatEth(participant.totalWithdrawals) : '-'}
                    {participant.withdrawalTransactions > 0 && (
                      <span className="text-xs text-gray-500 ml-1">({participant.withdrawalTransactions})</span>
                    )}
                  </div>
                  <div className={`font-semibold ${
                    participant.netAmount >= 0 
                      ? 'text-success-600 dark:text-success-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {participant.netAmount >= 0 ? '+' : ''}{formatEth(participant.netAmount)}
                  </div>
                  <div>{participant.totalTransactions}</div>
                  <div className={participant.sharePercent >= 0 ? '' : 'text-red-600 dark:text-red-400'}>
                    {participant.sharePercent.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultActivityTab;