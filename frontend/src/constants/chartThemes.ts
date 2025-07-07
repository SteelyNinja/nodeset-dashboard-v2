// Professional Chart Color Palettes and Theming System
// Based on NodeSet brand colors and enterprise design standards

export const PROFESSIONAL_CHART_COLORS = {
  // Primary palette - Professional blue gradient for single-data visualizations
  primary: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  
  // Divergent palette - Red to green for performance/comparison data
  divergent: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'],
  
  // Sequential palette - Light to dark for intensity/density mapping
  sequential: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#64748b', '#1e293b'],
  
  // Categorical palette - Harmonious colors for different categories
  categorical: ['#2563eb', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  
  // Extended categorical for many categories
  categoricalExtended: [
    '#2563eb', // Primary blue
    '#8b5cf6', // Secondary purple  
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#14b8a6'  // Teal
  ],
  
  // Status colors aligned with design system
  status: {
    success: '#10b981',
    warning: '#f59e0b', 
    danger: '#ef4444',
    info: '#2563eb',
    neutral: '#64748b'
  }
};

// Chart animation configuration for smooth, professional interactions
export const chartAnimationConfig = {
  animationBegin: 0,
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
  
  // Interaction animations
  hover: {
    animationDuration: 200,
    animationEasing: 'ease-in-out' as const
  },
  
  // Loading animations
  enter: {
    animationDuration: 600,
    animationEasing: 'ease-out' as const
  },
  
  // Staggered animations for multiple elements
  stagger: {
    delay: 50, // 50ms between each element
    maxDelay: 500 // Maximum total delay
  },
  
  // Advanced easing curves
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    swift: 'cubic-bezier(0.55, 0, 0.1, 1)'
  }
};

// Professional chart theming for consistent styling
export const CHART_THEME = {
  // Grid styling - subtle, professional appearance
  grid: {
    stroke: 'rgba(203, 213, 225, 0.3)',
    strokeDasharray: '2 2',
    strokeWidth: 1
  },
  
  // Enhanced tooltip styling
  tooltip: {
    content: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(203, 213, 225, 0.5)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '12px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#1e293b'
    },
    contentDark: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      padding: '12px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#f8fafc'
    },
    cursor: {
      fill: 'rgba(37, 99, 235, 0.1)',
      stroke: 'rgba(37, 99, 235, 0.3)',
      strokeWidth: 1
    }
  },
  
  // Professional legend styling
  legend: {
    iconType: 'circle' as const,
    iconSize: 8,
    wrapperStyle: { 
      fontSize: '14px',
      fontWeight: '500',
      color: '#64748b'
    },
    itemStyle: {
      marginRight: '16px'
    }
  },
  
  // Axis styling
  axis: {
    tick: {
      fontSize: 12,
      fontWeight: '400',
      fill: '#64748b'
    },
    line: {
      stroke: 'rgba(203, 213, 225, 0.4)',
      strokeWidth: 1
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      fill: '#475569',
      textAnchor: 'middle' as const
    }
  },
  
  // Enhanced bar/area styling
  bar: {
    radius: [2, 2, 0, 0] as [number, number, number, number],
    strokeWidth: 0,
    fillOpacity: 0.8,
    hoverFillOpacity: 0.9
  },
  
  // Line chart styling
  line: {
    strokeWidth: 2,
    dot: {
      r: 3,
      strokeWidth: 2,
      fill: '#ffffff'
    },
    activeDot: {
      r: 4,
      strokeWidth: 2,
      fill: '#ffffff'
    }
  },
  
  // Pie chart styling
  pie: {
    strokeWidth: 1,
    stroke: '#ffffff',
    fillOpacity: 0.9,
    hoverFillOpacity: 1
  }
};

// Utility functions for color selection
export const getChartColors = (type: keyof typeof PROFESSIONAL_CHART_COLORS, count?: number) => {
  const colors = PROFESSIONAL_CHART_COLORS[type];
  if (!count) return colors;
  
  // Ensure colors is an array
  if (!Array.isArray(colors)) return colors;
  
  // If we need more colors than available, cycle through the palette
  if (count <= colors.length) {
    return colors.slice(0, count);
  }
  
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

// Get color by index with automatic palette selection
export const getColorByIndex = (index: number, paletteType: keyof typeof PROFESSIONAL_CHART_COLORS = 'categorical') => {
  const colors = PROFESSIONAL_CHART_COLORS[paletteType];
  if (!Array.isArray(colors)) return colors;
  return colors[index % colors.length];
};

// Generate gradient for single-value visualizations
export const getPrimaryGradient = (opacity: number = 0.8) => ({
  id: 'primaryGradient',
  x1: '0%',
  y1: '0%', 
  x2: '0%',
  y2: '100%',
  stops: [
    { offset: '0%', color: PROFESSIONAL_CHART_COLORS.primary[0], opacity },
    { offset: '100%', color: PROFESSIONAL_CHART_COLORS.primary[4], opacity: opacity * 0.3 }
  ]
});

const chartThemes = {
  PROFESSIONAL_CHART_COLORS,
  chartAnimationConfig,
  CHART_THEME,
  getChartColors,
  getColorByIndex,
  getPrimaryGradient
};

export default chartThemes;