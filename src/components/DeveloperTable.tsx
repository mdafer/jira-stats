import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Metrics, JiraTask } from '../types/jira';
import { round1dec } from '../utils/dateUtils';

interface DeveloperTableProps {
    metrics: Metrics;
    data: JiraTask[];
    onNavigateToSprint: (sprintName: string, userName: string) => void;
}

const DeveloperTable: React.FC<DeveloperTableProps> = ({ metrics, data, onNavigateToSprint }) => {
    // Get all sprints for each developer
    const getDevSprints = (devName: string) => {
        const devTasks = data.filter(t => 
            t.AssigneeName === devName || 
            t.Stages.some(s => s.assignee === devName)
        );
        const sprints = Array.from(new Set(devTasks.map(t => t.Sprint).filter(Boolean)));
        return sprints.sort();
    };

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
                            <th>View Sprints</th>
                            <th>Activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.devStats.sort((a, b) => b.points - a.points).map((dev, i) => {
                            const devSprints = getDevSprints(dev.name);
                            return (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{dev.name}</td>
                                    <td>{dev.tasks}</td>
                                    <td>{dev.points}</td>
                                    <td>{dev.tasks > 0 ? round1dec(dev.time / dev.tasks) : 0} d</td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {devSprints.map(sprint => (
                                                <button
                                                    key={sprint}
                                                    onClick={() => onNavigateToSprint(sprint, dev.name)}
                                                    className="sprint-badge-btn"
                                                    title={`View ${dev.name} in ${sprint}`}
                                                >
                                                    {sprint}
                                                    <ExternalLink size={10} />
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="progress-bar-container" style={{ width: '120px' }}>
                                            <div className="progress-bar-fill" style={{ width: `${Math.min(100, (dev.points / (metrics.totalStoryPoints || 1)) * 500)}%` }}></div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <style>{`
                .sprint-badge-btn {
                    background: var(--border);
                    border: 1px solid transparent;
                    color: var(--text-muted);
                    font-size: 0.7rem;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    transition: all 0.2s ease;
                }
                .sprint-badge-btn:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
            `}</style>
        </div>
    );
};

export default DeveloperTable;
