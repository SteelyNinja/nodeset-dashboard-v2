// Professional Icon Component System with Heroicons
import React from 'react';
import {
  // Navigation & Dashboard Icons
  HomeIcon,
  ChartBarIcon,
  ChartPieIcon,
  UsersIcon,
  BoltIcon,
  HandRaisedIcon,
  RadioIcon,
  ArrowRightOnRectangleIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  FireIcon,
  
  // Data & Analytics Icons  
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PresentationChartLineIcon,
  ChartBarSquareIcon,
  
  // Actions & Controls
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ArrowPathIcon,
  
  // Status & Indicators
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  SignalIcon,
  
  // UI & Interface
  EyeIcon,
  EyeSlashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  
  // Data Types
  CubeIcon,
  ServerIcon,
  ComputerDesktopIcon,
  CloudIcon,
  
  // Professional Business Icons
  BuildingOfficeIcon,
  CreditCardIcon,
  BanknotesIcon,
  ScaleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

// Solid versions for emphasis
import {
  TrophyIcon as TrophySolid,
  StarIcon as StarSolid,
  FireIcon as FireSolid,
  BoltIcon as BoltSolid
} from '@heroicons/react/24/solid';

// Icon mapping for easy reference
export const IconMap = {
  // Dashboard Navigation
  dashboard: HomeIcon,
  distribution: ChartBarIcon,
  concentration: ChartPieIcon,
  operators: UsersIcon,
  performance: BoltIcon,
  proposals: HandRaisedIcon,
  syncCommittee: RadioIcon,
  exitAnalysis: ArrowRightOnRectangleIcon,
  costs: CurrencyDollarIcon,
  clientDiversity: WrenchScrewdriverIcon,
  gasAnalysis: FireIcon,
  
  // Data Analytics
  trendingUp: ArrowTrendingUpIcon,
  trendingDown: ArrowTrendingDownIcon,
  analytics: PresentationChartLineIcon,
  chart: ChartBarSquareIcon,
  metrics: ChartBarIcon,
  
  // Actions
  download: ArrowDownTrayIcon,
  export: DocumentArrowDownIcon,
  search: MagnifyingGlassIcon,
  filter: FunnelIcon,
  settings: AdjustmentsHorizontalIcon,
  refresh: ArrowPathIcon,
  
  // Status
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
  signal: SignalIcon,
  
  // UI Controls
  show: EyeIcon,
  hide: EyeSlashIcon,
  up: ChevronUpIcon,
  down: ChevronDownIcon,
  left: ChevronLeftIcon,
  right: ChevronRightIcon,
  
  // Infrastructure
  server: ServerIcon,
  computer: ComputerDesktopIcon,
  cloud: CloudIcon,
  cube: CubeIcon,
  
  // Business & Finance
  building: BuildingOfficeIcon,
  creditCard: CreditCardIcon,
  money: BanknotesIcon,
  scale: ScaleIcon,
  shield: ShieldCheckIcon,
  
  // Special Emphasis (Solid)
  trophy: TrophySolid,
  star: StarSolid,
  fireSolid: FireSolid,
  boltSolid: BoltSolid,
} as const;

export type IconName = keyof typeof IconMap;

interface IconProps {
  name: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'outline' | 'solid';
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral' | 'current';
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  variant = 'outline',
  className = '',
  color = 'current'
}) => {
  // Size mapping for professional scaling
  const sizeClasses = {
    xs: 'w-3 h-3',      // 12px - Small labels
    sm: 'w-4 h-4',      // 16px - Inline text
    md: 'w-5 h-5',      // 20px - Standard
    lg: 'w-6 h-6',      // 24px - Section headers
    xl: 'w-8 h-8',      // 32px - Page headers
    '2xl': 'w-10 h-10'  // 40px - Hero elements
  };

  // Professional color palette
  const colorClasses = {
    primary: 'text-primary-600 dark:text-primary-400',
    secondary: 'text-secondary-600 dark:text-secondary-400', 
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
    neutral: 'text-neutral-600 dark:text-neutral-400',
    current: 'text-current'
  };

  const IconComponent = IconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in IconMap`);
    return null;
  }

  const combinedClassName = `
    ${sizeClasses[size]}
    ${colorClasses[color]}
    ${className}
    flex-shrink-0
    transition-colors duration-200
  `.trim();

  return <IconComponent className={combinedClassName} />;
};

export default Icon;

// Convenience exports for common combinations
export const DashboardIcon = (props: Omit<IconProps, 'name'>) => <Icon name="dashboard" {...props} />;
export const DownloadIcon = (props: Omit<IconProps, 'name'>) => <Icon name="download" {...props} />;
export const TrophyIcon = (props: Omit<IconProps, 'name'>) => <Icon name="trophy" {...props} />;
export const PerformanceIcon = (props: Omit<IconProps, 'name'>) => <Icon name="performance" {...props} />;
export const AnalyticsIcon = (props: Omit<IconProps, 'name'>) => <Icon name="analytics" {...props} />;