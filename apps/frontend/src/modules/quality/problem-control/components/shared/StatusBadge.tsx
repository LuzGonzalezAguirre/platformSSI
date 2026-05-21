// apps/frontend/src/features/quality/problem-control/components/shared/StatusBadge.tsx
import React from 'react';
import type { ProblemStatus } from '../../types/problem.types';

interface StatusBadgeProps {
  status: ProblemStatus;
  display?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, display }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {display || status}
    </span>
  );
};