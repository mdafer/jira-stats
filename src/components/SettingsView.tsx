import React from 'react';
import { CacheStatus } from './CacheStatus';
import type { CacheMetadata } from '../services/jiraService';

interface SettingsViewProps {
    cacheMetadata: CacheMetadata | null;
    refreshing: boolean;
    onRefresh: () => void;
    onClearCache: () => void;
    workDays: number[];
    onUpdateWorkDays: (days: number[]) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    cacheMetadata,
    refreshing,
    onRefresh,
    onClearCache,
    workDays,
    onUpdateWorkDays
}) => {

    return (
        <div className="settings-container">
            <div className="card glass-morphism settings-section">
                <h2 className="settings-header">
                    Data Management
                </h2>

                <div className="settings-content">
                    <div className="feature-box">
                        <div className="feature-header">
                            <div>
                                <h3 className="feature-title">Local Cache</h3>
                                <p className="feature-description">
                                    Manage locally stored Jira data to improve performance and reduce API calls.
                                </p>
                            </div>
                        </div>
                    </div>


                    <div className="feature-box">
                        <div className="feature-header">
                            <div>
                                <h3 className="feature-title">Work Schedule</h3>
                                <p className="feature-description">
                                    Configure working days availability calculations.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                                const isSelected = workDays.includes(index);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            if (isSelected) {
                                                onUpdateWorkDays(workDays.filter(d => d !== index).sort());
                                            } else {
                                                onUpdateWorkDays([...workDays, index].sort());
                                            }
                                        }}
                                        className={`action-btn ${isSelected ? 'active' : ''}`}
                                        style={{
                                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-muted)'
                                        }}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="feature-box">
                        <h4 className="feature-title" style={{ marginBottom: '1rem' }}>Cache Controls</h4>
                        <CacheStatus
                            cacheMetadata={cacheMetadata}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            onClearCache={onClearCache}
                        />
                    </div>

                    <div className="tip-box">
                        <h4 className="tip-title">About Data Freshness</h4>
                        <ul className="tip-list">
                            <li>Data is stored locally and never expires automatically.</li>
                            <li>Use "Refresh Now" to incrementally sync changes from Jira.</li>
                            <li>Tasks removed from Jira are pruned on each refresh.</li>
                            <li>Use "Clear Cache" to wipe local data and start fresh.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="card glass-morphism settings-section">
                <h2 className="settings-header">Application Info</h2>
                <div className="info-grid">
                    <div className="info-card">
                        <span className="info-label">Version</span>
                        <span className="info-value">{__APP_VERSION__}</span>
                    </div>
                    <div className="info-card">
                        <span className="info-label">Environment</span>
                        <span className="info-value" style={{ textTransform: 'capitalize' }}>
                            {import.meta.env.MODE}
                        </span>
                    </div>
                    <div className="info-card" style={{ gridColumn: '1 / -1' }}>
                        <span className="info-label">API Endpoint</span>
                        <span className="info-value mono">
                            {import.meta.env.VITE_API_URL || '/api'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
