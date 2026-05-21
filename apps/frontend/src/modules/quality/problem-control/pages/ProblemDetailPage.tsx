// apps/frontend/src/modules/quality/problem-control/pages/ProblemDetailPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblemDetail } from '../hooks/useProblemDetail';

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: problem, isLoading } = useProblemDetail(Number(id));

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!problem) {
    return <div className="p-8">Problem not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <button
          onClick={() => navigate('/quality/problems')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to List
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">
          {problem.problem_number || `Draft #${problem.id}`}
        </h1>
        <p className="text-gray-600">{problem.brief_description}</p>
        <p className="text-sm text-gray-500 mt-2">
          Status: {problem.status_display}
        </p>
        
        <div className="mt-4">
          <button
            onClick={() => navigate(`/quality/problems/${id}/edit`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Problem
          </button>
        </div>
      </div>
    </div>
  );
};