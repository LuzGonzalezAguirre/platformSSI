// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/Step2_DefineTeam.tsx

import React, { useEffect } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { useQualityUsers } from '../../hooks/useCatalogs';
import type { UserBasic } from '../../types/problem.types';

export const Step2_DefineTeam: React.FC = () => {
  const { formData, updateFormData, setStepValidation } = useWizardStore();
  const { data: qualityUsers, isLoading } = useQualityUsers();

  // Validación: Al menos el Champion debe estar en el equipo (opcional)
  // O puede ser que el Step 2 sea opcional
  useEffect(() => {
    // Step 2 es opcional — siempre válido
    setStepValidation(2, true);
  }, [setStepValidation]);

  const handleAddMember = (userId: number) => {
    const user = qualityUsers?.find((u) => u.id === userId);
    if (!user) return;

    const currentMembers = formData.team_members || [];
    
    // Evitar duplicados
    if (currentMembers.find((m) => m.id === userId)) {
      return;
    }

    updateFormData({
      team_members: [...currentMembers, user],
    });
  };

  const handleRemoveMember = (userId: number) => {
    const currentMembers = formData.team_members || [];
    updateFormData({
      team_members: currentMembers.filter((m) => m.id !== userId),
    });
  };

  const selectedMemberIds = (formData.team_members || []).map((m) => m.id);
  const availableUsers = (qualityUsers || []).filter(
    (user) => !selectedMemberIds.includes(user.id)
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>Step 2 - Define Team</h2>
      <p style={styles.description}>
        Select the cross-functional team members who will work on this problem. 
        The champion is automatically included.
      </p>

      <div style={styles.content}>
        {/* Left: Available Users */}
        <div style={styles.column}>
          <h3 style={styles.columnTitle}>Available Users</h3>
          
          {isLoading ? (
            <p style={styles.loadingText}>Loading users...</p>
          ) : availableUsers.length === 0 ? (
            <p style={styles.emptyText}>All users have been added to the team</p>
          ) : (
            <div style={styles.userList}>
              {availableUsers.map((user) => (
                <div key={user.id} style={styles.userCard}>
                  <div style={styles.userInfo}>
                    <div style={styles.userName}>
                      {user.first_name} {user.last_name}
                    </div>
                    {user.email && (
                      <div style={styles.userEmail}>{user.email}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddMember(user.id)}
                    style={styles.addButton}
                  >
                    <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Team Members */}
        <div style={styles.column}>
          <h3 style={styles.columnTitle}>
            Team Members ({(formData.team_members || []).length})
          </h3>
          
          {/* Champion (always included) */}
          {formData.champion && (
            <div style={{ ...styles.userCard, ...styles.championCard }}>
              <div style={styles.userInfo}>
                <div style={styles.userName}>
                  {formData.champion.first_name} {formData.champion.last_name}
                </div>
                {formData.champion.email && (
                  <div style={styles.userEmail}>{formData.champion.email}</div>
                )}
                <div style={styles.championBadge}>Champion</div>
              </div>
            </div>
          )}

          {/* Team Members */}
          {(formData.team_members || []).length === 0 ? (
            <p style={styles.emptyText}>No additional team members added yet</p>
          ) : (
            <div style={styles.userList}>
              {(formData.team_members || []).map((member) => (
                <div key={member.id} style={styles.userCard}>
                  <div style={styles.userInfo}>
                    <div style={styles.userName}>
                      {member.first_name} {member.last_name}
                    </div>
                    {member.email && (
                      <div style={styles.userEmail}>{member.email}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    style={styles.removeButton}
                  >
                    <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: '0.5rem',
  },
  description: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  column: {
    backgroundColor: 'var(--color-bg-secondary)',
    padding: '1rem',
    borderRadius: '0.5rem',
    minHeight: '400px',
  },
  columnTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid var(--color-border)',
  },
  loadingText: {
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    padding: '2rem',
  },
  emptyText: {
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    padding: '1rem',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  userCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    transition: 'border-color 0.2s',
  },
  championCard: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    marginBottom: '1rem',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  userEmail: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginTop: '0.125rem',
  },
  championBadge: {
    display: 'inline-block',
    marginTop: '0.25rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '0.625rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
    textTransform: 'uppercase',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  removeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonIcon: {
    width: '0.875rem',
    height: '0.875rem',
  },
};