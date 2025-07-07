import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PROFESSIONAL_CHART_COLORS, chartAnimationConfig, CHART_THEME } from '../../constants/chartThemes';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  colors?: string[];
  colorPalette?: 'categorical' | 'primary' | 'divergent' | 'sequential';
  showLegend?: boolean;
  labelKey?: string;
  valueKey?: string;
  enableAnimations?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  title,
  colors,
  colorPalette = 'categorical',
  showLegend = true,
  labelKey = 'name',
  valueKey = 'value',
  enableAnimations = true,
  innerRadius = 0,
  outerRadius = 120
}) => {
  // Get professional colors - use provided colors or palette
  const chartColors = colors || PROFESSIONAL_CHART_COLORS[colorPalette];
  
  // Custom tooltip component with professional styling
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={CHART_THEME.tooltip.content} className="dark:hidden">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-primary-600">
            {`${data.name}: ${data.value.toLocaleString()}`}
            {data.payload.percentage && (
              <span className="ml-2 text-neutral-500">({data.payload.percentage})</span>
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipDark = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={CHART_THEME.tooltip.contentDark} className="hidden dark:block">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-primary-400">
            {`${data.name}: ${data.value.toLocaleString()}`}
            {data.payload.percentage && (
              <span className="ml-2 text-neutral-300">({data.payload.percentage})</span>
            )}
          </p>
        </div>
      );
    }
    return null;
  };
  
  // Custom label function with better formatting
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Only show label if value is significant enough
    const total = data.reduce((sum, entry) => sum + (entry as any)[valueKey], 0);
    const percentage = (value / total) * 100;
    
    if (percentage < 5) return null; // Hide labels for small slices
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-semibold"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
      >
        {percentage.toFixed(1)}%
      </text>
    );
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
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill="#8884d8"
            dataKey={valueKey}
            label={renderCustomLabel}
            labelLine={false}
            stroke={CHART_THEME.pie.stroke}
            strokeWidth={CHART_THEME.pie.strokeWidth}
            fillOpacity={CHART_THEME.pie.fillOpacity}
            {...(enableAnimations && {
              animationBegin: chartAnimationConfig.animationBegin,
              animationDuration: chartAnimationConfig.animationDuration,
              animationEasing: chartAnimationConfig.animationEasing
            })}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || chartColors[index % chartColors.length]}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Tooltip content={<CustomTooltipDark />} />
          {showLegend && (
            <Legend 
              iconType="circle"
              iconSize={12}
              wrapperStyle={CHART_THEME.legend.wrapperStyle}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartComponent;