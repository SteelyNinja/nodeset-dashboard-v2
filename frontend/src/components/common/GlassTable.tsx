// Enhanced GlassTable with sorting, filtering, and selection states
import React, { useState, useMemo } from 'react';
import GlassButton from './GlassButton';
import Icon from './Icon';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  [key: string]: string;
}

interface GlassTableProps {
  data: any[];
  columns: Column[];
  className?: string;
  selectable?: boolean;
  density?: 'compact' | 'comfortable' | 'spacious';
  searchable?: boolean;
  exportable?: boolean;
  onRowClick?: (row: any) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  loading?: boolean;
  pageSize?: number;
  elevation?: 'flat' | 'raised' | 'elevated';
}

const GlassTable: React.FC<GlassTableProps> = ({
  data,
  columns,
  className = '',
  selectable = false,
  density = 'comfortable',
  searchable = false,
  exportable = false,
  onRowClick,
  onSelectionChange,
  loading = false,
  pageSize = 50,
  elevation = 'raised'
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [globalSearch, setGlobalSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Density styles
  const densityStyles = {
    compact: 'text-label-small',
    comfortable: 'text-body-medium',
    spacious: 'text-body-large'
  };

  const cellPadding = {
    compact: 'px-3 py-1.5',
    comfortable: 'px-4 py-3',
    spacious: 'px-6 py-4'
  };

  // Elevation styles
  const elevationStyles = {
    flat: 'border-white/5 dark:border-white/10',
    raised: 'border-white/10 dark:border-white/15 shadow-sm',
    elevated: 'border-white/15 dark:border-white/20 shadow-md'
  };

  // Sorting function
  const handleSort = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;

    setSortConfig(current => {
      if (current?.key === key && current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Filter function
  const handleFilter = (key: string, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: value
    }));
    setCurrentPage(1);
  };

  // Selection functions
  const handleRowSelect = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
    
    if (onSelectionChange) {
      const selectedData = filteredAndSortedData.filter((_, idx) => newSelected.has(idx));
      onSelectionChange(selectedData);
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSortedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIndices = new Set(filteredAndSortedData.map((_, index) => index));
      setSelectedRows(allIndices);
      onSelectionChange?.(filteredAndSortedData);
    }
  };

  // Data processing
  const filteredAndSortedData = useMemo(() => {
    let processed = [...data];

    // Apply global search
    if (globalSearch) {
      processed = processed.filter(row =>
        columns.some(column =>
          String(row[column.key]).toLowerCase().includes(globalSearch.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        processed = processed.filter(row =>
          String(row[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortConfig) {
      processed.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return processed;
  }, [data, globalSearch, filters, sortConfig, columns]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export function
  const handleExport = () => {
    const headers = columns.map(col => col.label);
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row =>
        columns.map(col => `"${row[col.key] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) {
      return <span className="text-neutral-400 dark:text-neutral-600">↕</span>;
    }
    return (
      <span className="text-primary-500">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Table controls */}
      {(searchable || exportable || selectable) && (
        <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-white/5 dark:bg-white/2 rounded-lg border border-white/10 dark:border-white/5">
          {searchable && (
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search across all columns..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/15 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
              />
            </div>
          )}
          
          <div className="flex gap-2">
            {exportable && (
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={handleExport}
                icon={<Icon name="download" size="sm" color="current" />}
              >
                Export CSV
              </GlassButton>
            )}
            
            {selectable && selectedRows.size > 0 && (
              <div className="flex items-center gap-2 text-body-small text-neutral-600 dark:text-neutral-400">
                <span>{selectedRows.size} selected</span>
                <GlassButton
                  variant="tertiary"
                  size="xs"
                  onClick={() => {
                    setSelectedRows(new Set());
                    onSelectionChange?.([]);
                  }}
                >
                  Clear
                </GlassButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table container */}
      <div className={`overflow-x-auto bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border ${elevationStyles[elevation]}`}>
        <table className="w-full">
          {/* Table header */}
          <thead className="bg-white/10 dark:bg-white/5 border-b border-white/10 dark:border-white/15">
            <tr>
              {selectable && (
                <th className={`${cellPadding[density]} text-left`}>
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-white/20 dark:border-white/15 bg-white/10 dark:bg-white/5 text-primary-500 focus:ring-primary-500/50"
                  />
                </th>
              )}
              
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${cellPadding[density]} text-left ${densityStyles[density]} font-semibold text-neutral-800 dark:text-neutral-200 ${column.width || ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="hover:text-primary-500 transition-colors"
                      >
                        <SortIcon column={column.key} />
                      </button>
                    )}
                  </div>
                  
                  {/* Column filter */}
                  {column.filterable && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder={`Filter ${column.label.toLowerCase()}...`}
                        value={filters[column.key] || ''}
                        onChange={(e) => handleFilter(column.key, e.target.value)}
                        className="w-full px-2 py-1 text-label-small bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/15 rounded text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body */}
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className={`${cellPadding[density]} text-center text-neutral-500 dark:text-neutral-400`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className={`${cellPadding[density]} text-center text-neutral-500 dark:text-neutral-400`}
                >
                  No data found
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={`
                    border-b border-white/5 dark:border-white/10 last:border-b-0
                    ${index % 2 === 0 ? 'bg-white/2 dark:bg-white/1' : 'bg-transparent'}
                    hover:bg-white/10 dark:hover:bg-white/5 transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${selectedRows.has(index) ? 'bg-primary-500/10 dark:bg-primary-500/5' : ''}
                  `}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className={cellPadding[density]}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRowSelect(index);
                        }}
                        className="rounded border-white/20 dark:border-white/15 bg-white/10 dark:bg-white/5 text-primary-500 focus:ring-primary-500/50"
                      />
                    </td>
                  )}
                  
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${cellPadding[density]} ${densityStyles[density]} text-neutral-800 dark:text-neutral-200`}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 p-4 bg-white/5 dark:bg-white/2 rounded-lg border border-white/10 dark:border-white/5">
          <div className="text-body-small text-neutral-600 dark:text-neutral-400">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
          </div>
          
          <div className="flex gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(current => Math.max(1, current - 1))}
            >
              Previous
            </GlassButton>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                if (pageNum > totalPages) return null;
                
                return (
                  <GlassButton
                    key={pageNum}
                    variant={pageNum === currentPage ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </GlassButton>
                );
              })}
            </div>
            
            <GlassButton
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(current => Math.min(totalPages, current + 1))}
            >
              Next
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
};

// Legacy table components for backward compatibility
export const GlassTableContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`overflow-x-auto bg-white/5 dark:bg-white/2 backdrop-blur-sm rounded-xl border border-white/10 dark:border-white/15 shadow-sm ${className}`}>
    <table className="w-full">
      {children}
    </table>
  </div>
);

export const GlassTableHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <thead className={`bg-white/10 dark:bg-white/5 border-b border-white/10 dark:border-white/15 ${className}`}>{children}</thead>
);

export const GlassTableBody: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  zebraStripes?: boolean;
}> = ({ children, className = '', zebraStripes = true }) => {
  // Enhanced table body with zebra striping class
  const zebraClass = zebraStripes ? 'glass-table-zebra' : '';
  
  return (
    <tbody className={`${className} ${zebraClass}`.trim()}>
      {children}
    </tbody>
  );
};

export const GlassTableRow: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  hoverable?: boolean;
  onClick?: () => void;
}> = ({ children, className = '', hoverable = true, onClick }) => (
  <tr 
    className={`
      border-b border-white/5 dark:border-white/10 last:border-b-0
      ${hoverable ? 'hover:bg-primary-500/8 dark:hover:bg-primary-500/5 hover:shadow-sm' : ''}
      transition-all duration-200 ease-in-out
      ${onClick ? 'cursor-pointer' : ''} 
      ${className}
    `}
    onClick={onClick}
  >
    {children}
  </tr>
);

export const GlassTableCell: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
}> = ({ children, className = '', header = false, colSpan, rowSpan }) => {
  const Component = header ? 'th' : 'td';
  return (
    <Component 
      className={`
        ${header ? 'px-4 py-4' : 'px-4 py-3'}
        text-body-medium
        ${header 
          ? 'font-semibold text-neutral-900 dark:text-neutral-100 bg-white/5 dark:bg-white/3' 
          : 'text-neutral-800 dark:text-neutral-200'
        }
        ${className}
      `}
      colSpan={colSpan}
      rowSpan={rowSpan}
    >
      {children}
    </Component>
  );
};

// Legacy GlassTable component for backward compatibility
export const LegacyGlassTable: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <GlassTableContainer className={className}>
    {children}
  </GlassTableContainer>
);

// Export the enhanced version as named export
export { GlassTable as EnhancedGlassTable };

// Export legacy version for backward compatibility
export { LegacyGlassTable as GlassTable };
export default LegacyGlassTable;