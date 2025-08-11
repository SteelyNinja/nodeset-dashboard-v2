import React, { useState, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import Icon from '../common/Icon';
import LineChartComponent from '../charts/LineChart';
import PieChartComponent from '../charts/PieChart';
import { OutagesData, OutagesSummary, ValidatorData } from '../../types/api';
import { apiService } from '../../services/api';

interface NetworkStatusCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  colorClass: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

const NetworkStatusCard: React.FC<NetworkStatusCardProps> = ({ title, value, subtitle, icon, colorClass, status = 'info' }) => (
  <GlassCard elevation="elevated" className={`
    backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
    rounded-xl 
    shadow-glass-light dark:shadow-glass-dark
    p-4 transform hover:scale-105 transition-all duration-300
    ${
      status === 'success' ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700/50' :
      status === 'warning' ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' :
      status === 'danger' ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-700/50' :
      'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-700/50'
    }
  `}>
    <div className="flex items-center justify-between mb-2">
      <Icon name={icon as any} size="lg" color={status === 'success' ? 'success' : status === 'warning' ? 'warning' : status === 'danger' ? 'danger' : 'primary'} />
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
        status === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
        status === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
      }`}>
        {status === 'success' ? 'Good' : status === 'warning' ? 'Warning' : status === 'danger' ? 'Critical' : 'Info'}
      </div>
    </div>
    <div className={`text-2xl font-bold mb-1 ${colorClass}`}>{value}</div>
    <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</div>
    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</div>
    <div className={`mt-2 rounded-full h-2 ${
      status === 'success' ? 'bg-green-200 dark:bg-green-800' :
      status === 'warning' ? 'bg-yellow-200 dark:bg-yellow-800' :
      status === 'danger' ? 'bg-red-200 dark:bg-red-800' :
      'bg-blue-200 dark:bg-blue-800'
    }`}>
      <div 
        className={`h-2 rounded-full transition-all duration-500 ${
          status === 'success' ? 'bg-green-500' :
          status === 'warning' ? 'bg-yellow-500' :
          status === 'danger' ? 'bg-red-500' :
          'bg-blue-500'
        }`}
        style={{ width: '85%' }}
      />
    </div>
  </GlassCard>
);

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

const getSeverityColor = (durationSeconds: number): string => {
  if (durationSeconds < 3600) return 'text-green-600 dark:text-green-400'; // < 1 hour
  if (durationSeconds < 21600) return 'text-yellow-600 dark:text-yellow-400'; // < 6 hours
  return 'text-red-600 dark:text-red-400'; // > 6 hours
};

// Helper function to get ENS/Discord name for operator
const getOperatorName = (operatorAddress: string, validatorData: ValidatorData | null): string => {
  if (!validatorData?.ens_names || !operatorAddress) return '';
  return validatorData.ens_names[operatorAddress] || '';
};

// Helper function to process outages data into daily metrics
const processDailyOutagesData = (outagesData: OutagesData): Array<{date: string, outages: number, downtime: number}> => {
  const dailyMetrics = new Map<string, {outages: number, downtime: number}>();
  
  Object.values(outagesData.outage_history || {}).forEach(history => {
    history.outages.forEach(outage => {
      const startDate = new Date(outage.start).toISOString().split('T')[0];
      
      // If outage spans multiple days, we'll count it on the start date for simplicity
      const date = startDate;
      
      if (!dailyMetrics.has(date)) {
        dailyMetrics.set(date, {outages: 0, downtime: 0});
      }
      
      const dayMetrics = dailyMetrics.get(date)!;
      dayMetrics.outages += 1;
      dayMetrics.downtime += outage.duration_seconds / 3600; // Convert to hours
    });
  });
  
  // Convert to array and sort by date
  return Array.from(dailyMetrics.entries())
    .map(([date, metrics]) => ({
      date,
      outages: metrics.outages,
      downtime: Math.round(metrics.downtime * 100) / 100 // Round to 2 decimal places
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const OutagesTab: React.FC = () => {
  const [summary, setSummary] = useState<OutagesSummary | null>(null);
  const [outagesData, setOutagesData] = useState<OutagesData | null>(null);
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔄 Fetching outages data...');
        
        // Try summary first
        console.log('📊 Fetching summary...');
        const summaryData = await apiService.getOutagesSummary();
        console.log('✅ Summary data received:', summaryData);
        
        // Then try full data
        console.log('📄 Fetching full data...');
        const fullData = await apiService.getOutagesData();
        console.log('✅ Full data received, keys:', Object.keys(fullData));
        
        // Fetch validator data for ENS names
        console.log('📄 Fetching validator data...');
        const validatorInfo = await apiService.getValidatorData();
        console.log('✅ Validator data received');
        
        setSummary(summaryData);
        setOutagesData(fullData);
        setValidatorData(validatorInfo);
        console.log('✅ All outages data loaded successfully');
        console.log('📄 Recent outages count:', summaryData?.recent_outages?.length);
      } catch (err) {
        console.error('❌ Failed to fetch outages data:', err);
        console.error('❌ Error details:', {
          message: (err as any)?.message,
          stack: (err as any)?.stack,
          response: (err as any)?.response?.data,
          status: (err as any)?.response?.status
        });
        setError(`Failed to load outages data: ${(err as any)?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !summary || !outagesData || !validatorData) {
    return <ErrorMessage message={error || 'Failed to load outages data'} />;
  }

  // Prepare chart data
  const dailyOutagesChartData = processDailyOutagesData(outagesData);

  const uptimeDistributionData = summary.worst_performers.map(wp => ({
    name: wp.validator.slice(0, 8) + '...',
    value: wp.total_downtime_seconds / 3600 // Convert to hours
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
          <Icon name="warning" size="lg" color="warning" />
          Validator Outages
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor validator downtime and outage history
        </p>
      </div>

      {/* Network Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <NetworkStatusCard
          title="Total Outages"
          value={summary.total_outage_events}
          subtitle="events recorded"
          icon="clock"
          colorClass="text-orange-600 dark:text-orange-400"
          status="warning"
        />
        <NetworkStatusCard
          title="Total Downtime"
          value={Math.round(summary.total_downtime_hours)}
          subtitle="hours offline"
          icon="time"
          colorClass="text-red-600 dark:text-red-400"
          status="danger"
        />
        <NetworkStatusCard
          title="Affected Validators"
          value={summary.total_validators_with_outages}
          subtitle="with outage history"
          icon="server"
          colorClass="text-blue-600 dark:text-blue-400"
          status="info"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Outages and Downtime Chart */}
        <GlassCard elevation="elevated" className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <Icon name="chart" size="sm" color="primary" className="inline mr-2" />
            Daily Outages & Downtime Trends
          </h3>
          <LineChartComponent
            data={dailyOutagesChartData}
            lines={[
              {
                dataKey: "outages",
                stroke: "#ef4444",
                strokeWidth: 2,
                name: "Outages per Day"
              },
              {
                dataKey: "downtime", 
                stroke: "#f59e0b",
                strokeWidth: 2,
                name: "Downtime (Hours)"
              }
            ]}
            xAxisDataKey="date"
            xAxisLabel="Date"
            yAxisLabel="Count / Hours"
            xAxisType="category"
            showLegend={true}
          />
        </GlassCard>

        {/* Downtime Distribution */}
        <GlassCard elevation="elevated" className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <Icon name="chart" size="sm" color="primary" className="inline mr-2" />
            Downtime Distribution (Hours)
          </h3>
          <PieChartComponent
            data={uptimeDistributionData}
            title=""
            colorPalette="divergent"
            showLegend={true}
            valueKey="value"
            labelKey="name"
            enableAnimations={true}
          />
        </GlassCard>
      </div>

      {/* Worst Performers Table */}
      <div className="mb-8">
        <GlassCard elevation="elevated" className="p-6" hoverable={false}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <Icon name="trophy" size="sm" color="warning" className="inline mr-2" />
            Worst Performing Operators
          </h3>
          <div className="max-h-96 overflow-y-auto">
            <GlassTable>
              <GlassTableHeader className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10">
                <GlassTableRow hoverable={false}>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operator</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Outages</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Downtime</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime %</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {summary.worst_performers.map((performer, index) => (
                  <GlassTableRow key={performer.validator} hoverable={false}>
                    <GlassTableCell className="text-xs font-mono text-gray-900 dark:text-white">
                      {performer.validator}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm text-gray-900 dark:text-white">
                      {getOperatorName(performer.validator, validatorData) || '-'}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm text-gray-900 dark:text-white">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        {performer.outage_count}
                      </span>
                    </GlassTableCell>
                    <GlassTableCell className={`text-sm font-medium ${getSeverityColor(performer.total_downtime_seconds)}`}>
                      {formatDuration(performer.total_downtime_seconds)}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm">
                      <div className="flex items-center">
                        <span className={`font-medium ${
                          performer.uptime_percentage >= 99 
                            ? 'text-green-600 dark:text-green-400' 
                            : performer.uptime_percentage >= 95 
                            ? 'text-yellow-600 dark:text-yellow-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {performer.uptime_percentage.toFixed(2)}%
                        </span>
                      </div>
                    </GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
        </GlassCard>
      </div>

      {/* Recent Outages Table */}
      <div className="mb-8">
        <GlassCard elevation="elevated" className="p-6" hoverable={false}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <Icon name="clock" size="sm" color="primary" className="inline mr-2" />
            All Outages
          </h3>
          <div className="max-h-96 overflow-y-auto">
            <GlassTable>
              <GlassTableHeader className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10">
                <GlassTableRow hoverable={false}>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operator</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Time</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">End Time</GlassTableCell>
                  <GlassTableCell header className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {summary?.recent_outages?.map((outage, index) => (
                  <GlassTableRow key={`${outage.validator}-${outage.start}-${index}`} hoverable={false}>
                    <GlassTableCell className="text-xs font-mono text-gray-900 dark:text-white">
                      {outage.validator}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm text-gray-900 dark:text-white">
                      {getOperatorName(outage.validator, validatorData) || '-'}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTimestamp(outage.start)}
                    </GlassTableCell>
                    <GlassTableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTimestamp(outage.end)}
                    </GlassTableCell>
                    <GlassTableCell className={`text-sm font-medium ${getSeverityColor(outage.duration_seconds)}`}>
                      {formatDuration(outage.duration_seconds)}
                    </GlassTableCell>
                  </GlassTableRow>
                )) || []}
              </GlassTableBody>
            </GlassTable>
          </div>
        </GlassCard>
      </div>

      {/* Data Source Info */}
      <GlassCard elevation="flat" className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Last Updated: {formatTimestamp(outagesData?.last_update || '')}</span>
        </div>
      </GlassCard>
    </div>
  );
};

export default OutagesTab;