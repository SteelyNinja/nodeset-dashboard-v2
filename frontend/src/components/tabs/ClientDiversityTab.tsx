import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ClientDiversity } from '../../types/api';

const ClientDiversityTab: React.FC = () => {
  const [clientData, setClientData] = useState<ClientDiversity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        const data = await apiService.getClientDiversity();
        setClientData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load client diversity data');
        console.error('Error fetching client diversity data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, []);

  const downloadCSV = (data: any[], filename: string) => {
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

  const handleDownloadClientData = () => {
    if (!clientData) return;
    
    const executionData = Object.entries(clientData.execution_clients || {}).map(([client, percentage]) => ({
      client_type: 'Execution',
      client_name: client,
      percentage: percentage || 0,
      full_client_name: getFullClientName(client, 'execution')
    }));

    const consensusData = Object.entries(clientData.consensus_clients || {}).map(([client, percentage]) => ({
      client_type: 'Consensus',
      client_name: client,
      percentage: percentage || 0,
      full_client_name: getFullClientName(client, 'consensus')
    }));

    const combinedData = [...executionData, ...consensusData];
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    downloadCSV(combinedData, `client_diversity_${timestamp}.csv`);
  };

  const getFullClientName = (clientCode: string, type: 'execution' | 'consensus'): string => {
    const executionClients: Record<string, string> = {
      'geth': 'Geth',
      'nethermind': 'Nethermind',
      'besu': 'Besu',
      'erigon': 'Erigon',
      'reth': 'Reth'
    };

    const consensusClients: Record<string, string> = {
      'lighthouse': 'Lighthouse',
      'lodestar': 'Lodestar',
      'nimbus': 'Nimbus',
      'prysm': 'Prysm',
      'teku': 'Teku'
    };

    if (type === 'execution') {
      return executionClients[clientCode.toLowerCase()] || clientCode;
    } else {
      return consensusClients[clientCode.toLowerCase()] || clientCode;
    }
  };

  const getClientColor = (client: string, type: 'execution' | 'consensus'): string => {
    const executionColors: Record<string, string> = {
      'geth': '#1f77b4',
      'nethermind': '#ff7f0e',
      'besu': '#2ca02c',
      'erigon': '#9467bd',
      'reth': '#d62728'
    };

    const consensusColors: Record<string, string> = {
      'lighthouse': '#1f77b4',
      'lodestar': '#ff7f0e',
      'nimbus': '#2ca02c',
      'prysm': '#d62728',
      'teku': '#9467bd'
    };

    if (type === 'execution') {
      return executionColors[client.toLowerCase()] || '#8884d8';
    } else {
      return consensusColors[client.toLowerCase()] || '#8884d8';
    }
  };

  const getSetupColor = (setup: string): string => {
    const setupColors: Record<string, string> = {
      'local': '#28a745',
      'external': '#17a2b8'
    };
    return setupColors[setup.toLowerCase()] || '#8884d8';
  };

  const formatChartData = (clientData: Record<string, number>, type: 'execution' | 'consensus' = 'execution') => {
    if (!clientData) return [];
    return Object.entries(clientData).map(([client, percentage]) => ({
      name: getFullClientName(client, type),
      value: percentage || 0,
      fullName: getFullClientName(client, type)
    }));
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded shadow-lg">
          <p className="font-semibold">{data.payload.fullName}</p>
          <p className="text-blue-600">{data.value.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {value > 5 ? `${value.toFixed(1)}%` : ''}
      </text>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            <Icon name="clientDiversity" size="lg" color="primary" className="inline mr-2" />Client Diversity
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Consensus and execution client distribution
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="warning" size="lg" color="danger" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Client Data</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No client diversity data available</div>
      </div>
    );
  }

  const executionChartData = formatChartData(clientData.execution_clients, 'execution');
  const consensusChartData = formatChartData(clientData.consensus_clients, 'consensus');
  const setupChartData = formatChartData(clientData.setup_types || {}, 'execution').map(item => ({
    ...item,
    name: item.name.charAt(0).toUpperCase() + item.name.slice(1)
  }));

  const combinationChartData = clientData.client_combinations ? 
    Object.entries(clientData.client_combinations)
      .map(([combination, count]) => ({
        name: combination,
        value: count
      }))
      .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          <Icon name="clientDiversity" size="lg" color="primary" className="inline mr-2" />Client Diversity
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Consensus and execution client distribution analysis
        </p>
      </div>

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard>
            <div className="flex items-center">
              <Icon name="settings" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Execution Clients</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {Object.keys(clientData.execution_clients || {}).length}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Different client types
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="building" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Consensus Clients</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {Object.keys(clientData.consensus_clients || {}).length}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Different client types
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="metrics" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Diversity Score</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {clientData.diversity_score?.toFixed(3) || '0.000'}
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              Higher is better
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center">
              <Icon name="signal" size="lg" color="primary" className="mr-2" />
              <div className="text-sm font-medium text-black dark:text-white">Graffiti Coverage</div>
            </div>
            <div className="text-2xl font-bold text-black dark:text-white mt-2">
              {clientData.graffiti_coverage_percent?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-black dark:text-white mt-1">
              {clientData.operators_with_proposals || 0} of {clientData.total_operators || 0} operators
            </p>
          </GlassCard>
        </div>

        {/* Analysis Note */}
        <GlassCard className="bg-warning-light/30 dark:bg-warning-dark/20 border border-warning/30" hoverable={false}>
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="info" size="lg" color="warning" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Analysis Note</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{clientData.analysis_note}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Pie Charts Section */}
        <GlassCard hoverable={false}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              <Icon name="metrics" size="lg" color="primary" className="inline mr-2" />Client Distribution Charts
            </h3>
            <GlassButton
              onClick={handleDownloadClientData}
              variant="success"
              size="sm"
            >
              <span className="text-sm">💾</span>
              Download CSV
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Execution Clients Pie Chart */}
            <div className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                <Icon name="settings" size="lg" color="primary" className="inline mr-2" />Execution Clients
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={executionChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={110}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {executionChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getClientColor(entry.name, 'execution')} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Execution Client Legend */}
              <div className="grid grid-cols-1 gap-1 mt-4">
                {executionChartData.map((entry, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getClientColor(entry.name, 'execution') }}
                    ></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.name}: {entry.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consensus Clients Pie Chart */}
            <div className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                <Icon name="building" size="lg" color="primary" className="inline mr-2" />Consensus Clients
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={consensusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={110}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {consensusChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getClientColor(entry.name, 'consensus')} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Consensus Client Legend */}
              <div className="grid grid-cols-1 gap-1 mt-4">
                {consensusChartData.map((entry, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getClientColor(entry.name, 'consensus') }}
                    ></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.name}: {entry.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Setup Type Pie Chart */}
            <div className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                🏠 Setup Type
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={setupChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={110}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {setupChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getSetupColor(entry.name)} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Setup Type Legend */}
              <div className="grid grid-cols-1 gap-1 mt-4">
                {setupChartData.map((entry, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getSetupColor(entry.name) }}
                    ></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.name}: {entry.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Client Combinations Bar Chart */}
        <GlassCard hoverable={false}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            <Icon name="clientDiversity" size="lg" color="primary" className="inline mr-2" />Client Combinations (Execution + Consensus)
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={combinationChartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="name" 
                angle={45}
                textAnchor="start"
                height={120}
                interval={0}
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Number of Operators', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), 'Operators']}
                labelFormatter={(label) => `Client Combination: ${label}`}
                cursor={false}
              />
              <Bar dataKey="value">
                {combinationChartData.map((entry, index) => {
                  const maxValue = Math.max(...combinationChartData.map(d => d.value));
                  const intensity = entry.value / maxValue;
                  const opacity = 0.3 + 0.7 * intensity;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(103, 126, 234, ${opacity})`} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

      </div>
    </div>
  );
};

export default ClientDiversityTab;