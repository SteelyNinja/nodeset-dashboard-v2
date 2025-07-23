import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ScatterChartData {
  [key: string]: any;
}

interface ScatterChartProps {
  data: ScatterChartData[];
  xDataKey: string;
  yDataKey: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  getColor?: (item: any) => string;
  yDomain?: [number | string, number | string];
  legend?: React.ReactNode;
}

const ScatterChartComponent: React.FC<ScatterChartProps> = ({
  data,
  xDataKey,
  yDataKey,
  title,
  xAxisLabel,
  yAxisLabel,
  getColor,
  yDomain,
  legend
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
        <ScatterChart 
          data={data}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xDataKey} 
            type="number"
            name={xAxisLabel}
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            dataKey={yDataKey} 
            type="number"
            name={yAxisLabel}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            domain={yDomain || ['auto', 'auto']}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value: any, name: string) => [
              name === yDataKey ? `${value.toFixed(2)}%` : value,
              name === yDataKey ? 'Performance' : (name === xDataKey ? 'Validators' : name)
            ]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `${payload[0].payload.operator} (${payload[0].payload.category})`;
              }
              return label;
            }}
          />
          {legend && <Legend content={() => legend} />}
          <Scatter 
            dataKey={yDataKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor ? getColor(entry) : '#8884d8'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterChartComponent;