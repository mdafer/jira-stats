import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { JiraTask, Metrics, SelectedSprintInfo } from '../types/jira';
import { round1dec, mergeIntervals } from '../utils/dateUtils';
import GanttChart from './GanttChart';

interface SprintViewProps {
    data: JiraTask[];
    metrics: Metrics;
    initialSprint?: string | null;
}

const SprintView: React.FC<SprintViewProps> = ({ data, metrics, initialSprint }) => {
    const [selectedSprint, setSelectedSprint] = useState<SelectedSprintInfo | null>(null);
    const [ganttDevFilter, setGanttDevFilter] = useState<string | null>(null);
    const [showTimeExceededOnly, setShowTimeExceededOnly] = useState<boolean>(false);

    useEffect(() => {
        if (initialSprint) {
            const sprintStats = metrics.sprintStats.find(s => s.name === initialSprint);
            if (sprintStats) {
                setSelectedSprint({
                    name: sprintStats.name,
                    tasks: data.filter(t => t.Sprint === sprintStats.name)
                });
            }
        }
    }, [initialSprint, metrics.sprintStats, data]);

    useEffect(() => {
        setGanttDevFilter(null);
        setShowTimeExceededOnly(false);
    }, [selectedSprint]);

    if (!selectedSprint) {
        return (
            <div className="card glass-morphism">
                <h3 style={{ marginBottom: '1.5rem' }}>Sprint Performance</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Sprint Name</th>
                                <th>Issues</th>
                                <th>Total Effort (Days)</th>
                                <th>Avg Effort/Issue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.sprintStats.map((sprint, i) => (
                                <tr key={i} onClick={() => setSelectedSprint({ name: sprint.name, tasks: data.filter(t => t.Sprint === sprint.name) })} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {sprint.name} <ChevronRight size={14} color="var(--text-muted)" />
                                        </div>
                                    </td>
                                    <td>{sprint.tasks}</td>
                                    <td>{round1dec(sprint.time)}</td>
                                    <td>{round1dec(sprint.time / sprint.tasks)} d</td>
                                </tr>
                            ))}
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

        const timeInDays = mergeIntervals(taskIntervals);
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
                        <h2 style={{ fontSize: '1.5rem' }}>{selectedSprint.name}</h2>
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
                        <h3 style={{ marginBottom: '1rem' }}>Developer Effort (Active Time)</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Developer</th>
                                        <th>Tasks</th>
                                        <th>Effort (Days)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(displayDevData).map((stats: any) => (
                                        <tr
                                            key={stats.name}
                                            onClick={() => setGanttDevFilter(ganttDevFilter === stats.name ? null : stats.name)}
                                            style={{ cursor: 'pointer', background: ganttDevFilter === stats.name ? 'rgba(99, 102, 241, 0.15)' : 'transparent' }}
                                        >
                                            <td style={{ fontWeight: 600 }}>{stats.name}</td>
                                            <td>{stats.tasks.size}</td>
                                            <td>{round1dec(mergeIntervals(stats.intervals))} d</td>
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
                                    onClick={() => setGanttDevFilter(null)}
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
                                                    <td>{round1dec(mergeIntervals(intervals))} d</td>
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
                    setGanttDevFilter={setGanttDevFilter}
                    allDevs={Object.keys(displayDevData).sort()}
                />
            </div>
        </div>
    );
};

export default SprintView;
