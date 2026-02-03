import React from 'react';

interface MetricsCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    subtitle?: string;
    progress?: {
        percent: number;
        color: string;
    };
}

const MetricsCard: React.FC<MetricsCardProps> = ({ label, value, icon, subtitle, progress }) => {
    return (
        <div className="card glass-morphism">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                {icon}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
            {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
            {progress && (
                <div className="progress-bar-container" style={{ marginTop: '0.75rem' }}>
                    <div className="progress-bar-fill" style={{ width: `${progress.percent}%`, background: progress.color }}></div>
                </div>
            )}
        </div>
    );
};

export default MetricsCard;
