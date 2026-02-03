import { RefreshCw, Database, Clock, AlertCircle } from 'lucide-react';
import type { CacheMetadata } from '../services/cacheService';

interface CacheStatusProps {
    cacheMetadata: CacheMetadata | null;
    isFromCache: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onClearCache: () => void;
}

export const CacheStatus: React.FC<CacheStatusProps> = ({
    cacheMetadata,
    isFromCache,
    refreshing,
    onRefresh,
    onClearCache
}) => {
    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <div className="cache-status-container">
            {/* Cache Status Indicator */}
            <div className={`status-indicator ${isFromCache ? 'cache-active' : 'live-active'}`}>
                <Database size={16} />
                <span style={{ fontWeight: 500 }}>
                    {isFromCache ? 'From Cache' : 'Live Data'}
                </span>
            </div>

            {/* Last Updated */}
            {cacheMetadata && (
                <div className="status-info">
                    <Clock size={16} />
                    <span>
                        Updated {formatTimestamp(cacheMetadata.lastFetch)}
                    </span>
                </div>
            )}

            {/* Task Count */}
            {cacheMetadata && (
                <div className="status-info">
                    <AlertCircle size={16} />
                    <span>
                        {cacheMetadata.totalTasks} tasks cached
                    </span>
                </div>
            )}

            {/* Refresh Button */}
            <button
                onClick={() => onRefresh()}
                disabled={refreshing}
                className="action-btn"
            >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh Now'}</span>
            </button>

            {/* Clear Cache Button */}
            <button
                onClick={onClearCache}
                disabled={refreshing || !cacheMetadata}
                className="action-btn danger"
            >
                Clear Cache
            </button>
        </div>
    );
};
