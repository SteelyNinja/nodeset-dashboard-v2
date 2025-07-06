// Updated Exit Analysis Tab with sync committee styling
import React, { useState, useEffect } from 'react';
import { ExitData } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassCard from '../common/GlassCard';
import GlassButton from '../common/GlassButton';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';

const ExitAnalysisTab: React.FC = () => {
  const [exitData, setExitData] = useState<ExitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatorSearchTerm, setOperatorSearchTerm] = useState('');
  const [exitSearchTerm, setExitSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch both original exit data (for summary and operators) and all exit records
        const [originalData, allExitRecords] = await Promise.all([
          apiService.getExitData(),
          apiService.getAllExitRecords()
        ]);
        
        // Merge the data: use original for summary/operators, but replace recent_exits with all records
        const mergedData = {
          ...originalData,
          recent_exits: allExitRecords.recent_exits || originalData.recent_exits
        };
        
        setExitData(mergedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exit data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getFilteredOperatorData = () => {
    if (!exitData?.operators_with_exits) return [];
    
    if (!operatorSearchTerm) return exitData.operators_with_exits;
    
    const lowerSearchTerm = operatorSearchTerm.toLowerCase();
    return exitData.operators_with_exits.filter(operator => 
      operator.operator.toLowerCase().includes(lowerSearchTerm) ||
      operator.operator_name.toLowerCase().includes(lowerSearchTerm)
    );
  };

  const getFilteredExitData = () => {
    if (!exitData?.recent_exits) return [];
    
    if (!exitSearchTerm) return exitData.recent_exits;
    
    const lowerSearchTerm = exitSearchTerm.toLowerCase();
    return exitData.recent_exits.filter(exit => 
      exit.operator.toLowerCase().includes(lowerSearchTerm) ||
      exit.operator_name.toLowerCase().includes(lowerSearchTerm) ||
      exit.validator_index.toString().includes(lowerSearchTerm)
    );
  };

  const downloadCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatBalance = (balanceGwei: number | null): string => {
    if (balanceGwei === null) return 'N/A';
    return `${(balanceGwei / 1e9).toFixed(4)} ETH`;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!exitData) return <ErrorMessage message="No exit data available" />;

  const filteredOperatorData = getFilteredOperatorData();
  const filteredExitData = getFilteredExitData();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🚪 Exit Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Validator exit patterns and analysis
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard>
            <div className="text-sm font-medium text-gray-500 mb-1">Total Exits</div>
            <div className="text-2xl font-bold text-black dark:text-white">{exitData.exit_summary.total_exited.toLocaleString()}</div>
            <div className="text-xs text-gray-400">Validators that have exited</div>
          </GlassCard>
          <GlassCard>
            <div className="text-sm font-medium text-gray-500 mb-1">Still Active</div>
            <div className="text-2xl font-bold text-black dark:text-white">{exitData.exit_summary.total_active.toLocaleString()}</div>
            <div className="text-xs text-gray-400">Currently active validators</div>
          </GlassCard>
          <GlassCard>
            <div className="text-sm font-medium text-gray-500 mb-1">Exit Rate</div>
            <div className="text-2xl font-bold text-black dark:text-white">{exitData.exit_summary.exit_rate_percent.toFixed(2)}%</div>
            <div className="text-xs text-gray-400">Percentage of validators exited</div>
          </GlassCard>
          <GlassCard>
            <div className="text-sm font-medium text-gray-500 mb-1">Last Updated</div>
            <div className="text-2xl font-bold text-black dark:text-white">{formatDate(exitData.exit_summary.last_updated).split(',')[0]}</div>
            <div className="text-xs text-gray-400">Data last refreshed</div>
          </GlassCard>
        </div>

        {/* Operator Rankings Section */}
        <GlassCard size="large" hoverable={false}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🏆 Operators with Exits</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Operators that have validator exits</p>
            </div>
            <GlassButton
              onClick={() => downloadCSV(filteredOperatorData, `operators_with_exits_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`)}
              variant="primary"
              size="sm"
            >
              📥 Download CSV
            </GlassButton>
          </div>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search operators by address or ENS name"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={operatorSearchTerm}
              onChange={(e) => setOperatorSearchTerm(e.target.value)}
            />
            {operatorSearchTerm && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Showing {filteredOperatorData.length} operators matching '{operatorSearchTerm}'
              </p>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              <GlassTable>
                <GlassTableHeader>
                  <GlassTableRow>
                    <GlassTableCell>Address</GlassTableCell>
                    <GlassTableCell>ENS / Discord Name</GlassTableCell>
                    <GlassTableCell>Exits</GlassTableCell>
                    <GlassTableCell>Still Active</GlassTableCell>
                    <GlassTableCell>Total Ever</GlassTableCell>
                    <GlassTableCell>Exit Rate</GlassTableCell>
                    <GlassTableCell>Latest Exit</GlassTableCell>
                  </GlassTableRow>
                </GlassTableHeader>
                <GlassTableBody>
                  {filteredOperatorData.map((operator, index) => (
                    <GlassTableRow key={index}>
                      <GlassTableCell className="font-mono text-xs">{operator.operator}</GlassTableCell>
                      <GlassTableCell>{operator.operator_name || '-'}</GlassTableCell>
                      <GlassTableCell className="text-red-600 font-medium">{operator.exits}</GlassTableCell>
                      <GlassTableCell className="text-green-600">{operator.still_active}</GlassTableCell>
                      <GlassTableCell className="font-medium">{operator.total_ever}</GlassTableCell>
                      <GlassTableCell className="text-orange-600">{operator.exit_rate.toFixed(2)}%</GlassTableCell>
                      <GlassTableCell>{operator.latest_exit_date}</GlassTableCell>
                    </GlassTableRow>
                  ))}
                </GlassTableBody>
              </GlassTable>
            </div>
          </div>
        </GlassCard>

        {/* Validator Exits Section */}
        <GlassCard size="large" hoverable={false}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🔍 Validator Exits</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">All validator exits with detailed information</p>
            </div>
            <GlassButton
              onClick={() => downloadCSV(filteredExitData, `validator_exits_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`)}
              variant="primary"
              size="sm"
            >
              📥 Download CSV
            </GlassButton>
          </div>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search exits by operator, name, or validator index"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={exitSearchTerm}
              onChange={(e) => setExitSearchTerm(e.target.value)}
            />
            {exitSearchTerm && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Showing {filteredExitData.length} exits matching '{exitSearchTerm}'
              </p>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              <GlassTable>
                <GlassTableHeader>
                  <GlassTableRow>
                    <GlassTableCell>Validator Index</GlassTableCell>
                    <GlassTableCell>Operator</GlassTableCell>
                    <GlassTableCell>Name</GlassTableCell>
                    <GlassTableCell>Exit Date</GlassTableCell>
                    <GlassTableCell>Status</GlassTableCell>
                    <GlassTableCell>Slashed</GlassTableCell>
                    <GlassTableCell>Exit Epoch</GlassTableCell>
                  </GlassTableRow>
                </GlassTableHeader>
                <GlassTableBody>
                  {filteredExitData.map((exit, index) => (
                    <GlassTableRow key={index}>
                      <GlassTableCell className="font-medium">{exit.validator_index}</GlassTableCell>
                      <GlassTableCell className="font-mono text-xs">{exit.operator}</GlassTableCell>
                      <GlassTableCell>{exit.operator_name}</GlassTableCell>
                      <GlassTableCell>{exit.exit_date}</GlassTableCell>
                      <GlassTableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          exit.status === 'exited' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {exit.status}
                        </span>
                      </GlassTableCell>
                      <GlassTableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          exit.slashed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {exit.slashed ? 'Yes' : 'No'}
                        </span>
                      </GlassTableCell>
                      <GlassTableCell>{exit.exit_epoch}</GlassTableCell>
                    </GlassTableRow>
                  ))}
                </GlassTableBody>
              </GlassTable>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ExitAnalysisTab;