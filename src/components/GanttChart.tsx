import React from 'react';
import type { JiraTask } from '../types/jira';
import { round1dec } from '../utils/dateUtils';

interface GanttChartProps {
    tasks: JiraTask[];
    sStart: number;
    sEnd: number;
    ganttDevFilter: string | null;
    setGanttDevFilter: (dev: string | null) => void;
    allDevs: string[];
}

const GanttChart: React.FC<GanttChartProps> = ({ tasks, sStart, sEnd, ganttDevFilter, setGanttDevFilter, allDevs }) => {
    const minTime = sStart;
    const maxTime = sEnd;
    const totalSpan = maxTime - minTime;
    const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
        <div className="gantt-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Status Timeline (Gantt Chart)</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filter by Developer:</span>
                    <select
                        value={ganttDevFilter || ''}
                        onChange={(e) => setGanttDevFilter(e.target.value || null)}
                        style={{
                            background: '#0f172a',
                            border: '1px solid var(--border)',
                            color: 'white',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">All Developers</option>
                        {allDevs.map(dev => (
                            <option key={dev} value={dev}>{dev}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="gantt-container" style={{ padding: '1.5rem', background: '#0f172a', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <div></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', position: 'relative', height: '1.5rem' }}>
                        <span style={{ position: 'absolute', left: '0' }}>{formatDate(minTime)}</span>
                        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{formatDate(minTime + totalSpan / 2)}</span>
                        <span style={{ position: 'absolute', right: '0' }}>{formatDate(maxTime)}</span>
                    </div>
                </div>

                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '300px', right: '0', top: '0', bottom: '0', pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', zIndex: 0 }}>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} style={{ borderLeft: '1px dashed rgba(255,255,255,0.05)', height: '100%' }}></div>
                        ))}
                    </div>

                    {tasks
                        .filter(task => !ganttDevFilter || task.AssigneeName === ganttDevFilter || task.Stages.some(s => s.assignee === ganttDevFilter))
                        .sort((a, b) => {
                            const aTime = a.Stages.find(s => s.status.toLowerCase().includes('in progress'))?.start;
                            const bTime = b.Stages.find(s => s.status.toLowerCase().includes('in progress'))?.start;
                            if (!aTime && !bTime) return 0;
                            if (!aTime) return 1;
                            if (!bTime) return -1;
                            return new Date(aTime).getTime() - new Date(bTime).getTime();
                        })
                        .map(task => (
                            <div key={task.ID} style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1.25rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', lineHeight: '1.4' }}>
                                    <a href={task.Link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', flexShrink: 0 }}>{task.ID}</a>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.Name} (Pts: {task.StoryPoints || '-'})</span>
                                </div>
                                <div style={{ height: '20px', position: 'relative', borderRadius: '4px', background: 'rgba(30, 41, 59, 0.5)', overflow: 'hidden' }}>
                                    {(() => {
                                        const stages = task.Stages;
                                        const lastDoneIndex = stages.map(s => s.status.toLowerCase().includes('done')).lastIndexOf(true);

                                        return stages.map((stage, idx) => {
                                            if (stage.duration < 0.01) return null;
                                            const isDone = stage.status.toLowerCase().includes('done');

                                            if (isDone && idx !== lastDoneIndex) return null;

                                            const sTime = new Date(stage.start).getTime();
                                            const eTime = new Date(stage.end).getTime();
                                            const visibleStart = Math.max(sTime, minTime);
                                            let visibleEnd = Math.min(eTime, maxTime);

                                            if (isDone) {
                                                const oneDayMs = 24 * 60 * 60 * 1000;
                                                visibleEnd = Math.min(visibleEnd, visibleStart + oneDayMs);
                                            }

                                            if (visibleStart >= visibleEnd) return null;
                                            const startOffset = ((visibleStart - minTime) / totalSpan) * 100;
                                            const width = ((visibleEnd - visibleStart) / totalSpan) * 100;
                                            const color = stage.status.toLowerCase().includes('progress') ? 'var(--primary)' :
                                                stage.status.toLowerCase().includes('qa') ? 'var(--warning)' :
                                                    isDone ? 'var(--success)' :
                                                        stage.status.toLowerCase().includes('review') ? 'var(--accent)' :
                                                            '#475569';
                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${startOffset}%`,
                                                        width: `${Math.max(0.5, width)}%`,
                                                        background: color,
                                                        height: '100%',
                                                        borderRight: '1px solid rgba(0,0,0,0.1)'
                                                    }}
                                                    title={`${stage.status}: ${round1dec(stage.duration)} days (${stage.assignee})\n${new Date(stage.start).toLocaleDateString()} - ${new Date(stage.end).toLocaleDateString()}`}
                                                />
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
