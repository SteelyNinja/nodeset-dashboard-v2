// Enhanced GlassButton with variants, sizes, and loading states
import React, { useState } from 'react';

interface GlassButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  state?: 'default' | 'loading' | 'disabled';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  state = 'default',
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  loadingText,
  icon,
  iconPosition = 'left',
  fullWidth = false
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const isDisabled = disabled || loading || state === 'disabled';
  const isLoading = loading || state === 'loading';

  // Variant styles
  const variantStyles = {
    primary: {
      base: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white border-primary-400/50',
      hover: 'hover:from-primary-400 hover:to-primary-500 hover:border-primary-300/60 hover:shadow-lg hover:shadow-primary-500/25',
      focus: 'focus:ring-primary-500/50',
      disabled: 'disabled:from-primary-500/50 disabled:to-primary-600/50 disabled:border-primary-400/25'
    },
    secondary: {
      base: 'bg-gradient-to-br from-white/10 to-white/5 dark:from-white/5 dark:to-white/2 text-neutral-700 dark:text-neutral-200 border-white/20 dark:border-white/15',
      hover: 'hover:from-white/15 hover:to-white/8 dark:hover:from-white/8 dark:hover:to-white/4 hover:border-white/30 dark:hover:border-white/25 hover:shadow-md',
      focus: 'focus:ring-neutral-500/50',
      disabled: 'disabled:from-white/5 disabled:to-white/2 disabled:border-white/10'
    },
    tertiary: {
      base: 'bg-transparent text-neutral-600 dark:text-neutral-300 border-transparent',
      hover: 'hover:bg-white/10 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-neutral-100',
      focus: 'focus:ring-neutral-500/50',
      disabled: 'disabled:text-neutral-400 dark:disabled:text-neutral-600'
    },
    danger: {
      base: 'bg-gradient-to-br from-danger-500 to-danger-600 text-white border-danger-400/50',
      hover: 'hover:from-danger-400 hover:to-danger-500 hover:border-danger-300/60 hover:shadow-lg hover:shadow-danger-500/25',
      focus: 'focus:ring-danger-500/50',
      disabled: 'disabled:from-danger-500/50 disabled:to-danger-600/50 disabled:border-danger-400/25'
    },
    success: {
      base: 'bg-gradient-to-br from-success-500 to-success-600 text-white border-success-400/50',
      hover: 'hover:from-success-400 hover:to-success-500 hover:border-success-300/60 hover:shadow-lg hover:shadow-success-500/25',
      focus: 'focus:ring-success-500/50',
      disabled: 'disabled:from-success-500/50 disabled:to-success-600/50 disabled:border-success-400/25'
    },
    warning: {
      base: 'bg-gradient-to-br from-warning-500 to-warning-600 text-white border-warning-400/50',
      hover: 'hover:from-warning-400 hover:to-warning-500 hover:border-warning-300/60 hover:shadow-lg hover:shadow-warning-500/25',
      focus: 'focus:ring-warning-500/50',
      disabled: 'disabled:from-warning-500/50 disabled:to-warning-600/50 disabled:border-warning-400/25'
    }
  };

  // Size styles
  const sizeStyles = {
    xs: 'px-2 py-1 text-label-small h-6 gap-1',
    sm: 'px-3 py-2 text-label-medium h-8 gap-1.5',
    md: 'px-4 py-2.5 text-body-medium h-10 gap-2',
    lg: 'px-6 py-3 text-body-large h-12 gap-2.5',
    xl: 'px-8 py-4 text-headline-small h-14 gap-3'
  };

  // Loading spinner component
  const LoadingSpinner = ({ size: spinnerSize }: { size: string }) => {
    const spinnerSizes = {
      xs: 'w-3 h-3',
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
      xl: 'w-6 h-6'
    };

    return (
      <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${spinnerSizes[spinnerSize as keyof typeof spinnerSizes]}`} />
    );
  };

  // Interactive styles
  const getInteractiveStyles = () => {
    if (isDisabled) return 'cursor-not-allowed';
    
    return `
      cursor-pointer select-none
      active:scale-[0.96] active:translate-y-0
      ${isPressed ? 'scale-[0.96] translate-y-0' : ''}
      transform transition-all duration-150 ease-out
    `;
  };

  const handleMouseDown = () => {
    if (!isDisabled) setIsPressed(true);
  };
  
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  const handleClick = () => {
    if (!isDisabled && onClick) {
      onClick();
    }
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        relative inline-flex items-center justify-center
        rounded-lg border backdrop-blur-sm
        font-medium leading-none
        ${fullWidth ? 'w-full' : ''}
        ${currentSize}
        ${currentVariant.base}
        ${!isDisabled ? currentVariant.hover : ''}
        ${currentVariant.disabled}
        ${getInteractiveStyles()}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        ${currentVariant.focus}
        ${className}
      `}
    >
      {/* Content container */}
      <span className={`flex items-center justify-center gap-inherit ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
        {icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">
            {icon}
          </span>
        )}
        
        <span className="truncate">
          {children}
        </span>
        
        {icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">
            {icon}
          </span>
        )}
      </span>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <LoadingSpinner size={size} />
            {loadingText && (
              <span className="truncate">
                {loadingText}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Shimmer effect for primary variant */}
      {variant === 'primary' && !isDisabled && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform -translate-x-full hover:translate-x-full transition-transform duration-1000 ease-out" />
        </div>
      )}
    </button>
  );
};

export default GlassButton;