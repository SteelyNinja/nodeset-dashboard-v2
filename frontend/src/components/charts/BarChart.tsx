import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface BarChartProps {
  data: BarChartData[];
  dataKey?: string;
  color?: string;
  className?: string;
  title?: string;
  xAxisDataKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  dataKey = 'value',
  color = '#FF6B6B',
  className = '',
  title,
  xAxisDataKey = 'name',
  xAxisLabel,
  yAxisLabel
}) => {
  return (
    <div className={`
      bg-glass-light dark:bg-glass-dark 
      backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
      border border-gray-200 dark:border-white/15
      rounded-2xl 
      shadow-glass-light dark:shadow-glass-dark
      p-6 
      subtle-bar-hover
      ${className}
    `}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 40,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisDataKey}
            tick={{ fontSize: 12 }}
            interval={0}
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString(), 'Operators']}
            labelFormatter={(label) => `${label} Validators`}
            cursor={false}
          />
          <Bar 
            dataKey={dataKey} 
            fill={color}
            stroke={color}
            strokeWidth={1}
            radius={[2, 2, 0, 0]}
            style={{
              cursor: 'pointer'
            }}
            fillOpacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartComponent;