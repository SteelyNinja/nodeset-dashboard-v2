import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConcentrationMetrics } from '../../types/api';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import GlassButton from '../common/GlassButton';
import Icon from '../common/Icon';

interface OperatorData {
  rank: number;
  address: string;
  ens_name: string;
  active: number;
  total: number;
  exited: number;
  exit_rate: number;
  market_share: number;
  performance_7d: number;
}

const OperatorsTab: React.FC = () => {
  const navigate = useNavigate();
  const [, setConcentrationMetrics] = useState<ConcentrationMetrics | null>(null);
  const [operatorData, setOperatorData] = useState<OperatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [concentrationData, topOperatorsData, validatorData, operatorSummary] = await Promise.all([
        apiService.getConcentrationMetrics(),
        apiService.getTopOperators(1000), // Get all operators
        apiService.getValidatorData(), // Get validator data for ENS names
        apiService.getOperatorsSummary(7) // Get 7-day performance data for ranking
      ]);
      
      setConcentrationMetrics(concentrationData);
      
      // Process operators data and add 7-day performance ranking
      const operators = topOperatorsData.operators.map((op: any) => ({
        rank: op.rank,
        address: op.full_address,
        ens_name: validatorData.ens_names?.[op.full_address] || '', // Get ENS name from validator data
        active: op.active_count,
        total: op.validator_count,
        exited: op.exited_count,
        exit_rate: op.exit_rate,
        market_share: op.percentage,
        performance_7d: operatorSummary[op.full_address]?.avg_attestation_performance || 0
      })) as OperatorData[];

      // Sort by 7-day performance (highest first), then by active validators as tiebreaker
      operators.sort((a, b) => {
        if (b.performance_7d !== a.performance_7d) {
          return b.performance_7d - a.performance_7d; // Primary sort: 7-day performance descending
        }
        return b.active - a.active; // Secondary sort: active validators descending
      });

      // Recalculate ranks based on performance ranking
      operators.forEach((op, index) => {
        op.rank = index + 1;
      });
      
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
    const headers = ['Rank', 'Address', 'ENS / Discord Name', '7-Day Performance', 'Active', 'Total', 'Exited', 'Exit Rate', 'Market Share'];
    const csvContent = [
      headers.join(','),
      ...operatorData.map(op => [
        op.rank,
        op.address,
        op.ens_name,
        `${op.performance_7d.toFixed(4)}%`,
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
        <h1 className="text-headline-large font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-3">
          <Icon name="trophy" size="lg" color="primary" />
          Operator Ranking - 7 Day
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
            <GlassButton onClick={downloadCSV} variant="primary" size="sm" className="flex items-center gap-2">
              <Icon name="download" size="sm" color="current" />
              Download CSV
            </GlassButton>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by operator address or ENS name"
              className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/20 dark:bg-white/10 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Glass Table with sticky header */}
          <div className="bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/15">
              <div className="grid px-4 py-4 font-semibold text-neutral-900 dark:text-neutral-100 text-body-medium" style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.3fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.3fr", gap: "12px"}}>
                <div>Rank</div>
                <div>Address</div>
                <div>ENS / Discord Name</div>
                <div>7-Day Performance</div>
                <div>Active</div>
                <div>Total</div>
                <div>Exited</div>
                <div>Exit Rate</div>
                <div>Market Share</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Scrollable Body */}
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <div className="divide-y divide-white/5 dark:divide-white/10">
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((operator, index) => (
                    <div 
                      key={operator.address}
                      className={`grid px-4 py-3 hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm transition-all duration-200 ease-in-out border-b border-white/5 dark:border-white/10 last:border-b-0 text-neutral-800 dark:text-neutral-200 text-body-medium ${
                        index % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/15' : 'bg-transparent'
                      }`}
                      style={{gridTemplateColumns: "0.7fr 2.8fr 2fr 1.3fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.3fr", gap: "12px"}}
                    >
                      <div className="font-medium">
                        {operator.rank}
                      </div>
                      <div className="font-mono text-xs">
                        {operator.address}
                      </div>
                      <div>
                        {operator.ens_name || '-'}
                      </div>
                      <div className="font-medium">
                        {operator.performance_7d ? `${operator.performance_7d.toFixed(4)}%` : '-'}
                      </div>
                      <div>
                        {operator.active}
                      </div>
                      <div>
                        {operator.total}
                      </div>
                      <div>
                        {operator.exited}
                      </div>
                      <div>
                        {operator.exit_rate.toFixed(1)}%
                      </div>
                      <div>
                        {operator.market_share.toFixed(2)}%
                      </div>
                      <div>
                        <GlassButton
                          onClick={() => navigate(`/operator/${operator.address}`)}
                          variant="primary"
                          size="xs"
                          className="flex items-center gap-1"
                        >
                          <Icon name="chart" size="xs" />
                          Dashboard
                        </GlassButton>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No operators found matching "{searchTerm}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorsTab;