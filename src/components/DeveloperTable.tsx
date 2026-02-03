import React from 'react';
import type { Metrics } from '../types/jira';
import { round1dec } from '../utils/dateUtils';

interface DeveloperTableProps {
    metrics: Metrics;
}

const DeveloperTable: React.FC<DeveloperTableProps> = ({ metrics }) => {
    return (
        <div className="card glass-morphism">
            <h3 style={{ marginBottom: '1.5rem' }}>Developer Productivity</h3>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Developer</th>
                            <th>Tasks</th>
                            <th>Points</th>
                            <th>Avg Dev Time</th>
                            <th>Activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.devStats.sort((a, b) => b.points - a.points).map((dev, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{dev.name}</td>
                                <td>{dev.tasks}</td>
                                <td>{dev.points}</td>
                                <td>{dev.tasks > 0 ? round1dec(dev.time / dev.tasks) : 0} d</td>
                                <td>
                                    <div className="progress-bar-container" style={{ width: '120px' }}>
                                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, (dev.points / (metrics.totalStoryPoints || 1)) * 500)}%` }}></div>
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

export default DeveloperTable;
