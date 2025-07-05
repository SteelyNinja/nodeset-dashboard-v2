import React from 'react';

interface TabLayoutProps {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}

const TabLayout: React.FC<TabLayoutProps> = ({ title, subtitle, icon, children }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {icon} {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
};

export default TabLayout;