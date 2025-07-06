import React from 'react';

interface GlassTableProps {
  children: React.ReactNode;
  className?: string;
}

interface GlassTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface GlassTableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface GlassTableRowProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

interface GlassTableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: boolean;
  colSpan?: number;
}

const GlassTable: React.FC<GlassTableProps> = ({ children, className = '' }) => {
  return (
    <div className={`
      relative overflow-hidden
      bg-glass-light dark:bg-glass-dark 
      backdrop-blur-glass dark:backdrop-blur-glass-dark dark:backdrop-saturate-140
      border border-gray-200 dark:border-white/15
      rounded-2xl 
      shadow-glass-light dark:shadow-glass-dark
      ${className}
    `}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </div>
  );
};

const GlassTableHeader: React.FC<GlassTableHeaderProps> = ({ children, className = '' }) => {
  return (
    <thead className={`
      bg-primary-500/15 dark:bg-primary-400/15
      ${className}
    `}>
      {children}
    </thead>
  );
};

const GlassTableBody: React.FC<GlassTableBodyProps> = ({ children, className = '' }) => {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  );
};

const GlassTableRow: React.FC<GlassTableRowProps> = ({ 
  children, 
  className = '', 
  hoverable = false 
}) => {
  return (
    <tr className={`
      border-b border-gray-300/80 dark:border-white/25
      ${hoverable ? 'hover:bg-white/30 dark:hover:bg-white/5 transition-colors duration-200' : ''}
      ${className}
    `}>
      {children}
    </tr>
  );
};

const GlassTableCell: React.FC<GlassTableCellProps> = ({ 
  children, 
  className = '', 
  header = false,
  colSpan 
}) => {
  const Component = header ? 'th' : 'td';
  
  return (
    <Component 
      className={`
        p-3 text-left border-r border-gray-300/80 dark:border-white/25 last:border-r-0
        ${header 
          ? 'font-semibold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wider border-b border-gray-300/30 dark:border-white/20' 
          : 'text-gray-700 dark:text-gray-300'
        }
        ${className}
      `}
      colSpan={colSpan}
    >
      {children}
    </Component>
  );
};

// Export all components
export { GlassTable, GlassTableHeader, GlassTableBody, GlassTableRow, GlassTableCell };
export default GlassTable;