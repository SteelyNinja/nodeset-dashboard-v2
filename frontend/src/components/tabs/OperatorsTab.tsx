import React, { useState, useEffect } from 'react';
import { ConcentrationMetrics } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassButton from '../common/GlassButton';
import { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell } from '../common/GlassTable';

interface OperatorData {
  rank: number;
  address: string;
  ens_name: string;
  active: number;
  total: number;
  exited: number;
  exit_rate: number;
  market_share: number;
}

const OperatorsTab: React.FC = () => {
  const [, setConcentrationMetrics] = useState<ConcentrationMetrics | null>(null);
  const [operatorData, setOperatorData] = useState<OperatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [concentrationData, validatorData] = await Promise.all([
        apiService.getConcentrationMetrics(),
        apiService.getValidatorData()
      ]);
      
      setConcentrationMetrics(concentrationData);
      
      // Process validator data to match original table structure
      const operatorValidators = validatorData.operator_validators || {};
      const ensNames = validatorData.ens_names || {};
      const totalActiveValidators = Object.values(operatorValidators).reduce((sum: number, count) => sum + count, 0);
      
      const operators = Object.entries(operatorValidators)
        .map(([address, totalCount], index) => {
          // For now, assume no exits (since we don't have exit data)
          const exitedCount = 0;
          const activeCount = totalCount;
          const exitRate = 0;
          const marketShare = (activeCount / totalActiveValidators) * 100;
          
          return {
            rank: 0, // Will be set after sorting
            address: address,
            ens_name: ensNames[address] || '', // Look up ENS name from validator data
            active: activeCount,
            total: totalCount,
            exited: exitedCount,
            exit_rate: exitRate,
            market_share: marketShare
          } as OperatorData;
        })
        .sort((a, b) => b.active - a.active)
        .map((operator, index) => ({
          ...operator,
          rank: index + 1
        }));
      
      setOperatorData(operators);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch operator data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" className="py-8" />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} className="m-4" />;
  }

  const downloadCSV = () => {
    const headers = ['Rank', 'Address', 'ENS / Discord Name', 'Active', 'Total', 'Exited', 'Exit Rate', 'Market Share'];
    const csvContent = [
      headers.join(','),
      ...operatorData.map(op => [
        op.rank,
        op.address,
        op.ens_name,
        op.active,
        op.total,
        op.exited,
        `${op.exit_rate.toFixed(1)}%`,
        `${op.market_share.toFixed(2)}%`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `nodeset_operators_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filter operators based on search term
  const filteredOperators = operatorData.filter(operator => 
    operator.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (operator.ens_name && operator.ens_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🏆 Top Operators by Active Validators
        </h1>
      </div>

      {operatorData.length > 0 && (
        <div className="space-y-4">
          {/* Header with download button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Operators ({operatorData.length})
              {searchTerm && (
                <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
                  • Showing {filteredOperators.length} results
                </span>
              )}
            </h2>
            <GlassButton onClick={downloadCSV} variant="primary" size="sm">
              💾 Download CSV
            </GlassButton>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search by operator address or ENS name"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Glass Table with fixed height and scroll */}
          <div style={{ maxHeight: '600px', overflow: 'auto' }}>
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableCell header>Rank</GlassTableCell>
                  <GlassTableCell header>Address</GlassTableCell>
                  <GlassTableCell header>ENS / Discord Name</GlassTableCell>
                  <GlassTableCell header>Active</GlassTableCell>
                  <GlassTableCell header>Total</GlassTableCell>
                  <GlassTableCell header>Exited</GlassTableCell>
                  <GlassTableCell header>Exit Rate</GlassTableCell>
                  <GlassTableCell header>Market Share</GlassTableCell>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((operator) => (
                    <GlassTableRow key={operator.address}>
                      <GlassTableCell className="font-medium">
                        {operator.rank}
                      </GlassTableCell>
                      <GlassTableCell className="font-mono text-xs">
                        {operator.address}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.ens_name || '-'}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.active}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.total}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.exited}
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.exit_rate.toFixed(1)}%
                      </GlassTableCell>
                      <GlassTableCell>
                        {operator.market_share.toFixed(2)}%
                      </GlassTableCell>
                    </GlassTableRow>
                  ))
                ) : (
                  <GlassTableRow>
                    <GlassTableCell colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No operators found matching "{searchTerm}"
                    </GlassTableCell>
                  </GlassTableRow>
                )}
              </GlassTableBody>
            </GlassTable>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorsTab;