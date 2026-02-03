import React, { useState, useMemo } from 'react';
import { Calendar, User, ArrowRight } from 'lucide-react';
import type { JiraTask } from '../types/jira';
import { formatIdleDayRanges } from '../utils/dateUtils';

interface IdleTimeViewProps {
    data: JiraTask[];
    onNavigateToSprint: (sprintName: string, userName?: string) => void;
    workDays: number[];
}

const IdleTimeView: React.FC<IdleTimeViewProps> = ({ data, onNavigateToSprint, workDays }) => {
    const [selectedSprint, setSelectedSprint] = useState<string>('');

    // Extract unique sprints
    const sprints = useMemo(() => {
        const uniqueSprints = Array.from(new Set(data.map(task => task.Sprint).filter(Boolean)));
        return uniqueSprints.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [data]);

    // Set default sprint
    React.useEffect(() => {
        if (!selectedSprint && sprints.length > 0) {
            // Filter out "Triage", "Backlog" etc for default selection
            // We want the latest *numbered* sprint (e.g. "Sprint 12")
            const numberedSprints = sprints.filter(s => /Sprint\s+\d+/i.test(s));

            if (numberedSprints.length > 0) {
                // Since sprints arrow is sorted numerically 'Sprint 9' < 'Sprint 10', 
                // the last one is the latest.
                setSelectedSprint(numberedSprints[numberedSprints.length - 1]);
            } else {
                // Fallback if no specific "Sprint X" naming found
                const validSprints = sprints.filter(s => !['Triage', 'Backlog', 'Kanban'].includes(s));
                setSelectedSprint(validSprints.length > 0 ? validSprints[validSprints.length - 1] : sprints[sprints.length - 1]);
            }
        }
    }, [sprints, selectedSprint]);

    const idleStats = useMemo(() => {
        if (!selectedSprint) return [];

        const sprintTasks = data.filter(t => t.Sprint === selectedSprint);
        if (sprintTasks.length === 0) return [];

        // Same sprint range as SprintView: SprintStart/SprintEnd if present, else min/max of stage dates
        let sStart = Infinity;
        let sEnd = -Infinity;
        const sprintDatesTask = sprintTasks.find(t => t.SprintStart && (t.SprintEnd || t.Sprint));
        if (sprintDatesTask?.SprintStart) {
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
        if (sStart === Infinity || sEnd === -Infinity) return [];

        const startDate = new Date(sStart);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(sEnd);
        endDate.setHours(23, 59, 59, 999);

        // Only work days (same as SprintView)
        const days: Date[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            if (workDays.includes(current.getDay())) days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        // Same developer set as SprintView: task assignee or any stage assignee
        const devNames: string[] = [];
        sprintTasks.forEach(t => {
            if (t.AssigneeName) devNames.push(t.AssigneeName);
            t.Stages.forEach(s => { if (s.assignee) devNames.push(s.assignee); });
        });
        const developers = Array.from(new Set(devNames));

        const IN_PROGRESS_KEYWORDS = ['in progress', 'in development'];

        return developers.map(dev => {
            const devTasks = sprintTasks.filter(t => t.AssigneeName === dev || t.Stages.some(s => s.assignee === dev));
            let activeDaysCount = 0;
            const idleDates: Date[] = [];

            days.forEach(day => {
                const dayStart = new Date(day);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(day);
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
                if (isWorking) activeDaysCount++;
                else idleDates.push(day);
            });

            return {
                name: dev,
                idleDays: idleDates.length,
                totalDays: days.length,
                activeDays: activeDaysCount,
                idleDates
            };
        }).sort((a, b) => b.idleDays - a.idleDays);

    }, [data, selectedSprint, workDays]);

    return (
        <div className="space-y-6">
            <div className="card glass-morphism p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-indigo-500" />
                        Idle Time
                    </h2>

                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">Select Sprint:</span>
                        <select
                            value={selectedSprint}
                            onChange={(e) => setSelectedSprint(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {sprints.map(sprint => (
                                <option key={sprint} value={sprint}>{sprint}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Developer</th>
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Idle Days</th>
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Sprint Duration</th>
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Status</th>
                                <th className="text-right py-4 px-4 text-slate-400 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {idleStats.map((stat, idx) => (
                                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <User size={14} />
                                            </div>
                                            <span className="font-medium text-slate-200">{stat.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stat.idleDays > 5 ? 'bg-red-500/10 text-red-400' :
                                            stat.idleDays > 2 ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-green-500/10 text-green-400'
                                            }`}>
                                            {stat.idleDays} days
                                        </span>
                                        {stat.idleDays > 0 && (
                                            <div className="text-xs text-slate-400 mt-1" title="Idle day numbers (day of month)">
                                                ({formatIdleDayRanges(stat.idleDates)})
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 text-slate-400">
                                        {stat.totalDays} days
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="w-full bg-slate-700 rounded-full h-2 max-w-[100px]">
                                            <div
                                                className="bg-indigo-500 h-2 rounded-full"
                                                style={{ width: `${(stat.activeDays / stat.totalDays) * 100}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <button
                                            onClick={() => onNavigateToSprint(selectedSprint, stat.name)}
                                            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 justify-end"
                                        >
                                            View Sprint <ArrowRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {idleStats.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        No data available for the selected sprint
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default IdleTimeView;
