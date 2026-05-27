import React from 'react';

interface ProblemNumberDisplayProps {
  problemNumber: string | null;
  id?: number;
}

export const ProblemNumberDisplay: React.FC<ProblemNumberDisplayProps> = ({ problemNumber, id }) => {
  const display = problemNumber ?? (id ? `CA-00-00-${String(id).padStart(5, '0')}` : '—');

  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: '0.8125rem',
      fontWeight: 600,
      color: 'var(--color-text-primary)',
      letterSpacing: '0.03em',
    }}>
      {display}
    </span>
  );
};