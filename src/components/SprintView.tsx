import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronRight, Info } from 'lucide-react';
import type { JiraTask, Metrics, SelectedSprintInfo } from '../types/jira';
import { round1dec, workDayDurationFromIntervals, formatIdleDayRanges } from '../utils/dateUtils';
import GanttChart from './GanttChart';
import { useTableSort } from '../hooks/useTableSort';
import SortableHeader from './SortableHeader';

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
    const [idleTooltipAt, setIdleTooltipAt] = useState<'heading' | 'column' | 'timeSpent' | null>(null);
    const [showIdleListTooltip, setShowIdleListTooltip] = useState(false);

    const TIME_SPENT_TOOLTIP = "Time spent is calculated as the sum of work days (from Settings) during which the task was in 'In Progress', 'In Development', 'Code Review', or 'Ready for QA' statuses.";

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

    // Pre-compute sprint list rows for sorting
    const sprintRows = useMemo(() => metrics.sprintStats.map(sprint => {
        const sprintTasks = data.filter(t => t.Sprint === sprint.name);
        const developers = Array.from(new Set(sprintTasks.map(t => t.AssigneeName).filter(Boolean)));

        let sStart = Infinity;
        let sEnd = -Infinity;
        const sprintDatesTask = sprintTasks.find(t => t.SprintStart && (t.SprintEnd || t.Sprint));
        if (sprintDatesTask && sprintDatesTask.SprintStart) {
            sStart = new Date(sprintDatesTask.SprintStart).getTime();
            sEnd = new Date(sprintDatesTask.SprintEnd || new Date()).getTime();
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
                    if (!workDays.includes(current.getDay())) { current.setDate(current.getDate() + 1); continue; }
                    const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(current); dayEnd.setHours(23, 59, 59, 999);
                    let isWorking = false;
                    for (const task of devTasks) {
                        for (const stage of task.Stages) {
                            const s = stage.status.toLowerCase();
                            if (IN_PROGRESS_KEYWORDS.some(k => s.includes(k))) {
                                const stageStart = new Date(stage.start);
                                const stageEnd = stage.end ? new Date(stage.end) : new Date();
                                if (dayStart <= stageEnd && dayEnd >= stageStart) { isWorking = true; break; }
                            }
                        }
                        if (isWorking) break;
                    }
                    if (!isWorking) totalIdleDays++;
                    current.setDate(current.getDate() + 1);
                }
            });
        }

        return { name: sprint.name, tasks: sprint.tasks, sStart, sEnd, totalIdleDays, avgIdle: sprint.tasks > 0 ? round1dec(totalIdleDays / sprint.tasks) : 0, sprintTasks };
    }), [metrics.sprintStats, data, workDays]);

    const { sorted: sortedSprintRows, sort: sprintSort, toggleSort: toggleSprintSort } = useTableSort(sprintRows);

    // Sprint Detail View computations — must run unconditionally (before any early return) to satisfy Rules of Hooks
    const detailViewData = useMemo(() => {
        if (!selectedSprint) {
            return { sStart: Infinity, sEnd: -Infinity, devData: {} as Record<string, { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }>, tasksExceedingTime: [] as typeof selectedSprint extends null ? never[] : JiraTask[], displayTasks: [] as JiraTask[], filteredDevData: {} as Record<string, { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }>, displayDevData: {} as Record<string, { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }>, selectedDevDataFromDisplay: null as null | { name: string, intervals: { start: number, end: number }[], taskIntervals: Record<string, { start: number, end: number }[]>, tasks: Set<string> }, exceedingTaskCount: 0 };
        }

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

        const tasksExceedingTime = selectedSprint.tasks.filter(task => {
            if (!task.StoryPoints || task.StoryPoints <= 0) return false;
            const taskIntervals: { start: number, end: number }[] = [];
            task.Stages.forEach(stage => {
                const status = stage.status.toLowerCase();
                const activeStatuses = ['in progress', 'code review', 'ready for qa'];
                if (activeStatuses.includes(status)) {
                    const st = new Date(stage.start).getTime();
                    const en = new Date(stage.end).getTime();
                    const clipStart = Math.max(st, sStart);
                    const clipEnd = Math.min(en, sEnd);
                    if (clipStart < clipEnd) taskIntervals.push({ start: clipStart, end: clipEnd });
                }
            });
            const timeInDays = workDayDurationFromIntervals(taskIntervals, workDays);
            return timeInDays > task.StoryPoints;
        });

        const displayTasks = showTimeExceededOnly ? tasksExceedingTime : selectedSprint.tasks;

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
        const exceedingTaskCount = ganttDevFilter && selectedDevDataFromDisplay
            ? selectedDevDataFromDisplay.tasks.size
            : tasksExceedingTime.length;

        return { sStart, sEnd, devData, tasksExceedingTime, displayTasks, filteredDevData, displayDevData, selectedDevDataFromDisplay, exceedingTaskCount };
    }, [selectedSprint, showTimeExceededOnly, ganttDevFilter, workDays]);

    const { sStart, sEnd, displayTasks, displayDevData, selectedDevDataFromDisplay, exceedingTaskCount } = detailViewData;

    const devIdleRows = useMemo(() => {
        if (!selectedSprint || sStart === Infinity || sEnd === -Infinity) return [];
        return Object.values(displayDevData).map((stats: any) => {
            const devTasks = selectedSprint.tasks.filter(t => (t.AssigneeName === stats.name || t.Stages.some((s: any) => s.assignee === stats.name)));
            const IN_PROGRESS_KEYWORDS = ['in progress', 'in development'];
            const idleDates: Date[] = [];

            const startDate = new Date(sStart); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(sEnd); endDate.setHours(23, 59, 59, 999);
            const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
            const effectiveEnd = endDate > todayEnd ? todayEnd : endDate;
            const current = new Date(startDate);
            while (current <= effectiveEnd) {
                if (!workDays.includes(current.getDay())) { current.setDate(current.getDate() + 1); continue; }
                const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(current); dayEnd.setHours(23, 59, 59, 999);
                let isWorking = false;
                for (const task of devTasks) {
                    for (const stage of task.Stages) {
                        const s = stage.status.toLowerCase();
                        if (IN_PROGRESS_KEYWORDS.some(k => s.includes(k))) {
                            const stageStart = new Date(stage.start);
                            const stageEnd = stage.end ? new Date(stage.end) : new Date();
                            if (dayStart <= stageEnd && dayEnd >= stageStart) { isWorking = true; break; }
                        }
                    }
                    if (isWorking) break;
                }
                if (!isWorking) idleDates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            return { name: stats.name, taskCount: stats.tasks.size, idleDays: idleDates.length, idleDates };
        });
    }, [displayDevData, selectedSprint, sStart, sEnd, workDays]);

    const { sorted: sortedDevIdleRows, sort: devIdleSort, toggleSort: toggleDevIdleSort } = useTableSort(devIdleRows);

    const devTaskRows = useMemo(() => {
        if (!selectedDevDataFromDisplay || !selectedSprint) return [];
        return Object.entries(selectedDevDataFromDisplay.taskIntervals).map(([taskId, intervals]: any) => {
            const task = selectedSprint.tasks.find(t => t.ID === taskId);
            const timeSpent = round1dec(workDayDurationFromIntervals(intervals, workDays));
            return { taskId, task, epic: task?.Epic || '', points: task?.StoryPoints || 0, timeSpent, intervals };
        });
    }, [selectedDevDataFromDisplay, selectedSprint, workDays]);

    const { sorted: sortedDevTaskRows, sort: devTaskSort, toggleSort: toggleDevTaskSort } = useTableSort(devTaskRows);

    if (!selectedSprint) {
        return (
            <div className="card glass-morphism">
                <h3 style={{ marginBottom: '1.5rem' }}>Sprint Performance</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <SortableHeader label="Sprint Name" sortKey="name" sort={sprintSort} onToggle={toggleSprintSort} />
                                <th>Start – End</th>
                                <SortableHeader label="Issues" sortKey="tasks" sort={sprintSort} onToggle={toggleSprintSort} />
                                <SortableHeader label="Total Idle Days" sortKey="totalIdleDays" sort={sprintSort} onToggle={toggleSprintSort}>
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
                                                    position: 'absolute', left: 0, top: '100%', marginTop: '8px', padding: '0.75rem',
                                                    background: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px',
                                                    fontSize: '0.8rem', color: '#cbd5e1', width: '320px', whiteSpace: 'normal',
                                                    zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', pointerEvents: 'none', lineHeight: '1.5'
                                                }}
                                            >
                                                {IDLE_DAYS_TOOLTIP}
                                            </span>
                                        )}
                                    </span>
                                </SortableHeader>
                                <SortableHeader label="Avg Idle/Issue" sortKey="avgIdle" sort={sprintSort} onToggle={toggleSprintSort} />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSprintRows.map((row) => (
                                <tr key={row.name} onClick={() => { setSelectedSprint({ name: row.name, tasks: row.sprintTasks }); onSprintSelect?.(row.name); }} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {row.name} <ChevronRight size={14} color="var(--text-muted)" />
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formatSprintRange(row.sStart, row.sEnd)}</td>
                                    <td>{row.tasks}</td>
                                    <td>{row.totalIdleDays} d</td>
                                    <td>{row.avgIdle} d</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

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
                                        <SortableHeader label="Developer" sortKey="name" sort={devIdleSort} onToggle={toggleDevIdleSort} />
                                        <SortableHeader label="Tasks" sortKey="taskCount" sort={devIdleSort} onToggle={toggleDevIdleSort} />
                                        <SortableHeader label="Idle Days" sortKey="idleDays" sort={devIdleSort} onToggle={toggleDevIdleSort}>
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
                                                            position: 'absolute', left: 0, top: '100%', marginTop: '8px', padding: '0.75rem',
                                                            background: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px',
                                                            fontSize: '0.8rem', color: '#cbd5e1', width: '320px', whiteSpace: 'normal',
                                                            zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', pointerEvents: 'none', lineHeight: '1.5'
                                                        }}
                                                    >
                                                        {IDLE_DAYS_TOOLTIP}
                                                    </span>
                                                )}
                                            </span>
                                        </SortableHeader>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDevIdleRows.map((row) => (
                                        <tr
                                            key={row.name}
                                            onClick={() => { const next = ganttDevFilter === row.name ? null : row.name; setGanttDevFilter(next); onUserSelect?.(next); }}
                                            style={{ cursor: 'pointer', background: ganttDevFilter === row.name ? 'rgba(99, 102, 241, 0.15)' : 'transparent' }}
                                        >
                                            <td style={{ fontWeight: 600 }}>{row.name}</td>
                                            <td>{row.taskCount}</td>
                                            <td>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.idleDays > 5 ? 'bg-red-500/10 text-red-400' :
                                                    row.idleDays > 2 ? 'bg-amber-500/10 text-amber-400' :
                                                        'bg-green-500/10 text-green-400'
                                                    }`}>
                                                    {row.idleDays} days
                                                </span>
                                                {row.idleDays > 0 && (
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }} title="Idle day numbers (day of month)">
                                                        ({formatIdleDayRanges(row.idleDates)})
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
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
                                            <SortableHeader label="Task" sortKey="taskId" sort={devTaskSort} onToggle={toggleDevTaskSort} />
                                            <SortableHeader label="Epic" sortKey="epic" sort={devTaskSort} onToggle={toggleDevTaskSort} />
                                            <SortableHeader label="Points" sortKey="points" sort={devTaskSort} onToggle={toggleDevTaskSort} />
                                            <SortableHeader label="Time Spent" sortKey="timeSpent" sort={devTaskSort} onToggle={toggleDevTaskSort}>
                                                <span
                                                    onMouseEnter={() => setIdleTooltipAt('timeSpent')}
                                                    onMouseLeave={() => setIdleTooltipAt(null)}
                                                    style={{ display: 'inline-flex', cursor: 'help', position: 'relative', width: 14, height: 14, flexShrink: 0 }}
                                                >
                                                    <Info size={14} style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                    {idleTooltipAt === 'timeSpent' && (
                                                        <span
                                                            role="tooltip"
                                                            style={{
                                                                position: 'absolute', right: 0, top: '100%', marginTop: '8px', padding: '0.75rem',
                                                                background: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px',
                                                                fontSize: '0.8rem', color: '#cbd5e1', width: '280px', whiteSpace: 'normal',
                                                                zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                                pointerEvents: 'none', lineHeight: '1.5', fontWeight: 400, textAlign: 'left'
                                                            }}
                                                        >
                                                            {TIME_SPENT_TOOLTIP}
                                                        </span>
                                                    )}
                                                </span>
                                            </SortableHeader>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedDevTaskRows.map((row) => (
                                            <tr key={row.taskId}>
                                                <td style={{ fontSize: '0.8rem' }}>
                                                    <a
                                                        href={row.task?.Link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', display: 'block', marginBottom: '4px' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                    >
                                                        {row.taskId}
                                                    </a>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.task?.Name}</div>
                                                </td>
                                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.epic || '–'}>{row.epic || '–'}</td>
                                                <td style={{ fontWeight: 600 }}>{row.points || '-'}</td>
                                                <td>{row.timeSpent} d</td>
                                            </tr>
                                        ))}
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
