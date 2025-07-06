import React, { useRef, useState, useEffect } from 'react';
import { TabId } from '../../types/api';

interface Tab {
  id: TabId;
  label: string;
  icon?: string;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  className?: string;
}

const tabs: Tab[] = [
  { id: 'information', label: 'Information', icon: 'ℹ️' },
  { id: 'distribution', label: 'Distribution', icon: '📈' },
  { id: 'concentration', label: 'Concentration', icon: '🎯' },
  { id: 'operators', label: 'Top Operators', icon: '🏆' },
  { id: 'performance', label: 'Performance', icon: '⚡' },
  { id: 'proposals', label: 'Proposals', icon: '🤲' },
  { id: 'sync-committee', label: 'Sync Committee', icon: '📡' },
  { id: 'exit-analysis', label: 'Exit Analysis', icon: '🚪' },
  { id: 'costs', label: 'Costs', icon: '💰' },
  { id: 'client-diversity', label: 'Client Diversity', icon: '🔧' },
  { id: 'gas-analysis', label: 'Pump the Gas!', icon: '🔥' },
];

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const handleResize = () => checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className={`bg-white/10 dark:bg-gray-800/20 backdrop-blur-glass border-b border-gray-200/30 dark:border-white/15 shadow-glass ${className}`}>
      <div className="px-4 sm:px-6 lg:px-8 relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-0 bottom-0 z-10 bg-gradient-to-r from-white/20 to-transparent dark:from-gray-800/30 flex items-center px-3 hover:from-white/30 dark:hover:from-gray-800/40 transition-all duration-200"
          >
            <span className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">←</span>
          </button>
        )}
        
        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-0 bottom-0 z-10 bg-gradient-to-l from-white/20 to-transparent dark:from-gray-800/30 flex items-center px-3 hover:from-white/30 dark:hover:from-gray-800/40 transition-all duration-200"
          >
            <span className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">→</span>
          </button>
        )}
        
        <div 
          ref={scrollRef}
          className="flex space-x-1 overflow-x-auto scrollbar-hide scroll-smooth py-2"
          onScroll={checkScrollButtons}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                group relative whitespace-nowrap py-2 px-2 sm:px-3 mx-0.5 my-1 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm 
                transition-all duration-300 ease-glass backdrop-blur-md border-2 overflow-visible
                transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95
                flex-shrink-0 min-w-fit
                ${activeTab === tab.id
                  ? `
                    bg-gradient-to-br from-primary-500/90 via-primary-600/80 to-primary-700/90
                    border-primary-300/60 text-white 
                    shadow-[0_4px_16px_-4px_rgba(59,130,246,0.4)] dark:shadow-[0_4px_16px_-4px_rgba(59,130,246,0.2)]
                    hover:shadow-[0_6px_20px_-6px_rgba(59,130,246,0.5)] dark:hover:shadow-[0_6px_20px_-6px_rgba(59,130,246,0.3)]
                  `
                  : `
                    bg-white/10 dark:bg-white/5 border-white/20 dark:border-white/10
                    text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400
                    hover:bg-gray-100/40 dark:hover:bg-white/8 hover:border-primary-300/50
                    shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]
                    hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.2)] dark:hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.1)]
                  `
                }
              `}
            >
              {/* Glass overlay */}
              <div className="absolute inset-0 bg-white/10 dark:bg-white/5 rounded-lg sm:rounded-xl backdrop-blur-sm" />
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 overflow-hidden rounded-lg sm:rounded-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-out" />
              </div>
              
              {/* Content */}
              <span className="relative z-10 flex items-center justify-center">
                {/* Icon only on very small screens */}
                <span className="text-base sm:hidden">{tab.icon}</span>
                
                {/* Icon + text on sm screens and up */}
                <span className="hidden sm:flex items-center space-x-1">
                  <span className="text-sm flex-shrink-0">{tab.icon}</span>
                  <span className="tracking-tight text-center text-xs sm:text-sm">{tab.label}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;