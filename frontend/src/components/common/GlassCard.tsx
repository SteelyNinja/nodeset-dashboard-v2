// Fixed glassmorphism with proper blue theming
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '',
  hoverable = true,
  size = 'medium'
}) => {
  return (
    <div 
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-blue-500/5 to-purple-600/5 
        dark:from-blue-400/8 dark:to-purple-500/8
        backdrop-blur-[10px] dark:backdrop-blur-[15px]
        border border-white/10 dark:border-white/15
        rounded-xl 
        shadow-sm
        p-6 m-3
        transition-all duration-300 ease-in-out
        ${hoverable && size !== 'large' ? 'hover:from-blue-500/10 hover:to-purple-600/10 dark:hover:from-blue-400/15 dark:hover:to-purple-500/15 hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 dark:hover:border-white/25' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default GlassCard;