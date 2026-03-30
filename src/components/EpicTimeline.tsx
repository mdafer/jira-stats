import React, { useMemo, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { JiraTask } from '../types/jira';
import { COLORS } from '../constants/theme';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface EpicTimelineProps {
    data: JiraTask[];
    onNavigateToSprint: (sprintName: string) => void;
}

interface SprintInfo {
    name: string;
    start: number;
    end: number;
}

interface ActiveCell {
    epic: string;
    sprint: SprintInfo;
    tasks: JiraTask[];
}

const EXCLUDED_SPRINT = (name: string) =>
    !name ||
    name.toLowerCase() === 'backlog' ||
    name.toLowerCase().includes('backlog') ||
    name.toLowerCase().includes('triage');

const MIN_SPRINT_COL_PX = 130;

const EpicTimeline: React.FC<EpicTimelineProps> = ({ data, onNavigateToSprint }) => {
    const [hiddenEpicsArr, setHiddenEpicsArr] = useLocalStorage<string[]>('epic_timeline_hidden_epics', []);
    const hiddenEpics = new Set(hiddenEpicsArr);
    const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);

    const { sprints, epics, minTime, maxTime, totalSpan, epicColors, jiraBaseUrl } = useMemo(() => {
        const sprintMap = new Map<string, SprintInfo>();
        for (const task of data) {
            if (EXCLUDED_SPRINT(task.Sprint) || !task.SprintStart || !task.SprintEnd) continue;
            const start = new Date(task.SprintStart).getTime();
            const end = new Date(task.SprintEnd).getTime();
            const existing = sprintMap.get(task.Sprint);
            if (!existing) {
                sprintMap.set(task.Sprint, { name: task.Sprint, start, end });
            } else {
                sprintMap.set(task.Sprint, {
                    name: task.Sprint,
                    start: Math.min(existing.start, start),
                    end: Math.max(existing.end, end),
                });
            }
        }

        const sprints = Array.from(sprintMap.values()).sort((a, b) => a.start - b.start);
        const minTime = sprints.length > 0 ? sprints[0].start : Date.now();
        const maxTime = sprints.length > 0 ? sprints[sprints.length - 1].end : Date.now();
        const totalSpan = maxTime - minTime || 1;

        const epicMap = new Map<string, JiraTask[]>();
        for (const task of data) {
            if (EXCLUDED_SPRINT(task.Sprint)) continue;
            const key = task.Epic || '(No Epic)';
            if (!epicMap.has(key)) epicMap.set(key, []);
            epicMap.get(key)!.push(task);
        }

        const epics = Array.from(epicMap.entries())
            .sort(([a], [b]) => {
                if (a === '(No Epic)') return 1;
                if (b === '(No Epic)') return -1;
                return a.localeCompare(b);
            })
            .map(([name, tasks]) => ({ name, tasks }));

        const epicColors = new Map<string, string>();
        epics.forEach((epic, idx) => {
            epicColors.set(epic.name, COLORS[idx % COLORS.length]);
        });

        let jiraBaseUrl: string | null = null;
        const firstLink = data.find(t => t.Link)?.Link;
        if (firstLink) {
            try { jiraBaseUrl = new URL(firstLink).origin; } catch { /* ignore */ }
        }

        return { sprints, epics, minTime, maxTime, totalSpan, epicColors, jiraBaseUrl };
    }, [data]);

    const labelWidth = 220;
    const rowHeight = 36;
    // Use proportional widths with a minimum total chart width
    const chartWidth = Math.max(sprints.length * MIN_SPRINT_COL_PX, 600);

    const px = (ts: number) => ((ts - minTime) / totalSpan) * chartWidth;
    const sprintLeft = (s: SprintInfo) => px(s.start);
    const sprintWidth = (s: SprintInfo) => px(s.end) - px(s.start);

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const sprintJiraUrl = (sprintName: string) =>
        jiraBaseUrl
            ? `${jiraBaseUrl}/issues/?jql=sprint%3D%22${encodeURIComponent(sprintName)}%22`
            : null;

    const toggleEpic = (name: string) =>
        setHiddenEpicsArr(prev => {
            const set = new Set(prev);
            set.has(name) ? set.delete(name) : set.add(name);
            return Array.from(set);
        });

    const visibleEpics = epics.filter(e => !hiddenEpics.has(e.name));

    if (sprints.length === 0) {
        return (
            <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
                No sprint data available. Tasks need SprintStart and SprintEnd dates.
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ marginBottom: '0.4rem' }}>Epic Timeline</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                    Epics mapped across sprint date ranges. Click a block to see tasks. Click an epic name to hide/show it.
                </p>
            </div>

            {/* Clickable legend / epic filter */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {epics.map(epic => {
                    const hidden = hiddenEpics.has(epic.name);
                    const color = epicColors.get(epic.name)!;
                    return (
                        <button
                            key={epic.name}
                            onClick={() => toggleEpic(epic.name)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.75rem',
                                color: hidden ? 'var(--text-muted)' : 'white',
                                background: hidden ? 'rgba(255,255,255,0.04)' : `${color}22`,
                                border: `1px solid ${hidden ? 'rgba(255,255,255,0.1)' : color + '66'}`,
                                borderRadius: '999px',
                                padding: '0.25rem 0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                textDecoration: hidden ? 'line-through' : 'none',
                            }}
                        >
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: hidden ? 'var(--text-muted)' : color,
                                    flexShrink: 0,
                                }}
                            />
                            {epic.name}
                        </button>
                    );
                })}
                {hiddenEpics.size > 0 && (
                    <button
                        onClick={() => setHiddenEpicsArr([])}
                        style={{
                            fontSize: '0.72rem',
                            color: 'var(--primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem 0.5rem',
                        }}
                    >
                        Show all
                    </button>
                )}
            </div>

            {/* Chart: fixed sidebar + scrollable chart side by side */}
            <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', overflow: 'hidden' }}>

                {/* Fixed sidebar — never scrolls */}
                <div style={{ width: labelWidth, flexShrink: 0, background: '#0f172a', borderRight: '1px solid var(--border)', padding: '1.5rem 0.75rem 1.5rem 1.25rem', zIndex: 2 }}>
                    {/* Spacer to match chart header height (sprint name row + date row) */}
                    <div style={{ height: 'calc(1.4rem + 0.25rem + 1rem + 1rem + 0.5rem + 1px)' }} />

                    {/* Epic label rows */}
                    {visibleEpics.map(epic => {
                        const color = epicColors.get(epic.name)!;
                        return (
                            <div
                                key={epic.name}
                                style={{ height: rowHeight, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600, color: 'white', overflow: 'hidden' }}
                                title={epic.name}
                            >
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic.name}</span>
                            </div>
                        );
                    })}

                    {/* Summary label */}
                    <div style={{ height: rowHeight, display: 'flex', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Total / sprint
                    </div>
                </div>

                {/* Scrollable chart area */}
                <div style={{ flex: 1, overflowX: 'auto' }}>
                    <div style={{ minWidth: chartWidth, padding: '1.5rem' }}>

                        {/* Sprint name header */}
                        <div style={{ position: 'relative', width: chartWidth, height: '1.4rem', marginBottom: '0.25rem' }}>
                            {sprints.map(sprint => (
                                <div
                                    key={sprint.name}
                                    style={{ position: 'absolute', left: sprintLeft(sprint), width: sprintWidth(sprint), fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 6, borderLeft: '1px solid rgba(255,255,255,0.1)' }}
                                    title={sprint.name}
                                >
                                    {sprint.name}
                                </div>
                            ))}
                        </div>

                        {/* Date labels */}
                        <div style={{ position: 'relative', width: chartWidth, height: '1rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                            {sprints.map(sprint => (
                                <span key={sprint.name} style={{ position: 'absolute', left: sprintLeft(sprint), transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'rgba(148,163,184,0.6)', whiteSpace: 'nowrap' }}>
                                    {formatDate(sprint.start)}
                                </span>
                            ))}
                            <span style={{ position: 'absolute', left: chartWidth, transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'rgba(148,163,184,0.6)', whiteSpace: 'nowrap' }}>
                                {formatDate(maxTime)}
                            </span>
                        </div>

                        {/* Epic rows */}
                        <div style={{ position: 'relative' }}>
                            {/* Vertical sprint dividers */}
                            <div style={{ position: 'absolute', left: 0, width: chartWidth, top: 0, bottom: 0, pointerEvents: 'none' }}>
                                {sprints.map(sprint => (
                                    <div key={sprint.name} style={{ position: 'absolute', left: sprintLeft(sprint), top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.06)' }} />
                                ))}
                                <div style={{ position: 'absolute', left: chartWidth, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.06)' }} />
                            </div>

                            {visibleEpics.map(epic => {
                                const color = epicColors.get(epic.name)!;
                                const tasksBySprint = new Map<string, JiraTask[]>();
                                for (const task of epic.tasks) {
                                    if (EXCLUDED_SPRINT(task.Sprint)) continue;
                                    if (!tasksBySprint.has(task.Sprint)) tasksBySprint.set(task.Sprint, []);
                                    tasksBySprint.get(task.Sprint)!.push(task);
                                }

                                return (
                                    <div key={epic.name} style={{ marginBottom: '0.6rem', position: 'relative', zIndex: 1 }}>
                                        <div style={{ width: chartWidth, height: rowHeight, position: 'relative', background: 'rgba(30,41,59,0.3)', borderRadius: '6px', overflow: 'hidden' }}>
                                            {sprints.map(sprint => {
                                                const tasks = tasksBySprint.get(sprint.name);
                                                if (!tasks || tasks.length === 0) return null;
                                                const left = sprintLeft(sprint);
                                                const width = sprintWidth(sprint);
                                                const points = tasks.reduce((s, t) => s + (t.StoryPoints || 0), 0);
                                                const doneCount = tasks.filter(t => t.StatusCategory === 'Done').length;
                                                const isActive = activeCell?.epic === epic.name && activeCell.sprint.name === sprint.name;
                                                return (
                                                    <div
                                                        key={sprint.name}
                                                        onClick={() => setActiveCell({ epic: epic.name, sprint, tasks })}
                                                        style={{ position: 'absolute', left, width, height: rowHeight, background: isActive ? `${color}55` : `${color}2a`, borderLeft: `3px solid ${color}`, borderRight: `1px solid ${color}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s', overflow: 'hidden', boxSizing: 'border-box', borderRadius: '0 3px 3px 0' }}
                                                        title={`${epic.name} · ${sprint.name}\n${tasks.length} tasks (${doneCount} done) · ${points} pts`}
                                                    >
                                                        <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: 700, lineHeight: 1.2 }}>{tasks.length}t</span>
                                                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.2 }}>{points}pts</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary row */}
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                            <div style={{ width: chartWidth, height: rowHeight, position: 'relative' }}>
                                {sprints.map(sprint => {
                                    const sprintTasks = data.filter(t => t.Sprint === sprint.name);
                                    const pts = sprintTasks.reduce((s, t) => s + (t.StoryPoints || 0), 0);
                                    return (
                                        <div key={sprint.name} style={{ position: 'absolute', left: sprintLeft(sprint), width: sprintWidth(sprint), height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{sprintTasks.length}t</span>
                                            <span style={{ fontSize: '0.6rem', color: 'rgba(148,163,184,0.5)' }}>{pts}pts</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Task detail popup */}
            {activeCell && (
                <div
                    onClick={() => setActiveCell(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#1e293b',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            maxWidth: 680,
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                        }}
                    >
                        {/* Popup header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 2,
                                            background: epicColors.get(activeCell.epic),
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>{activeCell.epic}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeCell.sprint.name}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {formatDate(activeCell.sprint.start)} – {formatDate(activeCell.sprint.end)}
                                    </span>
                                    {sprintJiraUrl(activeCell.sprint.name) && (
                                        <a
                                            href={sprintJiraUrl(activeCell.sprint.name)!}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                fontSize: '0.75rem',
                                                color: 'var(--primary)',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <ExternalLink size={12} /> View in Jira
                                        </a>
                                    )}
                                    <button
                                        onClick={() => { onNavigateToSprint(activeCell.sprint.name); setActiveCell(null); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            fontSize: '0.75rem',
                                            color: 'var(--primary)',
                                            background: 'rgba(99,102,241,0.12)',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            borderRadius: '6px',
                                            padding: '0.2rem 0.6rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <ExternalLink size={12} /> View sprint
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCell(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    flexShrink: 0,
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Summary stats */}
                        <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Tasks: <strong style={{ color: 'white' }}>{activeCell.tasks.length}</strong>
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Done: <strong style={{ color: 'var(--success)' }}>
                                    {activeCell.tasks.filter(t => t.StatusCategory === 'Done').length}
                                </strong>
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Points: <strong style={{ color: 'white' }}>
                                    {activeCell.tasks.reduce((s, t) => s + (t.StoryPoints || 0), 0)}
                                </strong>
                            </span>
                        </div>

                        {/* Task list */}
                        <div style={{ overflowY: 'auto', flexShrink: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>ID</th>
                                        <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Name</th>
                                        <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Assignee</th>
                                        <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pts</th>
                                        <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeCell.tasks.map(task => (
                                        <tr
                                            key={task.ID}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                        >
                                            <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                <a
                                                    href={task.Link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                                                >
                                                    {task.ID}
                                                </a>
                                            </td>
                                            <td style={{ padding: '0.5rem', color: 'white', maxWidth: 280 }}>
                                                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {task.Name}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {task.AssigneeName || '—'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {task.StoryPoints || '—'}
                                            </td>
                                            <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                <span
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '999px',
                                                        background:
                                                            task.StatusCategory === 'Done' ? 'rgba(16,185,129,0.15)' :
                                                            task.StatusCategory === 'In Progress' ? 'rgba(99,102,241,0.15)' :
                                                            'rgba(255,255,255,0.06)',
                                                        color:
                                                            task.StatusCategory === 'Done' ? 'var(--success)' :
                                                            task.StatusCategory === 'In Progress' ? 'var(--primary)' :
                                                            'var(--text-muted)',
                                                    }}
                                                >
                                                    {task.Status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EpicTimeline;
