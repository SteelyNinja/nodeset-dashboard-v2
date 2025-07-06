import React, { useState, useEffect } from 'react';
import GlassCard from './common/GlassCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsSummary {
  summary: {
    total_sessions: number;
    total_page_views: number;
    total_tab_switches: number;
    total_downloads: number;
    recent_sessions_7d: number;
  };
  tab_popularity: Record<string, number>;
  browser_stats: Record<string, number>;
  daily_stats: Record<string, any>;
  metadata: {
    created: string;
    last_updated: string;
    privacy_note: string;
  };
}

const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/analytics/summary`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-original-light dark:bg-original-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-original-light dark:bg-original-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-original-light dark:bg-original-dark flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
      </div>
    );
  }

  // Prepare chart data
  const tabData = Object.entries(analytics.tab_popularity).map(([tab, count]) => ({
    name: tab,
    count
  }));

  const browserData = Object.entries(analytics.browser_stats).map(([browser, count]) => ({
    name: browser,
    count
  }));

  const dailyData = Object.entries(analytics.daily_stats)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14) // Last 14 days
    .map(([date, stats]: [string, any]) => ({
      date: new Date(date).toLocaleDateString(),
      sessions: typeof stats.unique_sessions === 'number' ? stats.unique_sessions : 0,
      page_views: stats.page_views || 0,
      downloads: stats.downloads || 0
    }));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <div className="min-h-screen bg-original-light dark:bg-original-dark">
      {/* Header */}
      <header className="bg-white/20 dark:bg-gray-800/30 backdrop-blur-glass border-b border-gray-200/50 dark:border-white/15 shadow-glass">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Analytics Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Privacy-first visitor analytics</p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Privacy Notice */}
        <GlassCard>
          <div className="flex items-start space-x-3">
            <span className="text-green-500 text-xl">🔒</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Privacy First</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {analytics.metadata.privacy_note}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Data tracking started: {new Date(analytics.metadata.created).toLocaleDateString()} • 
                Last updated: {new Date(analytics.metadata.last_updated).toLocaleDateString()}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <GlassCard>
            <div className="text-center">
              <div className="text-3xl font-bold text-black dark:text-white">
                {analytics.summary.total_sessions.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-3xl font-bold text-black dark:text-white">
                {analytics.summary.recent_sessions_7d.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sessions (7d)</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-3xl font-bold text-black dark:text-white">
                {analytics.summary.total_tab_switches.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Tab Switches</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-3xl font-bold text-black dark:text-white">
                {analytics.summary.total_downloads.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Downloads</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-3xl font-bold text-black dark:text-white">
                {analytics.summary.total_page_views.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Page Views</div>
            </div>
          </GlassCard>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tab Popularity */}
          <GlassCard size="large">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📱 Tab Popularity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tabData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Browser Stats */}
          <GlassCard size="large">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🌐 Browser Usage</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={browserData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="count"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {browserData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Daily Activity */}
        <GlassCard size="large">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📈 Daily Activity (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="date" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
              <Bar dataKey="page_views" fill="#82ca9d" name="Page Views" />
              <Bar dataKey="downloads" fill="#ffc658" name="Downloads" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Analytics data is stored locally and contains no personal information. 
            Access this page via: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">/analytics</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;