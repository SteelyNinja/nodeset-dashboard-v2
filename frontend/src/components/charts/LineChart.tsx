import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { chartAnimationConfig, CHART_THEME } from '../../constants/chartThemes';

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
  // Active line state for enhanced interactivity
  const [activeLine, setActiveLine] = useState<string | null>(null);
  
  // Custom Y-axis tick formatter for clean number display
  const formatYAxisTick = (value: number) => {
    // If it's a percentage (between 0-100), format as percentage
    if ((yAxisLabel && yAxisLabel.toLowerCase().includes('percentage')) || (yAxisLabel && yAxisLabel.includes('%'))) {
      return `${Math.round(value)}%`;
    }
    
    // For large numbers, use compact notation
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    
    // For decimal numbers, limit to 1 decimal place if needed
    if (value % 1 !== 0) {
      return value.toFixed(1);
    }
    
    return value.toString();
  };
  
  // Mouse event handlers for enhanced interactivity
  const onLineEnter = (dataKey: string) => {
    setActiveLine(dataKey);
  };

  const onLineLeave = () => {
    setActiveLine(null);
  };

  // Enhanced tooltip component with professional styling and animations
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          style={{
            ...CHART_THEME.tooltip.content,
            transform: active ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
            opacity: active ? 1 : 0,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
          className="dark:hidden"
        >
          <p className="font-medium mb-2">{`${xAxisDataKey}: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">
                {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomTooltipDark = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          style={{
            ...CHART_THEME.tooltip.contentDark,
            transform: active ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
            opacity: active ? 1 : 0,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
          className="hidden dark:block"
        >
          <p className="font-medium mb-2">{`${xAxisDataKey}: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">
                {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
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
          margin={{
            top: 40,
            right: 30,
            left: 60,
            bottom: 20,
          }}
        >
          <CartesianGrid 
            stroke={CHART_THEME.grid.stroke}
            strokeDasharray={CHART_THEME.grid.strokeDasharray}
            strokeWidth={CHART_THEME.grid.strokeWidth}
          />
          <XAxis 
            dataKey={xAxisDataKey}
            type={xAxisType}
            domain={xDomain}
            tick={false}
            axisLine={CHART_THEME.axis.line}
            label={undefined}
          />
          <YAxis 
            type={yAxisType}
            domain={yDomain}
            tick={CHART_THEME.axis.tick}
            axisLine={CHART_THEME.axis.line}
            tickFormatter={formatYAxisTick}
            label={yAxisLabel ? { 
              value: yAxisLabel, 
              angle: -90, 
              position: 'insideLeft',
              style: CHART_THEME.axis.label
            } : undefined}
          />
          <Tooltip content={<CustomTooltip />} />
          <Tooltip content={<CustomTooltipDark />} />
          {showLegend && (
            <Legend 
              iconType="line"
              iconSize={12}
              wrapperStyle={{...CHART_THEME.legend.wrapperStyle, marginTop: '20px', paddingTop: '10px'}}
              verticalAlign="bottom"
            />
          )}
          {lines.map((lineConfig, index) => (
            <Line 
              key={index}
              type="monotone"
              dataKey={lineConfig.dataKey}
              stroke={lineConfig.stroke}
              strokeWidth={activeLine === lineConfig.dataKey ? (lineConfig.strokeWidth || 2) + 1 : (lineConfig.strokeWidth || 2)}
              name={lineConfig.name || lineConfig.dataKey}
              strokeDasharray={lineConfig.strokeDasharray}
              dot={lineConfig.dot !== undefined ? lineConfig.dot : {
                ...CHART_THEME.line.dot,
                stroke: lineConfig.stroke,
                r: activeLine === lineConfig.dataKey ? 4 : 3
              }}
              activeDot={{
                ...CHART_THEME.line.activeDot,
                stroke: lineConfig.stroke,
                r: 5,
                strokeWidth: 3,
                style: {
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                  transition: 'all 0.2s ease-out'
                }
              }}
              onMouseEnter={() => onLineEnter(lineConfig.dataKey)}
              onMouseLeave={onLineLeave}
              animationBegin={chartAnimationConfig.animationBegin}
              animationDuration={chartAnimationConfig.animationDuration + (index * 200)}
              animationEasing={chartAnimationConfig.animationEasing}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartComponent;