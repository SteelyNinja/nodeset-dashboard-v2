// Enhanced GlassCard with elevation levels and interaction states
import React, { useState } from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  size?: 'small' | 'medium' | 'large';
  elevation?: 'flat' | 'raised' | 'elevated' | 'floating';
  state?: 'default' | 'loading' | 'error' | 'success';
  interactive?: boolean;
  onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '',
  hoverable = true,
  size = 'medium',
  elevation = 'raised',
  state = 'default',
  interactive = false,
  onClick
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // Elevation styles - consistent background opacity across all cards
  const elevationStyles = {
    flat: {
      shadow: 'shadow-none',
      border: 'border-white/5 dark:border-white/10',
      backdrop: 'backdrop-blur-[5px]',
      bg: 'bg-gradient-to-br from-primary-500/12 to-secondary-500/12 dark:from-primary-400/10 dark:to-secondary-400/10'
    },
    raised: {
      shadow: 'shadow-sm',
      border: 'border-white/10 dark:border-white/15',
      backdrop: 'backdrop-blur-[10px] dark:backdrop-blur-[15px]',
      bg: 'bg-gradient-to-br from-primary-500/12 to-secondary-500/12 dark:from-primary-400/10 dark:to-secondary-400/10'
    },
    elevated: {
      shadow: 'shadow-md',
      border: 'border-white/15 dark:border-white/20',
      backdrop: 'backdrop-blur-[15px] dark:backdrop-blur-[20px]',
      bg: 'bg-gradient-to-br from-primary-500/12 to-secondary-500/12 dark:from-primary-400/10 dark:to-secondary-400/10'
    },
    floating: {
      shadow: 'shadow-lg shadow-primary-500/10 dark:shadow-primary-400/20',
      border: 'border-white/20 dark:border-white/25',
      backdrop: 'backdrop-blur-[20px] dark:backdrop-blur-[25px]',
      bg: 'bg-gradient-to-br from-primary-500/12 to-secondary-500/12 dark:from-primary-400/10 dark:to-secondary-400/10'
    }
  };

  // State styles
  const stateStyles = {
    default: '',
    loading: 'animate-pulse',
    error: 'border-danger-500/50 bg-gradient-to-br from-danger-500/5 to-danger-600/5 dark:from-danger-400/8 dark:to-danger-500/8',
    success: 'border-success-500/50 bg-gradient-to-br from-success-500/5 to-success-600/5 dark:from-success-400/8 dark:to-success-500/8'
  };

  // Size styles
  const sizeStyles = {
    small: 'p-4 m-2',
    medium: 'p-6 m-3',
    large: 'p-8 m-4'
  };

  // Hover styles based on elevation
  const getHoverStyles = () => {
    if (!hoverable || size === 'large') return '';
    
    const baseHover = 'hover:-translate-y-1 hover:scale-[1.02]';
    
    switch (elevation) {
      case 'flat':
        return `${baseHover} hover:shadow-sm hover:border-white/10 dark:hover:border-white/15 hover:backdrop-blur-[10px]`;
      case 'raised':
        return `${baseHover} hover:shadow-md hover:border-white/15 dark:hover:border-white/20 hover:from-primary-500/15 hover:to-secondary-500/15 dark:hover:from-primary-400/12 dark:hover:to-secondary-400/12`;
      case 'elevated':
        return `${baseHover} hover:shadow-lg hover:border-white/20 dark:hover:border-white/25 hover:from-primary-500/15 hover:to-secondary-500/15 dark:hover:from-primary-400/12 dark:hover:to-secondary-400/12`;
      case 'floating':
        return `${baseHover} hover:shadow-xl hover:shadow-primary-500/20 dark:hover:shadow-primary-400/30 hover:border-white/25 dark:hover:border-white/30`;
      default:
        return baseHover;
    }
  };

  // Interactive styles
  const getInteractiveStyles = () => {
    if (!interactive && !onClick) return '';
    
    return `
      cursor-pointer select-none
      active:scale-[0.98] active:translate-y-0
      ${isPressed ? 'scale-[0.98] translate-y-0' : ''}
      focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-transparent
    `;
  };

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  const currentElevation = elevationStyles[elevation];
  
  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl
        ${currentElevation.bg}
        ${currentElevation.backdrop}
        ${currentElevation.border}
        ${currentElevation.shadow}
        ${sizeStyles[size]}
        ${stateStyles[state]}
        ${getHoverStyles()}
        ${getInteractiveStyles()}
        transition-all duration-300 ease-out
        ${className}
      `}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      tabIndex={interactive || onClick ? 0 : undefined}
      role={interactive || onClick ? 'button' : undefined}
    >
      {/* Loading overlay */}
      {state === 'loading' && (
        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Shimmer effect for elevated cards */}
      {(elevation === 'elevated' || elevation === 'floating') && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-out" />
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default GlassCard;