import React from 'react';

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const baseClasses = `
    relative overflow-hidden group
    backdrop-blur-md backdrop-saturate-150 border-2 rounded-2xl
    font-semibold transition-all duration-300 ease-glass
    focus:outline-none focus:ring-2 focus:ring-offset-2
    shadow-2xl hover:shadow-3xl
    transform hover:scale-105 active:scale-95
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)]'}
  `;

  const variantClasses = {
    primary: `
      bg-gradient-to-br from-primary-500/80 via-primary-600/70 to-primary-700/80
      dark:from-primary-400/60 dark:via-primary-500/50 dark:to-primary-600/60
      border-primary-200/50 dark:border-primary-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-primary-400/90 hover:via-primary-500/80 hover:to-primary-600/90
      dark:hover:from-primary-300/70 dark:hover:via-primary-400/60 dark:hover:to-primary-500/70
      hover:border-primary-100/60 dark:hover:border-primary-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.6)]
      focus:ring-primary-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(59,130,246,0.4)]
    `,
    secondary: `
      bg-gradient-to-br from-secondary-500/80 via-secondary-600/70 to-secondary-700/80
      dark:from-secondary-400/60 dark:via-secondary-500/50 dark:to-secondary-600/60
      border-secondary-200/50 dark:border-secondary-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-secondary-400/90 hover:via-secondary-500/80 hover:to-secondary-600/90
      dark:hover:from-secondary-300/70 dark:hover:via-secondary-400/60 dark:hover:to-secondary-500/70
      hover:border-secondary-100/60 dark:hover:border-secondary-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(168,85,247,0.6)]
      focus:ring-secondary-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(168,85,247,0.4)]
    `,
    success: `
      bg-gradient-to-br from-success/80 via-green-600/70 to-green-700/80
      dark:from-green-400/60 dark:via-green-500/50 dark:to-green-600/60
      border-green-200/50 dark:border-green-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-green-400/90 hover:via-success/80 hover:to-green-600/90
      dark:hover:from-green-300/70 dark:hover:via-green-400/60 dark:hover:to-green-500/70
      hover:border-green-100/60 dark:hover:border-green-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(34,197,94,0.6)]
      focus:ring-green-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(34,197,94,0.4)]
    `,
    warning: `
      bg-gradient-to-br from-warning/80 via-orange-600/70 to-orange-700/80
      dark:from-orange-400/60 dark:via-orange-500/50 dark:to-orange-600/60
      border-orange-200/50 dark:border-orange-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-orange-400/90 hover:via-warning/80 hover:to-orange-600/90
      dark:hover:from-orange-300/70 dark:hover:via-orange-400/60 dark:hover:to-orange-500/70
      hover:border-orange-100/60 dark:hover:border-orange-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(245,158,11,0.6)]
      focus:ring-orange-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(245,158,11,0.4)]
    `,
    danger: `
      bg-gradient-to-br from-danger/80 via-red-600/70 to-red-700/80
      dark:from-red-400/60 dark:via-red-500/50 dark:to-red-600/60
      border-red-200/50 dark:border-red-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-red-400/90 hover:via-danger/80 hover:to-red-600/90
      dark:hover:from-red-300/70 dark:hover:via-red-400/60 dark:hover:to-red-500/70
      hover:border-red-100/60 dark:hover:border-red-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(239,68,68,0.6)]
      focus:ring-red-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(239,68,68,0.4)]
    `,
    info: `
      bg-gradient-to-br from-info/80 via-blue-600/70 to-blue-700/80
      dark:from-blue-400/60 dark:via-blue-500/50 dark:to-blue-600/60
      border-blue-200/50 dark:border-blue-300/30
      text-white dark:text-white drop-shadow-lg
      hover:from-blue-400/90 hover:via-info/80 hover:to-blue-600/90
      dark:hover:from-blue-300/70 dark:hover:via-blue-400/60 dark:hover:to-blue-500/70
      hover:border-blue-100/60 dark:hover:border-blue-200/40
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.6)]
      focus:ring-blue-300/50 focus:ring-offset-2
      shadow-[0_8px_32px_-8px_rgba(59,130,246,0.4)]
    `
  };

  const sizeClasses = {
    sm: 'px-4 py-2.5 text-sm min-w-[80px]',
    md: 'px-6 py-3 text-base min-w-[120px]',
    lg: 'px-8 py-4 text-lg min-w-[160px]'
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {/* Glass overlay for glassmorphism */}
      <div className="absolute inset-0 bg-white/10 dark:bg-white/5 rounded-2xl backdrop-blur-sm" />
      
      {/* Inner glass border */}
      <div className="absolute inset-0 rounded-2xl border border-white/20 dark:border-white/10" />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
      </div>
      
      {/* Top glass highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-t-2xl" />
      
      {/* Bottom glass shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent rounded-b-2xl" />
      
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2 font-semibold tracking-wide">
        {children}
      </span>
    </button>
  );
};

export default GlassButton;