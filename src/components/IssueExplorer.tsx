import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { JiraTask } from '../types/jira';
import { round1dec } from '../utils/dateUtils';

interface IssueExplorerProps {
    data: JiraTask[];
}

const IssueExplorer: React.FC<IssueExplorerProps> = ({ data }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredData = useMemo(() => {
        if (!searchQuery) return data;
        const query = searchQuery.toLowerCase();
        return data.filter(t =>
            t.ID.toLowerCase().includes(query) ||
            t.Name.toLowerCase().includes(query) ||
            t.AssigneeName.toLowerCase().includes(query)
        );
    }, [data, searchQuery]);

    return (
        <div className="card glass-morphism">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Issue Explorer</h3>
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Filter by key, summary, or dev..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            background: '#0f172a',
                            border: '1px solid var(--border)',
                            color: 'white',
                            padding: '0.6rem 1rem 0.6rem 2.5rem',
                            borderRadius: '12px',
                            width: '300px'
                        }}
                    />
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Summary</th>
                            <th>Developer</th>
                            <th>Points</th>
                            <th>Status</th>
                            <th>Days Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.slice(0, 100).map((task, i) => (
                            <tr key={i}>
                                <td><a href={task.Link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{task.ID}</a></td>
                                <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.Name}</td>
                                <td>{task.AssigneeName}</td>
                                <td style={{ fontWeight: 700 }}>{task.StoryPoints || '-'}</td>
                                <td>
                                    <span className={`status-badge ${task.StatusCategory === 'Done' ? 'badge-done' :
                                        task.StatusCategory === 'In Progress' ? 'badge-inprogress' :
                                            'badge-todo'
                                        }`}>
                                        {task.Status}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{round1dec(Object.values(task.StagesDurations).reduce((a, b) => a + b, 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IssueExplorer;
