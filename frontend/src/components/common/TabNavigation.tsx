import React, { useRef, useState, useEffect } from 'react';
import { TabId } from '../../types/api';
import Icon, { IconName } from './Icon';

interface Tab {
  id: TabId;
  label: string;
  icon?: IconName;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  className?: string;
  loadingTabs?: TabId[];
  disabledTabs?: TabId[];
}

const tabs: Tab[] = [
  { id: 'information', label: 'Information', icon: 'info' },
  { id: 'distribution', label: 'Distribution', icon: 'distribution' },
  { id: 'concentration', label: 'Concentration', icon: 'concentration' },
  { id: 'operators', label: 'Top Operators', icon: 'trophy' },
  { id: 'performance', label: 'Performance', icon: 'performance' },
  { id: 'proposals', label: 'Proposals', icon: 'proposals' },
  { id: 'sync-committee', label: 'Sync Committee', icon: 'syncCommittee' },
  { id: 'exit-analysis', label: 'Exit Analysis', icon: 'exitAnalysis' },
  { id: 'costs', label: 'Costs', icon: 'costs' },
  { id: 'client-diversity', label: 'Client Diversity', icon: 'clientDiversity' },
  { id: 'gas-analysis', label: 'Pump the Gas!', icon: 'gasAnalysis' },
];

const TabNavigation: React.FC<TabNavigationProps> = ({ 
  activeTab, 
  onTabChange, 
  className,
  loadingTabs = [],
  disabledTabs = []
}) => {
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
            className="absolute left-0 top-0 bottom-0 z-20 bg-gradient-to-r from-white/30 via-white/20 to-transparent dark:from-gray-800/40 dark:via-gray-800/30 flex items-center px-4 hover:from-white/40 dark:hover:from-gray-800/50 transition-all duration-300 group"
          >
            <span className="text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transform group-hover:scale-110 transition-all duration-200">
              ←
            </span>
          </button>
        )}
        
        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-0 bottom-0 z-20 bg-gradient-to-l from-white/30 via-white/20 to-transparent dark:from-gray-800/40 dark:via-gray-800/30 flex items-center px-4 hover:from-white/40 dark:hover:from-gray-800/50 transition-all duration-300 group"
          >
            <span className="text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transform group-hover:scale-110 transition-all duration-200">
              →
            </span>
          </button>
        )}
        
        <div 
          ref={scrollRef}
          className="flex space-x-1 overflow-x-auto scrollbar-hide scroll-smooth py-2"
          onScroll={checkScrollButtons}
        >
          {tabs.map((tab) => {
            const isLoading = loadingTabs.includes(tab.id);
            const isDisabled = disabledTabs.includes(tab.id);
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && !isLoading && onTabChange(tab.id)}
                disabled={isDisabled}
                className={`
                  group relative whitespace-nowrap py-2 px-2 sm:px-3 mx-0.5 my-1 rounded-lg sm:rounded-xl font-medium text-label-small sm:text-label-medium 
                  transition-all duration-300 ease-glass backdrop-blur-md border-2 overflow-visible
                  ${!isDisabled && !isLoading ? 'transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95' : ''}
                  flex-shrink-0 min-w-fit
                  ${isDisabled 
                    ? 'opacity-50 cursor-not-allowed bg-neutral-100/10 dark:bg-neutral-800/10 border-neutral-300/20 dark:border-neutral-700/20 text-neutral-400 dark:text-neutral-600'
                    : isActive
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
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="absolute inset-0 bg-primary-500/20 dark:bg-primary-400/15 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}
              
              {/* Content */}
              <span className={`relative z-10 flex items-center justify-center transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                {/* Icon only on very small screens */}
                <span className="text-base sm:hidden">
                  {tab.icon && <Icon name={tab.icon} size="sm" color="current" />}
                </span>
                
                {/* Icon + text on sm screens and up */}
                <span className="hidden sm:flex items-center space-x-2">
                  {tab.icon && <Icon name={tab.icon} size="sm" color="current" />}
                  <span className="tracking-tight text-center text-label-small sm:text-label-medium">{tab.label}</span>
                </span>
              </span>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;