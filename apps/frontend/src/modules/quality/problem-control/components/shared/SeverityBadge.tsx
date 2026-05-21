// apps/frontend/src/features/quality/problem-control/components/shared/SeverityBadge.tsx
import React from 'react';

interface SeverityBadgeProps {
  level: number;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ level }) => {
  const getSeverityColor = () => {
    if (level >= 8) return 'bg-red-600 text-white';
    if (level >= 6) return 'bg-orange-500 text-white';
    if (level >= 4) return 'bg-yellow-500 text-white';
    if (level >= 2) return 'bg-blue-500 text-white';
    return 'bg-green-500 text-white';
  };

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getSeverityColor()}`}>
      {level}
    </span>
  );
};