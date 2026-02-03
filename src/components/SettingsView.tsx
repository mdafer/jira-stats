import React from 'react';
import { CacheStatus } from './CacheStatus';
import type { CacheMetadata } from '../services/cacheService';

interface SettingsViewProps {
    cacheMetadata: CacheMetadata | null;
    isFromCache: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onClearCache: () => void;
    workDays: number[];
    onUpdateWorkDays: (days: number[]) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    cacheMetadata,
    isFromCache,
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
                            isFromCache={isFromCache}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            onClearCache={onClearCache}
                        />
                    </div>

                    <div className="tip-box">
                        <h4 className="tip-title">About Data Freshness</h4>
                        <ul className="tip-list">
                            <li>Data is automatically cached for 30 minutes.</li>
                            <li>"From Cache" means you are viewing locally stored data.</li>
                            <li>"Live Data" means the data was just fetched from Jira.</li>
                            <li>Use "Refresh Now" to force an update from Jira.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="card glass-morphism settings-section">
                <h2 className="settings-header">Application Info</h2>
                <div className="info-grid">
                    <div className="info-card">
                        <span className="info-label">Version</span>
                        <span className="info-value">1.0.0</span>
                    </div>
                    <div className="info-card">
                        <span className="info-label">Environment</span>
                        <span className="info-value" style={{ textTransform: 'capitalize' }}>
                            {import.meta.env.MODE}
                        </span>
                    </div>
                    <div className="info-card" style={{ gridColumn: '1 / -1' }}>
                        <span className="info-label">Jira API Domain</span>
                        <span className="info-value mono">
                            {import.meta.env.VITE_JIRA_DOMAIN || 'https://mehe-modernization-division.atlassian.net'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
