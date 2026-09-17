import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useProblemDetail } from '../hooks/useProblemDetail';
import { ProblemDetailPage } from './ProblemDetailPage';

export const ProblemEntryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = Number(id);
  const { data: problem, isLoading } = useProblemDetail(problemId);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>
        Loading problem...
      </div>
    );
  }

  if (problem?.status === 'pending_approval') {
    return <Navigate to={`/quality/problems/${problemId}/approval`} replace />;
  }

  return <ProblemDetailPage />;
};
