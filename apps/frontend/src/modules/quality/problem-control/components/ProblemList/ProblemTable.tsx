// apps/frontend/src/features/quality/problem-control/components/ProblemList/ProblemTable.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProblemListItem } from '../../types/problem.types';
import { StatusBadge } from '../shared/StatusBadge';
import { SeverityBadge } from '../shared/SeverityBadge';
import { OverdueIndicator } from '../shared/OverdueIndicator';
import { ProblemNumberDisplay } from '../shared/ProblemNumberDisplay';
import { useProblemDelete } from '../../hooks/useProblemMutations';

interface ProblemTableProps {
  problems: ProblemListItem[];
  isLoading: boolean;
}

export const ProblemTable: React.FC<ProblemTableProps> = ({ problems, isLoading }) => {
  const navigate = useNavigate();
  const deleteMutation = useProblemDelete();

  const handleView = (id: number) => {
    navigate(`/quality/problems/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/quality/problems/${id}/edit`);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this problem?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.detail || 'Error deleting problem');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-8 text-center text-gray-500">
          Loading problems...
        </div>
      </div>
    );
  }

  if (!problems || problems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-8 text-center text-gray-500">
          No problems found. Create your first problem to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Problem #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Part No
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Champion
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target Close
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {problems.map((problem) => (
              <tr
                key={problem.id}
                onClick={() => handleView(problem.id)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                {/* Problem Number */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <ProblemNumberDisplay
                      problemNumber={problem.problem_number}
                      id={problem.id}
                    />
                    {problem.is_overdue && (
                      <OverdueIndicator isOverdue={true} tooltip="One or more steps are overdue" />
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={problem.status} display={problem.status_display} />
                </td>

                {/* Brief Description */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {problem.brief_description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {problem.category_display}
                  </div>
                </td>

                {/* Part No */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {problem.part_no || '-'}
                </td>

                {/* Customer */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {problem.customer_no || '-'}
                  </div>
                  <div className="text-xs text-gray-500 max-w-xs truncate">
                    {problem.customer_name}
                  </div>
                </td>

                {/* Champion */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {problem.champion.first_name} {problem.champion.last_name}
                  </div>
                </td>

                {/* Severity */}
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex justify-center">
                    <SeverityBadge level={problem.severity_level_value} />
                  </div>
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(problem.created_at)}
                </td>

                {/* Target Close Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {problem.target_close_date ? formatDate(problem.target_close_date) : '-'}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleView(problem.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    {problem.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleEdit(problem.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={(e) => handleDelete(problem.id, e)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};