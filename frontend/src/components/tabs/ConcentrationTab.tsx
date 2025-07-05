import React, { useState, useEffect } from 'react';
import { ConcentrationMetrics, ValidatorData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassCard from '../common/GlassCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LorenzCurveData {
  x: number;
  actual: number;
  equality: number;
}

const ConcentrationTab: React.FC = () => {
  const [concentrationMetrics, setConcentrationMetrics] = useState<ConcentrationMetrics | null>(null);
  const [lorenzData, setLorenzData] = useState<LorenzCurveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [concentrationData, validatorData] = await Promise.all([
        apiService.getConcentrationMetrics(),
        apiService.getValidatorData()
      ]);
      
      setConcentrationMetrics(concentrationData);
      
      // Calculate Lorenz curve data
      const operatorValidators = validatorData.operator_validators || {};
      const validatorCounts = Object.values(operatorValidators).sort((a, b) => a - b);
      const totalValidators = validatorCounts.reduce((sum, count) => sum + count, 0);
      const n = validatorCounts.length;
      
      if (n > 0 && totalValidators > 0) {
        const lorenzPoints: LorenzCurveData[] = [];
        let cumulativeValidators = 0;
        
        // Add starting point
        lorenzPoints.push({ x: 0, actual: 0, equality: 0 });
        
        for (let i = 0; i < n; i++) {
          cumulativeValidators += validatorCounts[i];
          const cumOperatorsPercent = ((i + 1) / n) * 100;
          const cumValidatorsPercent = (cumulativeValidators / totalValidators) * 100;
          
          lorenzPoints.push({
            x: cumOperatorsPercent,
            actual: cumValidatorsPercent,
            equality: cumOperatorsPercent
          });
        }
        
        setLorenzData(lorenzPoints);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🎯 Concentration Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Lorenz curve and concentration metrics
        </p>
      </div>

      {concentrationMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Lorenz Curve (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-glass-light dark:bg-glass-dark backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140 border border-gray-200 dark:border-white/15 rounded-2xl shadow-glass-light dark:shadow-glass-dark p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Validator Concentration Curve (Lorenz Curve)
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={lorenzData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="x"
                    type="number"
                    domain={[0, 100]}
                    label={{ value: 'Cumulative % of Operators', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    type="number"
                    domain={[0, 100]}
                    label={{ value: 'Cumulative % of Validators', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`, 
                      name === 'actual' ? 'Actual Distribution' : 'Perfect Equality'
                    ]}
                    labelFormatter={(value: number) => `${value.toFixed(1)}% of Operators`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#667eea" 
                    strokeWidth={3}
                    name="Actual Distribution"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="equality" 
                    stroke="#9333ea" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Perfect Equality"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Concentration Metrics Table (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-glass-light dark:bg-glass-dark backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140 border border-gray-200 dark:border-white/15 rounded-2xl shadow-glass-light dark:shadow-glass-dark p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🔍 Concentration Metrics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Metric</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Value</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-900 dark:text-white">Gini Coefficient</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {concentrationMetrics.gini_coefficient.toFixed(4)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-900 dark:text-white">Top 1 Operator</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {concentrationMetrics.top_1_percent.toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-900 dark:text-white">Top 5 Operators</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {concentrationMetrics.top_5_percent.toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-900 dark:text-white">Top 10 Operators</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {concentrationMetrics.top_10_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcentrationTab;