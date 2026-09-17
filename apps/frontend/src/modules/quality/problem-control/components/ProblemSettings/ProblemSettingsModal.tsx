import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { problemApi } from '../../api/problemApi';
import {
  CatalogSettings,
  type CatalogItem,
} from './CatalogSettings';
import { QualityManagerSettings } from './QualityManagerSettings';

interface ProblemSettingsModalProps {
  onClose: () => void;
}

type SettingsTab =
  | 'categories'
  | 'problem-types'
  | 'defect-types'
  | 'quality-manager';

export const ProblemSettingsModal: React.FC<
  ProblemSettingsModalProps
> = ({ onClose }) => {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>('categories');

  const queryClient = useQueryClient();

  const invalidateCatalogs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['problem-categories'] }),
      queryClient.invalidateQueries({ queryKey: ['problem-types'] }),
      queryClient.invalidateQueries({ queryKey: ['defect-types'] }),
      queryClient.invalidateQueries({ queryKey: ['problem-control-settings'] }),
    ]);
  };

  const loadCategories = async (): Promise<CatalogItem[]> => {
    const data = await problemApi.getProblemCategoriesForSettings();
    return data.map((item: any) => ({
      id: item.id,
      key: item.value,
      label: item.label,
      is_active: item.is_active,
    }));
  };

  const loadProblemTypes = async (): Promise<CatalogItem[]> => {
    const data = await problemApi.getProblemTypesForSettings();
    return data.map((item: any) => ({
      id: item.id,
      key: item.value,
      label: item.label,
      is_active: item.is_active,
    }));
  };

  const loadDefectTypes = async (): Promise<CatalogItem[]> => {
    const data = await problemApi.getDefectTypesForSettings();
    return data.map((item: any) => ({
      id: item.id,
      key: item.code,
      label: item.description,
      is_active: item.is_active,
    }));
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'problem-types', label: 'Problem Types' },
    { key: 'defect-types', label: 'Defect Types' },
    { key: 'quality-manager', label: 'Quality Manager' },
  ];

  return (
    <div
      style={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Problem Control Settings</h2>
            <p style={styles.subtitle}>Configure catalogs and approval routing defaults used by Problem Control.</p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Close settings">×</button>
        </div>

        <div style={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{ ...styles.tab, ...(activeTab === tab.key ? styles.activeTab : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {activeTab === 'categories' && (
            <CatalogSettings
              title="Categories"
              keyLabel="Value"
              labelLabel="Category Name"
              loadItems={loadCategories}
              createItem={async (data) => {
                await problemApi.createProblemCategory({ value: data.key, label: data.label, is_active: data.is_active });
                await invalidateCatalogs();
              }}
              updateItem={async (id, data) => {
                await problemApi.updateProblemCategory(id, data);
                await invalidateCatalogs();
              }}
            />
          )}

          {activeTab === 'problem-types' && (
            <CatalogSettings
              title="Problem Types"
              keyLabel="Value"
              labelLabel="Problem Type"
              loadItems={loadProblemTypes}
              createItem={async (data) => {
                await problemApi.createProblemType({ value: data.key, label: data.label, is_active: data.is_active });
                await invalidateCatalogs();
              }}
              updateItem={async (id, data) => {
                await problemApi.updateProblemType(id, data);
                await invalidateCatalogs();
              }}
            />
          )}

          {activeTab === 'defect-types' && (
            <CatalogSettings
              title="Defect Types"
              keyLabel="Code"
              labelLabel="Description"
              loadItems={loadDefectTypes}
              createItem={async (data) => {
                await problemApi.createDefectType({ code: data.key, description: data.label, is_active: data.is_active });
                await invalidateCatalogs();
              }}
              updateItem={async (id, data) => {
                await problemApi.updateDefectType(id, { description: data.label, is_active: data.is_active });
                await invalidateCatalogs();
              }}
            />
          )}

          {activeTab === 'quality-manager' && <QualityManagerSettings />}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' },
  modal: { width: '90%', maxWidth: '1100px', height: '80vh', maxHeight: '750px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' },
  subtitle: { margin: '0.35rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' },
  closeButton: { width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--radius-sm)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer' },
  tabs: { display: 'flex', gap: '0.25rem', padding: '0 1.5rem', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' },
  tab: { padding: '0.875rem 1rem', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  activeTab: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', fontWeight: 600 },
  content: { flex: 1, padding: '1.5rem', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)', overflowY: 'auto' },
};
