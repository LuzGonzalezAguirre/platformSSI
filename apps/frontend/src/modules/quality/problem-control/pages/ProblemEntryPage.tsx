import React from 'react';
import { ProblemDetailPage } from './ProblemDetailPage';

/**
 * Stable entry point for viewing an 8D problem.
 *
 * View must always display the complete 8D detail, regardless of workflow
 * status. Final Approval is intentionally a separate route/action so assigned
 * approvers can review the full problem before opening the approval screen.
 */
export const ProblemEntryPage: React.FC = () => {
  return <ProblemDetailPage />;
};
