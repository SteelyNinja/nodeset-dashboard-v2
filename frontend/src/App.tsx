import React, { useState, useEffect, useCallback } from 'react';
import { TabId } from './types/api';
import { apiService } from './services/api';
import Icon from './components/common/Icon';
import { analyticsService } from './services/analytics';
import AnalyticsPage from './components/AnalyticsPage';
import TheoreticalPerformancePage from './components/TheoreticalPerformancePage';
import TabNavigation from './components/common/TabNavigation';
import InformationTab from './components/tabs/InformationTab';
import DistributionTab from './components/tabs/DistributionTab';
import ConcentrationTab from './components/tabs/ConcentrationTab';
import OperatorsTab from './components/tabs/OperatorsTab';
import PerformanceTab from './components/tabs/PerformanceTab';
import ProposalsTab from './components/tabs/ProposalsTab';
import SyncCommitteeTab from './components/tabs/SyncCommitteeTab';
import ExitAnalysisTab from './components/tabs/ExitAnalysisTab';
import CostsTab from './components/tabs/CostsTab';
import ClientDiversityTab from './components/tabs/ClientDiversityTab';
import GasAnalysisTab from './components/tabs/GasAnalysisTab';
import VaultActivityTab from './components/tabs/VaultActivityTab';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('information');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [, setIsRefreshing] = useState<boolean>(false);

  // Format timestamp for display in UTC
  const formatCacheTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  // Refresh cache timestamp
  const refreshCacheTimestamp = useCallback(async () => {
    if (!backendConnected) return;
    
    setIsRefreshing(true);
    try {
      const newTimestamp = await apiService.getCacheTimestamp();
      if (newTimestamp && newTimestamp !== cacheTimestamp) {
        setCacheTimestamp(newTimestamp);
        console.log('Cache timestamp updated:', newTimestamp);
      }
    } catch (error) {
      console.warn('Failed to refresh cache timestamp:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [backendConnected, cacheTimestamp]);

  useEffect(() => {
    const checkBackend = async () => {
      const connected = await apiService.checkBackendConnection();
      setBackendConnected(connected);
      
      // If backend is connected, try to fetch cache timestamp
      if (connected) {
        try {
          const timestamp = await apiService.getCacheTimestamp();
          setCacheTimestamp(timestamp);
        } catch (error) {
          console.warn('Failed to fetch cache timestamp:', error);
          // Don't break the app if cache timestamp fails
        }
      }
    };
    
    checkBackend();
  }, []);

  // Set up periodic cache timestamp refresh
  useEffect(() => {
    if (!backendConnected) return;

    // Refresh every 30 seconds to detect new cache data
    const interval = setInterval(refreshCacheTimestamp, 30000);
    
    return () => clearInterval(interval);
  }, [backendConnected, refreshCacheTimestamp]);

  // Analytics tracking for tab switches
  const handleTabChange = (newTab: TabId) => {
    setActiveTab(newTab);
    analyticsService.trackTabSwitch(newTab);
  };


  const renderActiveTab = () => {
    switch (activeTab) {
      case 'information':
        return <InformationTab />;
      case 'distribution':
        return <DistributionTab />;
      case 'concentration':
        return <ConcentrationTab />;
      case 'operators':
        return <OperatorsTab />;
      case 'performance':
        return <PerformanceTab />;
      case 'proposals':
        return <ProposalsTab />;
      case 'sync-committee':
        return <SyncCommitteeTab />;
      case 'exit-analysis':
        return <ExitAnalysisTab />;
      case 'costs':
        return <CostsTab />;
      case 'client-diversity':
        return <ClientDiversityTab />;
      case 'gas-analysis':
        return <GasAnalysisTab />;
      case 'vault-activity':
        return <VaultActivityTab />;
      default:
        return <InformationTab />;
    }
  };

  return (
    <div className="min-h-screen bg-original-light dark:bg-original-dark">
      {/* Header */}
      <header className="bg-white/20 dark:bg-gray-800/30 backdrop-blur-glass border-b border-gray-200/50 dark:border-white/15 shadow-glass">
        <div className="px-4 sm:px-6 lg:px-8">
          {/* Mobile Layout: Stack vertically */}
          <div className="flex flex-col space-y-4 py-4 lg:hidden">
            {/* Logo Row */}
            <div className="flex justify-center">
              <div className="flex-shrink-0">
                <a 
                  href="https://nodeset.io/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block hover:opacity-80 transition-opacity duration-200"
                >
                  <img 
                    src="/Nodeset_light_mode.png" 
                    alt="NodeSet Protocol" 
                    className="h-16 w-auto dark:hidden cursor-pointer"
                  />
                  <img 
                    src="/Nodeset_dark_mode.png" 
                    alt="NodeSet Protocol" 
                    className="h-16 w-auto hidden dark:block cursor-pointer"
                  />
                </a>
              </div>
            </div>
            
            {/* Banner Text Row */}
            <div className="w-full">
              <div className="
                bg-glass-light dark:bg-glass-dark 
                backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                border border-gray-200 dark:border-white/15
                rounded-xl 
                shadow-glass-light dark:shadow-glass-dark
                p-4
              ">
                <div className="flex items-start space-x-3">
                  <Icon name="metrics" size="lg" color="primary" className="flex-shrink-0" />
                  <div className="text-gray-900 dark:text-white text-center flex-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 opacity-90">
                      Data cache updated every 15 minutes
                      {cacheTimestamp && (
                        <div className="text-xs mt-1 flex items-center justify-center gap-2">
                          <span>Current cache: {formatCacheTimestamp(cacheTimestamp)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Disclaimer Row */}
            <div className="w-full">
              <div className="
                bg-glass-light dark:bg-glass-dark 
                backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                border border-gray-200 dark:border-white/15
                rounded-xl 
                shadow-glass-light dark:shadow-glass-dark
                p-4
              ">
                <div className="text-gray-700 dark:text-gray-300">
                  <div className="text-sm font-medium mb-2">
                    Disclaimer
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    This site is independently maintained through an open source project. If you see any discrepancies or wish to contribute, please make an issue{' '}
                    <a 
                      href="https://github.com/SteelyNinja/nodeset-dashboard-v2" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors duration-200"
                    >
                      here
                    </a>.
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Desktop Layout: Logo, Main Content, Disclaimer, Connection Status */}
          <div className="hidden lg:flex items-center space-x-6 py-4">
            {/* NodeSet Logo */}
            <div className="flex-shrink-0">
              <a 
                href="https://nodeset.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity duration-200"
              >
                <img 
                  src="/Nodeset_light_mode.png" 
                  alt="NodeSet Protocol" 
                  className="h-24 w-auto dark:hidden cursor-pointer"
                />
                <img 
                  src="/Nodeset_dark_mode.png" 
                  alt="NodeSet Protocol" 
                  className="h-24 w-auto hidden dark:block cursor-pointer"
                />
              </a>
            </div>
            
            {/* Main Banner Text Card */}
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
              flex-shrink-0
            ">
              <div className="flex items-start space-x-3">
                <Icon name="metrics" size="xl" color="primary" className="flex-shrink-0" />
                <div className="text-gray-900 dark:text-white">
                  <div className="text-base text-gray-600 dark:text-gray-400 mt-1 opacity-90">
                    Data cache updated every 15 minutes
                    {cacheTimestamp && (
                      <div className="text-sm mt-1 flex items-center gap-2">
                        <span>Current cache: {formatCacheTimestamp(cacheTimestamp)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Disclaimer Card */}
            <div className="
              bg-glass-light dark:bg-glass-dark 
              backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
              border border-gray-200 dark:border-white/15
              rounded-xl 
              shadow-glass-light dark:shadow-glass-dark
              p-4
              max-w-sm
              flex-shrink-0
            ">
              <div className="text-gray-700 dark:text-gray-300">
                <div className="text-base font-medium mb-2">
                  Disclaimer
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  This site is independently maintained through an open source project. If you see any discrepancies or wish to contribute, please make an issue{' '}
                  <a 
                    href="https://github.com/SteelyNinja/nodeset-dashboard-v2" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors duration-200"
                  >
                    here
                  </a>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />


      {/* Main Content */}
      <main className="flex-1 main-content">
        {backendConnected === false ? (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icon name="warning" size="lg" color="danger" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Backend Connection Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Cannot connect to the FastAPI backend. Please ensure:</p>
                    <ul className="mt-1 list-disc list-inside">
                      <li>The backend server is running on port 8000</li>
                      <li>Run: <code className="bg-red-100 px-1 rounded">cd backend && ./start_server.sh</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderActiveTab()
        )}
      </main>
    </div>
  );
}

// Main App component with analytics route handling
function AppWithAnalytics() {
  // Check for hidden analytics route
  if (window.location.pathname === '/analytics') {
    return <AnalyticsPage />;
  }
  
  // Check for hidden theoretical performance route
  if (window.location.pathname === '/theoretical') {
    return <TheoreticalPerformancePage />;
  }
  
  return <App />;
}

export default AppWithAnalytics;
