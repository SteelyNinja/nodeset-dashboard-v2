import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartData {
  [key: string]: any;
}

interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth?: number;
  name?: string;
  strokeDasharray?: string;
  dot?: boolean | object;
}

interface LineChartProps {
  data: LineChartData[];
  lines: LineConfig[];
  title?: string;
  xAxisDataKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisType?: 'number' | 'category';
  yAxisType?: 'number' | 'category';
  xDomain?: [number | string, number | string];
  yDomain?: [number | string, number | string];
  showLegend?: boolean;
}

const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  lines,
  title,
  xAxisDataKey = 'x',
  xAxisLabel,
  yAxisLabel,
  xAxisType = 'number',
  yAxisType = 'number',
  xDomain,
  yDomain,
  showLegend = true
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
        <LineChart 
          data={data}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisDataKey}
            type={xAxisType}
            domain={xDomain}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis 
            type={yAxisType}
            domain={yDomain}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip />
          {showLegend && <Legend />}
          {lines.map((lineConfig, index) => (
            <Line 
              key={index}
              type="monotone"
              dataKey={lineConfig.dataKey}
              stroke={lineConfig.stroke}
              strokeWidth={lineConfig.strokeWidth || 2}
              name={lineConfig.name || lineConfig.dataKey}
              strokeDasharray={lineConfig.strokeDasharray}
              dot={lineConfig.dot !== undefined ? lineConfig.dot : { r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartComponent;