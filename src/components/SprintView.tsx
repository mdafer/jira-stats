import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Info } from 'lucide-react';
import type { JiraTask, Metrics, SelectedSprintInfo } from '../types/jira';
import { round1dec, workDayDurationFromIntervals, formatIdleDayRanges } from '../utils/dateUtils';
import GanttChart from './GanttChart';

interface SprintViewProps {
    data: JiraTask[];
    metrics: Metrics;
    initialSprint?: string | null;
    initialUser?: string | null;
    workDays: number[];
    onSprintSelect?: (sprintName: string, preserveUser?: string | null) => void;
    onUserSelect?: (userName: string | null) => void;
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatSprintRange = (sStart: number, sEnd: number) =>
    (sStart !== Infinity && sEnd !== -Infinity) ? `${formatDate(sStart)} – ${formatDate(sEnd)}` : '–';

const IDLE_DAYS_TOOLTIP = "Idle days are work days (from Settings) on which the developer had no task in 'In Progress' or 'In Development'. Days off are excluded from the count.";

const SprintView: React.FC<SprintViewProps> = ({ data, metrics, initialSprint, initialUser, workDays, onSprintSelect, onUserSelect }) => {
    const [selectedSprint, setSelectedSprint] = useState<SelectedSprintInfo | null>(null);
    const [ganttDevFilter, setGanttDevFilter] = useState<string | null>(null);
    const [showTimeExceededOnly, setShowTimeExceededOnly] = useState<boolean>(false);
    const [idleTooltipAt, setIdleTooltipAt] = useState<'heading' | 'column' | null>(null);
    const [showIdleListTooltip, setShowIdleListTooltip] = useState(false);

    useEffect(() => {
        if (initialSprint) {
            const sprintStats = metrics.sprintStats.find(s => s.name === initialSprint);
            if (sprintStats) {
                setSelectedSprint({
                    name: sprintStats.name,
                    tasks: data.filter(t => t.Sprint === sprintStats.name)
                });
                // Only set the filter if it's actually provided
                if (initialUser) {
                    setGanttDevFilter(initialUser);
                }
            }
        }
    }, [initialSprint, initialUser, metrics.sprintStats, data]);

    useEffect(() => {
        if (!initialUser) setGanttDevFilter(null);
        setShowTimeExceededOnly(false);
    }, [selectedSprint?.name]);

    if (!selectedSprint) {
        return (
            <div className="card glass-morphism">
                <h3 style={{ marginBottom: '1.5rem' }}>Sprint Performance</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Sprint Name</th>
                                <th>Start – End</th>
                                <th>Issues</th>
                                <th>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                        Total Idle Days
                                        <span
                                            onMouseEnter={() => setShowIdleListTooltip(true)}
                                            onMouseLeave={() => setShowIdleListTooltip(false)}
                                            style={{ display: 'inline-flex', cursor: 'help', position: 'relative', marginLeft: '4px' }}
                                        >
                                            <Info size={14} style={{ color: 'var(--text-muted)' }} />
                                            {showIdleListTooltip && (
                                                <span
                                                    role="tooltip"
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: '100%',
                                                        marginTop: '8px',
                                                        padding: '0.75rem',
                                                        background: '#1e293b',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8rem',
                                                        color: '#cbd5e1',
                                                        width: '320px',
                                                        whiteSpace: 'normal',
                                                        zIndex: 100,
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                        pointerEvents: 'none',
                                                        lineHeight: '1.5'
                                                    }}
                                                >
                                                    {IDLE_DAYS_TOOLTIP}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </th>
                                <th>Avg Idle/Issue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.sprintStats.map((sprint, i) => {
                                // Calculate total idle days for this sprint
                                const sprintTasks = data.filter(t => t.Sprint === sprint.name);
                                const developers = Array.from(new Set(sprintTasks.map(t => t.AssigneeName).filter(Boolean)));
                                
                                // Determine Sprint Range
                                let sStart = Infinity;
                                let sEnd = -Infinity;
                                const sprintDates = sprintTasks.find(t => t.SprintStart && (t.SprintEnd || t.Sprint));
                                if (sprintDates && sprintDates.SprintStart) {
                                    sStart = new Date(sprintDates.SprintStart).getTime();
                                    sEnd = new Date(sprintDates.SprintEnd || new Date()).getTime();
                                } else {
                                    sprintTasks.forEach(t => {
                                        t.Stages.forEach(s => {
                                            const st = new Date(s.start).getTime();
                                            const en = new Date(s.end).getTime();
                                            if (st < sStart) sStart = st;
                                            if (en > sEnd) sEnd = en;
                                        });
                                    });
                                }

                                // Idle = work day (from settings) with 0 tasks "in progress"; days off excluded from pool
                                const IN_PROGRESS_KEYWORDS = ['in progress', 'in development'];
                                let totalIdleDays = 0;

                                if (sStart !== Infinity && sEnd !== -Infinity) {
                                    const startDate = new Date(sStart);
                                    startDate.setHours(0, 0, 0, 0);
                                    const endDate = new Date(sEnd);
                                    endDate.setHours(23, 59, 59, 999);
                                    const todayEnd = new Date();
                                    todayEnd.setHours(23, 59, 59, 999);
                                    const effectiveEnd = endDate > todayEnd ? todayEnd : endDate;

                                    developers.forEach(dev => {
                                        const devTasks = sprintTasks.filter(t => t.AssigneeName === dev || t.Stages.some(s => s.assignee === dev));
                                        const current = new Date(startDate);
                                        while (current <= effectiveEnd) {
                                            if (!workDays.includes(current.getDay())) {
                                                current.setDate(current.getDate() + 1);
                                                continue;
                                            }
                                            const dayStart = new Date(current);
                                            dayStart.setHours(0, 0, 0, 0);
                                            const dayEnd = new Date(current);
                                            dayEnd.setHours(23, 59, 59, 999);
                                            let isWorking = false;
                                            for (const task of devTasks) {
                                                for (const stage of task.Stages) {
                                                    const s = stage.status.toLowerCase();
                                                    if (IN_PROGRESS_KEYWORDS.some(k => s.includes(k))) {
                                                        const stageStart = new Date(stage.start);
                                                        const stageEnd = stage.end ? new Date(stage.end) : new Date();
                                                        if (dayStart <= stageEnd && dayEnd >= stageStart) {
                                                            isWorking = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (isWorking) break;
                                            }
                                            if (!isWorking) totalIdleDays++;
                                            current.setDate(current.getDate() + 1);
                                        }
                                    });
                                }

                                return (
                                    <tr key={i} onClick={() => { setSelectedSprint({ name: sprint.name, tasks: sprintTasks }); onSprintSelect?.(sprint.name); }} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {sprint.name} <ChevronRight size={14} color="var(--text-muted)" />
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formatSprintRange(sStart, sEnd)}</td>
                                        <td>{sprint.tasks}</td>
                                        <td>{totalIdleDays} d</td>
                                        <td>{sprint.tasks > 0 ? round1dec(totalIdleDays / sprint.tasks) : 0} d</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Sprint Detail View logic
    const sprintDates = selectedSprint.tasks.find(t => t.SprintStart && (t.SprintEnd || t.Sprint));
    let sStart = Infinity;
    let sEnd = -Infinity;

    if (sprintDates && sprintDates.SprintStart) {
        sStart = new Date(sprintDates.SprintStart).getTime();
        sEnd = new Date(sprintDates.SprintEnd || new Date()).getTime();
    } else {
        selectedSprint.tasks.forEach(t => {
            t.Stages.forEach(s => {
                const st = new Date(s.start).getTime();
                const en = new Date(s.end).getTime();
                if (st < sStart) sStart = st;
                if (en > sEnd) sEnd = en;
            });
        });
    }

    const devData = selectedSprint.tasks.reduce((acc, task) => {
        task.Stages.forEach(stage => {
            const status = stage.status.toLowerCase();
            const activeStatuses = ['in progress', 'code review', 'ready for qa'];
            if (activeStatuses.includes(status)) {
                const dev = stage.assignee || task.AssigneeName;
                if (!acc[dev]) acc[dev] = { name: dev, intervals: [], taskIntervals: {}, tasks: new Set() };

                const st = new Date(stage.start).getTime();
                const en = new Date(stage.end).getTime();

                const clipStart = Math.max(st, sStart);
                const clipEnd = Math.min(en, sEnd);

                if (clipStart < clipEnd) {
                    acc[dev].intervals.push({ start: clipStart, end: clipEnd });
                    if (!acc[dev].taskIntervals[task.ID]) acc[dev].taskIntervals[task.ID] = [];
                    acc[dev].taskIntervals[task.ID].push({ start: clipStart, end: clipEnd });
                }
                acc[dev].tasks.add(task.ID);
            }
        });
        return acc;
    }, {} as Record<string, { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }>);

    // Filter for tasks where time spent > story points
    // Calculate actual time from stages (matching what's displayed in the UI)
    const tasksExceedingTime = selectedSprint.tasks.filter(task => {
        if (!task.StoryPoints || task.StoryPoints <= 0) return false;

        // Calculate time from active stages within sprint boundaries
        const taskIntervals: { start: number, end: number }[] = [];
        task.Stages.forEach(stage => {
            const status = stage.status.toLowerCase();
            const activeStatuses = ['in progress', 'code review', 'ready for qa'];
            if (activeStatuses.includes(status)) {
                const st = new Date(stage.start).getTime();
                const en = new Date(stage.end).getTime();

                const clipStart = Math.max(st, sStart);
                const clipEnd = Math.min(en, sEnd);

                if (clipStart < clipEnd) {
                    taskIntervals.push({ start: clipStart, end: clipEnd });
                }
            }
        });

        const timeInDays = workDayDurationFromIntervals(taskIntervals, workDays);
        return timeInDays > task.StoryPoints;
    });

    const displayTasks = showTimeExceededOnly ? tasksExceedingTime : selectedSprint.tasks;

    // Recalculate devData based on filtered tasks
    const filteredDevData = displayTasks.reduce((acc, task) => {
        task.Stages.forEach(stage => {
            const status = stage.status.toLowerCase();
            const activeStatuses = ['in progress', 'code review', 'ready for qa'];
            if (activeStatuses.includes(status)) {
                const dev = stage.assignee || task.AssigneeName;
                if (!acc[dev]) acc[dev] = { name: dev, intervals: [], taskIntervals: {}, tasks: new Set() };

                const st = new Date(stage.start).getTime();
                const en = new Date(stage.end).getTime();

                const clipStart = Math.max(st, sStart);
                const clipEnd = Math.min(en, sEnd);

                if (clipStart < clipEnd) {
                    acc[dev].intervals.push({ start: clipStart, end: clipEnd });
                    if (!acc[dev].taskIntervals[task.ID]) acc[dev].taskIntervals[task.ID] = [];
                    acc[dev].taskIntervals[task.ID].push({ start: clipStart, end: clipEnd });
                }
                acc[dev].tasks.add(task.ID);
            }
        });
        return acc;
    }, {} as Record<string, { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }>);

    const displayDevData = showTimeExceededOnly ? filteredDevData : devData;
    const selectedDevDataFromDisplay = ganttDevFilter ? displayDevData[ganttDevFilter] : null;

    // Calculate count based on dev filter
    const exceedingTaskCount = ganttDevFilter && selectedDevDataFromDisplay
        ? selectedDevDataFromDisplay.tasks.size
        : tasksExceedingTime.length;

    return (
        <div className="card glass-morphism">
            <div className="sprint-detail-view">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setSelectedSprint(null)}
                            style={{ background: 'var(--border)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        {onSprintSelect ? (
                            <select
                                value={selectedSprint.name}
                                onChange={(e) => onSprintSelect(e.target.value, initialUser ?? ganttDevFilter)}
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.5rem 2rem 0.5rem 0.75rem', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 600, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', colorScheme: 'dark' }}
                            >
                                {metrics.sprintStats.map((s) => (
                                    <option key={s.name} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        ) : (
                            <h2 style={{ fontSize: '1.5rem' }}>{selectedSprint.name}</h2>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>
                            {formatSprintRange(sStart, sEnd)}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowTimeExceededOnly(!showTimeExceededOnly)}
                        style={{
                            background: showTimeExceededOnly ? 'var(--primary)' : 'var(--border)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                        }}
                        title="Show only tasks where time spent exceeded story points"
                    >
                        {showTimeExceededOnly ? '✓ ' : ''}Time &gt; Points ({exceedingTaskCount})
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: selectedDevDataFromDisplay ? '1fr 1fr' : '1fr', gap: '2rem', marginBottom: '3rem' }}>
                    <div>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                Developer Idle Days
                                <span
                                    onMouseEnter={() => setIdleTooltipAt('heading')}
                                    onMouseLeave={() => setIdleTooltipAt(null)}
                                    style={{ display: 'inline-flex', cursor: 'help', position: 'relative', width: 16, height: 16, flexShrink: 0, marginLeft: '4px' }}
                                >
                                    <Info size={16} style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    {idleTooltipAt === 'heading' && (
                                        <span
                                            role="tooltip"
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: '100%',
                                                marginTop: '8px',
                                                padding: '0.75rem',
                                                background: '#1e293b',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                color: '#cbd5e1',
                                                width: '320px',
                                                whiteSpace: 'normal',
                                                zIndex: 100,
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                pointerEvents: 'none',
                                                lineHeight: '1.5'
                                            }}
                                        >
                                            {IDLE_DAYS_TOOLTIP}
                                        </span>
                                    )}
                                </span>
                        </h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Developer</th>
                                        <th>Tasks</th>
                                        <th>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                Idle Days
                                                <span
                                                    onMouseEnter={() => setIdleTooltipAt('column')}
                                                    onMouseLeave={() => setIdleTooltipAt(null)}
                                                    style={{ display: 'inline-flex', cursor: 'help', position: 'relative', width: 14, height: 14, flexShrink: 0, marginLeft: '4px' }}
                                                >
                                                    <Info size={14} style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                    {idleTooltipAt === 'column' && (
                                                        <span
                                                            role="tooltip"
                                                            style={{
                                                                position: 'absolute',
                                                                left: 0,
                                                                top: '100%',
                                                                marginTop: '8px',
                                                                padding: '0.75rem',
                                                                background: '#1e293b',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: '8px',
                                                                fontSize: '0.8rem',
                                                                color: '#cbd5e1',
                                                                width: '320px',
                                                                whiteSpace: 'normal',
                                                                zIndex: 100,
                                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                                pointerEvents: 'none',
                                                                lineHeight: '1.5'
                                                            }}
                                                        >
                                                            {IDLE_DAYS_TOOLTIP}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(displayDevData).sort((a, b) => a.name.localeCompare(b.name)).map((stats: any) => {
                                        // Idle days = work days (from settings) with 0 tasks in progress; days off excluded
                                        const devTasks = selectedSprint.tasks.filter(t => (t.AssigneeName === stats.name || t.Stages.some(s => s.assignee === stats.name)));
                                        const IN_PROGRESS_KEYWORDS = ['in progress', 'in development'];
                                        const idleDates: Date[] = [];

                                        const startDate = new Date(sStart);
                                        startDate.setHours(0, 0, 0, 0);
                                        const endDate = new Date(sEnd);
                                        endDate.setHours(23, 59, 59, 999);
                                        const todayEnd = new Date();
                                        todayEnd.setHours(23, 59, 59, 999);
                                        const effectiveEnd = endDate > todayEnd ? todayEnd : endDate;
                                        const current = new Date(startDate);
                                        while (current <= effectiveEnd) {
                                            if (!workDays.includes(current.getDay())) {
                                                current.setDate(current.getDate() + 1);
                                                continue;
                                            }
                                            const dayStart = new Date(current);
                                            dayStart.setHours(0, 0, 0, 0);
                                            const dayEnd = new Date(current);
                                            dayEnd.setHours(23, 59, 59, 999);
                                            let isWorking = false;
                                            for (const task of devTasks) {
                                                for (const stage of task.Stages) {
                                                    const s = stage.status.toLowerCase();
                                                    if (IN_PROGRESS_KEYWORDS.some(k => s.includes(k))) {
                                                        const stageStart = new Date(stage.start);
                                                        const stageEnd = stage.end ? new Date(stage.end) : new Date();
                                                        if (dayStart <= stageEnd && dayEnd >= stageStart) {
                                                            isWorking = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (isWorking) break;
                                            }
                                            if (!isWorking) idleDates.push(new Date(current));
                                            current.setDate(current.getDate() + 1);
                                        }

                                        return (
                                            <tr
                                                key={stats.name}
                                                onClick={() => { const next = ganttDevFilter === stats.name ? null : stats.name; setGanttDevFilter(next); onUserSelect?.(next); }}
                                                style={{ cursor: 'pointer', background: ganttDevFilter === stats.name ? 'rgba(99, 102, 241, 0.15)' : 'transparent' }}
                                            >
                                                <td style={{ fontWeight: 600 }}>{stats.name}</td>
                                                <td>{stats.tasks.size}</td>
                                                <td>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${idleDates.length > 5 ? 'bg-red-500/10 text-red-400' :
                                                        idleDates.length > 2 ? 'bg-amber-500/10 text-amber-400' :
                                                            'bg-green-500/10 text-green-400'
                                                        }`}>
                                                        {idleDates.length} days
                                                    </span>
                                                    {idleDates.length > 0 && (
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }} title="Idle day numbers (day of month)">
                                                            ({formatIdleDayRanges(idleDates)})
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {selectedDevDataFromDisplay && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3>Tasks for {ganttDevFilter}</h3>
                                <button
                                    onClick={() => { setGanttDevFilter(null); onUserSelect?.(null); }}
                                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Reset Filter
                                </button>
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Points</th>
                                            <th>Time Spent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(selectedDevDataFromDisplay.taskIntervals).map(([taskId, intervals]: any) => {
                                            const task = selectedSprint.tasks.find(t => t.ID === taskId);
                                            return (
                                                <tr key={taskId}>
                                                    <td style={{ fontSize: '0.8rem' }}>
                                                        <a
                                                            href={task?.Link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', display: 'block', marginBottom: '4px' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                        >
                                                            {taskId}
                                                        </a>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{task?.Name}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{task?.StoryPoints || '-'}</td>
                                                    <td>{round1dec(workDayDurationFromIntervals(intervals, workDays))} d</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <GanttChart
                    tasks={displayTasks}
                    sStart={sStart}
                    sEnd={sEnd}
                    ganttDevFilter={ganttDevFilter}
                    setGanttDevFilter={(dev) => { setGanttDevFilter(dev); onUserSelect?.(dev); }}
                    allDevs={Object.keys(displayDevData).sort()}
                    workDays={workDays}
                />
            </div>
        </div>
    );
};

export default SprintView;
