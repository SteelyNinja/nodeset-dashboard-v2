import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PROFESSIONAL_CHART_COLORS, chartAnimationConfig, CHART_THEME } from '../../constants/chartThemes';

interface BarChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface BarChartProps {
  data: BarChartData[];
  dataKey?: string;
  color?: string;
  colorPalette?: 'primary' | 'categorical' | 'divergent' | 'sequential';
  className?: string;
  title?: string;
  xAxisDataKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  enableAnimations?: boolean;
}

const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  dataKey = 'value',
  color,
  colorPalette = 'primary',
  className = '',
  title,
  xAxisDataKey = 'name',
  xAxisLabel,
  yAxisLabel,
  enableAnimations = true
}) => {
  // Get professional color - use provided color or palette
  const chartColor = color || PROFESSIONAL_CHART_COLORS[colorPalette][0];
  
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
          <p className="font-medium">{`${label}`}</p>
          <p className="text-primary-600">
            {`${payload[0].name}: ${payload[0].value.toLocaleString()}`}
          </p>
          <div className="w-full h-1 bg-primary-200 rounded-full mt-2">
            <div 
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (payload[0].value / Math.max(...data.map(d => d[dataKey]))) * 100)}%` }}
            />
          </div>
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
          <p className="font-medium">{`${label}`}</p>
          <p className="text-primary-400">
            {`${payload[0].name}: ${payload[0].value.toLocaleString()}`}
          </p>
          <div className="w-full h-1 bg-primary-800 rounded-full mt-2">
            <div 
              className="h-full bg-primary-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (payload[0].value / Math.max(...data.map(d => d[dataKey]))) * 100)}%` }}
            />
          </div>
        </div>
      );
    }
    return null;
  };
  return (
    <div className={`
      bg-glass-light dark:bg-glass-dark 
      backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
      border border-gray-200 dark:border-white/15
      rounded-2xl 
      shadow-glass-light dark:shadow-glass-dark
      p-6 
      subtle-bar-hover
      ${className.includes('h-') ? '' : 'h-[400px]'}
      ${className}
    `}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 60,
            bottom: 60,
          }}
        >
          <CartesianGrid 
            stroke={CHART_THEME.grid.stroke}
            strokeDasharray={CHART_THEME.grid.strokeDasharray}
            strokeWidth={CHART_THEME.grid.strokeWidth}
          />
          <XAxis 
            dataKey={xAxisDataKey}
            tick={{
              fontSize: 12,
              fill: '#64748b',
              textAnchor: 'end'
            }}
            axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            interval={0}
            height={60}
            angle={-45}
          />
          <YAxis 
            tick={CHART_THEME.axis.tick}
            axisLine={CHART_THEME.axis.line}
            tickFormatter={formatYAxisTick}
            label={{ 
              value: yAxisLabel, 
              angle: -90, 
              position: 'insideLeft',
              style: CHART_THEME.axis.label
            }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={CHART_THEME.tooltip.cursor}
          />
          <Tooltip 
            content={<CustomTooltipDark />}
            cursor={CHART_THEME.tooltip.cursor}
          />
          <Bar 
            dataKey={dataKey} 
            fill={chartColor}
            stroke="transparent"
            strokeWidth={0}
            radius={CHART_THEME.bar.radius}
            fillOpacity={CHART_THEME.bar.fillOpacity}
            style={{
              cursor: 'pointer'
            }}
            {...(enableAnimations && {
              animationBegin: chartAnimationConfig.animationBegin,
              animationDuration: chartAnimationConfig.animationDuration,
              animationEasing: chartAnimationConfig.animationEasing
            })}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={chartColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartComponent;