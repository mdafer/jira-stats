import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Info } from 'lucide-react';
import type { JiraTask } from '../types/jira';
import { getDoneAt } from '../utils/jiraUtils';

const inputStyle = { background: '#0f172a', border: '1px solid var(--border)', color: 'white', padding: '0.5rem 0.75rem', borderRadius: '8px' };

const isInProgress = (status: string) => {
    const s = status.toLowerCase();
    return !s.includes('done') && !s.includes('to do');
};

const wasAssignedToDevInProgress = (task: JiraTask, dev: string) =>
    task.Stages?.some(s => s.assignee === dev && isInProgress(s.status)) ?? false;

interface IssueExplorerProps {
    data: JiraTask[];
}

const DEV_TOOLTIP = 'Shows issues where this dev was assigned while the task was in progress (not just current assignee).';

const formatSprintDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const sprintDateTooltip = (task: JiraTask) => {
    const start = formatSprintDate(task.SprintStart);
    const end = formatSprintDate(task.SprintEnd);
    if (!start && !end) return 'No dates';
    return [start && `Start: ${start}`, end && `End: ${end}`].filter(Boolean).join(' · ');
};
const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    padding: '0.4rem 0.6rem',
    background: 'var(--bg-elevated, #1e293b)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'none'
};

const IssueExplorer: React.FC<IssueExplorerProps> = ({ data }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [devFilter, setDevFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showDevTooltip, setShowDevTooltip] = useState(false);
    const [showDateTooltip, setShowDateTooltip] = useState(false);
    const [sprintTooltip, setSprintTooltip] = useState<{ row: number; x: number; y: number } | null>(null);

    const devs = useMemo(() =>
        [...new Set(data.flatMap(t => (t.Stages ?? []).filter(s => isInProgress(s.status)).map(s => s.assignee)))].filter(Boolean).sort(),
        [data]
    );

    const filteredData = useMemo(() => {
        let out = data;
        if (devFilter) out = out.filter(t => wasAssignedToDevInProgress(t, devFilter));
        if (startDate || endDate) {
            const toLocalDate = (iso: string) => {
                const d = new Date(iso);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            out = out.filter(t => {
                const doneAt = getDoneAt(t);
                if (!doneAt) return false;
                const doneDay = toLocalDate(doneAt);
                if (startDate && doneDay < startDate) return false;
                if (endDate && doneDay > endDate) return false;
                return true;
            });
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            out = out.filter(t =>
                t.ID.toLowerCase().includes(q) || t.Name.toLowerCase().includes(q) || t.AssigneeName.toLowerCase().includes(q)
            );
        }
        return out;
    }, [data, searchQuery, devFilter, startDate, endDate]);

    return (
        <div className="card glass-morphism">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3>Issue Explorer</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', position: 'relative' }}>
                        <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{ ...inputStyle, minWidth: '140px' }}>
                            <option value="">All devs</option>
                            {devs.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <span
                            onMouseEnter={() => setShowDevTooltip(true)}
                            onMouseLeave={() => setShowDevTooltip(false)}
                            style={{ display: 'inline-flex', cursor: 'help' }}
                        >
                            <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </span>
                        {showDevTooltip && (
                            <div
                                role="tooltip"
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '100%',
                                    marginTop: '4px',
                                    padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-elevated, #1e293b)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-muted)',
                                    maxWidth: '280px',
                                    whiteSpace: 'normal',
                                    zIndex: 10,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}
                            >
                                {DEV_TOOLTIP}
                            </div>
                        )}
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', position: 'relative' }}>
                        From <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                        <span
                            onMouseEnter={() => setShowDateTooltip(true)}
                            onMouseLeave={() => setShowDateTooltip(false)}
                            style={{ display: 'inline-flex', cursor: 'help' }}
                        >
                            <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </span>
                        {showDateTooltip && (
                            <div
                                role="tooltip"
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '100%',
                                    marginTop: '4px',
                                    padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-elevated, #1e293b)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-muted)',
                                    maxWidth: '280px',
                                    whiteSpace: 'normal',
                                    zIndex: 10,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}
                            >
                                Filters issues by the date they first entered a "Done" status.
                            </div>
                        )}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        To <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                    </label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Key, summary, dev..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, paddingLeft: '2rem', width: '200px' }} />
                    </div>
                </div>
            </div>
            {(startDate || endDate) && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Showing tasks completed (moved to Done) within the selected date range.</p>}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Summary</th>
                            <th>Developer</th>
                            <th>Points</th>
                            <th>Status</th>
                            <th>Sprint</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.slice(0, 100).map((task, i) => (
                            <tr key={i}>
                                <td><a href={task.Link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{task.ID}</a></td>
                                <td style={{ maxWidth: '400px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{task.Name}</td>
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
                                <td style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {task.Sprint}
                                    <span
                                        onMouseEnter={(e) => {
                                            const r = e.currentTarget.getBoundingClientRect();
                                            setSprintTooltip({ row: i, x: r.left + r.width / 2, y: r.top });
                                        }}
                                        onMouseLeave={() => setSprintTooltip(null)}
                                        style={{ display: 'inline-flex', cursor: 'help' }}
                                    >
                                        <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    </span>
                                    {sprintTooltip?.row === i &&
                                        createPortal(
                                            <span
                                                role="tooltip"
                                                style={{
                                                    ...tooltipStyle,
                                                    left: sprintTooltip.x,
                                                    top: sprintTooltip.y - 4,
                                                    transform: 'translate(-50%, -100%)'
                                                }}
                                            >
                                                {sprintDateTooltip(task)}
                                            </span>,
                                            document.body
                                        )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IssueExplorer;
