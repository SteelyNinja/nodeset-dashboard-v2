import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  
  // Custom tooltip component with professional styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={CHART_THEME.tooltip.content} className="dark:hidden">
          <p className="font-medium">{`${label}`}</p>
          <p className="text-primary-600">
            {`${payload[0].name}: ${payload[0].value.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipDark = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={CHART_THEME.tooltip.contentDark} className="hidden dark:block">
          <p className="font-medium">{`${label}`}</p>
          <p className="text-primary-400">
            {`${payload[0].name}: ${payload[0].value.toLocaleString()}`}
          </p>
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
          <CartesianGrid 
            stroke={CHART_THEME.grid.stroke}
            strokeDasharray={CHART_THEME.grid.strokeDasharray}
            strokeWidth={CHART_THEME.grid.strokeWidth}
          />
          <XAxis 
            dataKey={xAxisDataKey}
            tick={CHART_THEME.axis.tick}
            axisLine={CHART_THEME.axis.line}
            interval={0}
            label={{ 
              value: xAxisLabel, 
              position: 'insideBottom', 
              offset: -10,
              style: CHART_THEME.axis.label
            }}
          />
          <YAxis 
            tick={CHART_THEME.axis.tick}
            axisLine={CHART_THEME.axis.line}
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
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartComponent;