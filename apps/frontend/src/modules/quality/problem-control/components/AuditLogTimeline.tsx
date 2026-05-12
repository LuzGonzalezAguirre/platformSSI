
import React from 'react';
import { useProblemAuditLog } from '../hooks/useProblemQueries';
import { useTranslation } from 'react-i18next';

interface AuditLogTimelineProps {
  problemId: string;
}

export function AuditLogTimeline({ problemId }: AuditLogTimelineProps) {
  const { t } = useTranslation();
  const { data: logs, isLoading } = useProblemAuditLog(problemId);
  
  if (isLoading) {
    return <div className="loading-spinner"></div>;
  }
  
  if (!logs || logs.length === 0) {
    return (
      <div className="no-logs">
        <p>{t('problemControl.noAuditLogs')}</p>
      </div>
    );
  }
  
  return (
    <div className="audit-log-timeline">
      <h3>{t('problemControl.auditLog')}</h3>
      
      <div className="timeline">
        {logs.map((log) => (
          <div key={log.id} className="timeline-entry">
            <div className="timeline-marker">
              <div className={`marker-icon ${getActionClass(log.action)}`}>
                {getActionIcon(log.action)}
              </div>
            </div>
            
            <div className="timeline-content">
              <div className="timeline-header">
                <strong>{log.user_name || t('common.system')}</strong>
                <span className="timestamp">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              
              <div className="timeline-body">
                <p className="action-description">
                  {t(`problemControl.actions.${log.action}`)}
                </p>
                
                {Object.keys(log.changes).length > 0 && (
                  <div className="changes-detail">
                    {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="change-item">
                        <span className="field-name">{field}:</span>
                        {change.old !== undefined && (
                          <>
                            <span className="old-value">{formatValue(change.old)}</span>
                            <span className="arrow">→</span>
                          </>
                        )}
                        <span className="new-value">{formatValue(change.new)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function getActionClass(action: string): string {
  const classMap: Record<string, string> = {
    created: 'success',
    updated: 'info',
    approved: 'success',
    rejected: 'danger',
    closed: 'success',
    override_requested: 'warning',
    override_approved: 'success',
    stage_completed: 'success',
  };
  
  return classMap[action] || 'secondary';
}

function getActionIcon(action: string): string {
  const iconMap: Record<string, string> = {
    created: '✓',
    updated: '✎',
    approved: '✓',
    rejected: '✗',
    closed: '✓',
    override_requested: '!',
    override_approved: '✓',
    stage_completed: '✓',
  };
  
  return iconMap[action] || '•';
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '—';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}