import React, { useState, useMemo } from 'react';
import { Calendar, User, ArrowRight } from 'lucide-react';
import type { JiraTask } from '../types/jira';

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

        // Determine Sprint Range based on task limits in lieu of explicit Sprint Start/End dates
        let minDate = new Date(8640000000000000);
        let maxDate = new Date(-8640000000000000);
        let hasDates = false;

        sprintTasks.forEach(task => {
            if (task.SprintStart) {
                const date = new Date(task.SprintStart);
                if (date < minDate) minDate = date;
                hasDates = true;
            }
            if (task.SprintEnd) {
                const date = new Date(task.SprintEnd);
                if (date > maxDate) maxDate = date;
                hasDates = true;
            }
        });

        // Fallback to task updates if sprint dates missing, or today if active
        // Ideally we should trust the SprintStart/End if populated.
        // If not populated (e.g. kanban board without strict sprints), this view might be tricky.
        if (!hasDates) {
            return [];
        }

        // Normalize dates to midnight to ignore time components for "day" comparison
        const startDate = new Date(minDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(maxDate);
        endDate.setHours(23, 59, 59, 999);

        // Generate array of calendar days in sprint
        const days: Date[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            // Check if current day is a work day
            if (workDays.includes(current.getDay())) {
                days.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
        }

        const developers = Array.from(new Set(sprintTasks.map(t => t.AssigneeName).filter(Boolean)));

        // Define statuses that count as "Active Work"
        const ACTIVE_STATUS_KEYWORDS = ['In Progress', 'In Development'];

        return developers.map(dev => {
            const devTasks = sprintTasks.filter(t => t.AssigneeName === dev);
            let activeDaysCount = 0;
            const idleDates: Date[] = [];

            days.forEach(day => {
                // Check if day is a weekend (Saturday=6, Sunday=0) for cleaner "Work" stats?
                // User said "idle days are dates with no tasks in progress". Doesn't explicitly exclude weekends.
                // We'll trust the strict definition first.

                const dayStart = new Date(day);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(day);
                dayEnd.setHours(23, 59, 59, 999);

                let isWorking = false;

                for (const task of devTasks) {
                    if (task.Stages) {
                        for (const stage of task.Stages) {
                            // 1. Strict status check
                            const s = stage.status.toLowerCase();
                            const isActive = ACTIVE_STATUS_KEYWORDS.some(k => s.includes(k.toLowerCase()));

                            if (isActive) {
                                // 2. Check date overlap with day interval
                                const stageStart = new Date(stage.start);
                                const stageEnd = stage.end ? new Date(stage.end) : new Date(); // If null, assume ongoing

                                // Intersection check: [dayStart, dayEnd] overlaps [stageStart, stageEnd]
                                // Overlap condition: StartA <= EndB && EndA >= StartB
                                if (dayStart <= stageEnd && dayEnd >= stageStart) {
                                    isWorking = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isWorking) break;
                }

                if (isWorking) {
                    activeDaysCount++;
                } else {
                    idleDates.push(day);
                }
            });

            return {
                name: dev,
                idleDays: idleDates.length,
                totalDays: days.length,
                activeDays: activeDaysCount,
                idleDates // We could expose this to UI if needed
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
