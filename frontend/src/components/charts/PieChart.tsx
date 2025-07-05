import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  colors?: string[];
  showLegend?: boolean;
  labelKey?: string;
  valueKey?: string;
}

const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  title,
  colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
  showLegend = true,
  labelKey = 'name',
  valueKey = 'value'
}) => {
  return (
    <div className="
      bg-glass-light dark:bg-glass-dark 
      backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
      border border-gray-200 dark:border-white/15
      rounded-2xl 
      shadow-glass-light dark:shadow-glass-dark
      p-6
    ">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={120}
            fill="#8884d8"
            dataKey={valueKey}
            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || colors[index % colors.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string) => [
              value.toLocaleString(), 
              name
            ]}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartComponent;