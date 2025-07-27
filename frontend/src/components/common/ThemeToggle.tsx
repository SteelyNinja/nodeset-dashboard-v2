import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  size = 'md', 
  showLabel = false,
  className = '' 
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Icons using CSS and Unicode symbols
  const SunIcon = () => (
    <div className={`${iconSizeClasses[size]} flex items-center justify-center`}>
      <div className="relative">
        <div className="absolute inset-0 bg-yellow-400 rounded-full animate-pulse" />
        <svg className={`${iconSizeClasses[size]} relative text-yellow-500`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );

  const MoonIcon = () => (
    <div className={`${iconSizeClasses[size]} flex items-center justify-center`}>
      <svg className={`${iconSizeClasses[size]} text-blue-400`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
    </div>
  );

  const SystemIcon = () => (
    <div className={`${iconSizeClasses[size]} flex items-center justify-center`}>
      <svg className={`${iconSizeClasses[size]} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
      </svg>
    </div>
  );

  const handleClick = () => {
    if (theme === 'system') {
      // If on system, toggle to the opposite of current resolved theme
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      // Cycle through: light -> dark -> system -> light...
      if (theme === 'light') {
        setTheme('dark');
      } else if (theme === 'dark') {
        setTheme('system');
      } else {
        setTheme('light');
      }
    }
  };

  const getCurrentIcon = () => {
    if (theme === 'system') {
      return <SystemIcon />;
    }
    return resolvedTheme === 'dark' ? <MoonIcon /> : <SunIcon />;
  };

  const getThemeLabel = () => {
    if (theme === 'system') {
      return `System (${resolvedTheme})`;
    }
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleClick}
        className={`
          ${sizeClasses[size]}
          relative flex items-center justify-center
          bg-white/10 dark:bg-gray-800/50
          border border-gray-200/50 dark:border-white/15
          backdrop-blur-sm
          rounded-lg
          hover:bg-white/20 dark:hover:bg-gray-700/50
          hover:border-primary-300 dark:hover:border-primary-600
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500/50
          shadow-sm hover:shadow-md
          group
        `}
        title={`Current theme: ${getThemeLabel()}. Click to cycle through themes.`}
        aria-label={`Switch theme. Current: ${getThemeLabel()}`}
      >
        <div className="transition-transform duration-200 group-hover:scale-110">
          {getCurrentIcon()}
        </div>
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary-500/0 via-primary-500/5 to-primary-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
      
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getThemeLabel()}
        </span>
      )}
    </div>
  );
};

export default ThemeToggle;