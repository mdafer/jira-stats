import React from 'react';
import { RefreshCw } from 'lucide-react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-950 text-white" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>
            <div style={{ textAlign: 'center' }}>
                <RefreshCw className="animate-spin" size={48} style={{ marginBottom: '1rem', color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.5rem' }}>Syncing with Jira API...</h2>
                <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Fetching issues and parsing changelogs</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
