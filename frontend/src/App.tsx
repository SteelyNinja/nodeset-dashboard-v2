import React, { useState, useEffect } from 'react';
import { TabId } from './types/api';
import { apiService } from './services/api';
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

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('information');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBackend = async () => {
      const connected = await apiService.checkBackendConnection();
      setBackendConnected(connected);
    };
    
    checkBackend();
  }, []);

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
      default:
        return <InformationTab />;
    }
  };

  return (
    <div className="min-h-screen bg-original-light dark:bg-original-dark">
      {/* Header */}
      <header className="bg-white/20 dark:bg-gray-800/30 backdrop-blur-glass border-b border-gray-200/50 dark:border-white/15 shadow-glass">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              {/* NodeSet Logo - positioned to the left like original */}
              <div className="flex-shrink-0">
                <img 
                  src="/Nodeset_light_mode.png" 
                  alt="NodeSet Protocol" 
                  className="h-24 w-auto dark:hidden"
                />
                <img 
                  src="/Nodeset_dark_mode.png" 
                  alt="NodeSet Protocol" 
                  className="h-24 w-auto hidden dark:block"
                />
              </div>
              
              {/* Banner Text - Centered */}
              <div className="flex items-center flex-1 ml-4">
                {/* Main Banner Text Card - Centered with more space */}
                <div className="flex-1">
                  <div className="flex justify-center">
                    <div className="
                      bg-glass-light dark:bg-glass-dark 
                      backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                      border border-gray-200 dark:border-white/15
                      rounded-xl 
                      shadow-glass-light dark:shadow-glass-dark
                      p-4
                      max-w-3xl
                    ">
                      <div className="flex items-start space-x-3">
                        <span className="text-blue-500 text-2xl flex-shrink-0">📊</span>
                        <div className="text-gray-900 dark:text-white text-center">
                          <div className="text-xl font-bold leading-relaxed">
                            <strong>Monitoring and analysis</strong> of NodeSet protocol validators on Stakewise
                          </div>
                          <div className="text-base text-gray-600 dark:text-gray-400 mt-1 opacity-90">
                            Data cache updated every 15 minutes
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 flex-shrink-0">
              {/* Disclaimer Card - Far Right */}
              <div className="
                bg-glass-light dark:bg-glass-dark 
                backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
                border border-gray-200 dark:border-white/15
                rounded-xl 
                shadow-glass-light dark:shadow-glass-dark
                p-4
                max-w-sm
              ">
                <div className="text-gray-700 dark:text-gray-300">
                  <div className="text-base font-medium mb-2">
                    Disclaimer
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    This site is independently maintained through an open source project. If you see any discrepancies or wish to contribute, please make an issue here.
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {backendConnected === null ? 'Checking...' : backendConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <main className="flex-1 main-content">
        {backendConnected === false ? (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400 text-xl">⚠️</span>
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

export default App;
