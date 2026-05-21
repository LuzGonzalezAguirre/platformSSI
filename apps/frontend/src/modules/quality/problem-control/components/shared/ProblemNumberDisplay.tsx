// apps/frontend/src/features/quality/problem-control/components/shared/ProblemNumberDisplay.tsx
import React from 'react';

interface ProblemNumberDisplayProps {
  problemNumber: string | null;
  id?: number;
}

export const ProblemNumberDisplay: React.FC<ProblemNumberDisplayProps> = ({ problemNumber, id }) => {
  if (problemNumber) {
    return (
      <span className="font-mono text-sm font-semibold text-gray-900">
        {problemNumber}
      </span>
    );
  }

  return (
    <span className="text-sm text-gray-500 italic">
      Draft {id ? `#${id}` : ''}
    </span>
  );
};