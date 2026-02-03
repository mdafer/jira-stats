import React, { useState, useMemo } from 'react';
import { Zap, User, ArrowRight } from 'lucide-react';
import type { JiraTask } from '../types/jira';

interface OvertimeViewProps {
    data: JiraTask[];
    onNavigateToSprint: (sprintName: string) => void;
    workDays: number[];
}

const OvertimeView: React.FC<OvertimeViewProps> = ({ data, onNavigateToSprint, workDays }) => {
    const [selectedSprint, setSelectedSprint] = useState<string>('');

    // Extract unique sprints
    const sprints = useMemo(() => {
        const uniqueSprints = Array.from(new Set(data.map(task => task.Sprint).filter(Boolean)));
        return uniqueSprints.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [data]);

    // Set default sprint
    React.useEffect(() => {
        if (!selectedSprint && sprints.length > 0) {
            const numberedSprints = sprints.filter(s => /Sprint\s+\d+/i.test(s));

            if (numberedSprints.length > 0) {
                setSelectedSprint(numberedSprints[numberedSprints.length - 1]);
            } else {
                const validSprints = sprints.filter(s => !['Triage', 'Backlog', 'Kanban'].includes(s));
                setSelectedSprint(validSprints.length > 0 ? validSprints[validSprints.length - 1] : sprints[sprints.length - 1]);
            }
        }
    }, [sprints, selectedSprint]);

    const overtimeStats = useMemo(() => {
        if (!selectedSprint) return [];

        const sprintTasks = data.filter(t => t.Sprint === selectedSprint);
        if (sprintTasks.length === 0) return [];

        // Determine Sprint Range
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

        if (!hasDates) return [];

        // Normalize dates
        const startDate = new Date(minDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(maxDate);
        endDate.setHours(23, 59, 59, 999);

        // Identify non-workdays within the sprint range
        const nonWorkDates: Date[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            // If current day is NOT in workDays, it's a "non-workday" (potential overtime)
            if (!workDays.includes(current.getDay())) {
                nonWorkDates.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
        }

        const developers = Array.from(new Set(sprintTasks.map(t => t.AssigneeName).filter(Boolean)));

        const ACTIVE_STATUS_KEYWORDS = ['In Progress', 'In Development'];

        return developers.map(dev => {
            const devTasks = sprintTasks.filter(t => t.AssigneeName === dev);
            const overtimeDays: Date[] = [];

            nonWorkDates.forEach(day => {
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
                                // 2. Check overlap with this non-workday
                                const stageStart = new Date(stage.start);
                                const stageEnd = stage.end ? new Date(stage.end) : new Date();

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
                    overtimeDays.push(day);
                }
            });

            return {
                name: dev,
                overtimeDaysCount: overtimeDays.length,
                totalNonWorkDays: nonWorkDates.length,
                overtimeDates: overtimeDays
            };
        })
            .filter(stat => stat.overtimeDaysCount > 0) // Only show devs with overtime
            .sort((a, b) => b.overtimeDaysCount - a.overtimeDaysCount);

    }, [data, selectedSprint, workDays]);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <div className="card glass-morphism p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Zap className="w-6 h-6 text-amber-500" />
                        Overtime Tracker
                        <span className="text-sm font-normal text-gray-400 ml-2">(Work on non-workdays)</span>
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
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Overtime Days</th>
                                <th className="text-left py-4 px-4 text-slate-400 font-medium">Dates Worked</th>
                                <th className="text-right py-4 px-4 text-slate-400 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overtimeStats.map((stat, idx) => (
                                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                                                <User size={14} />
                                            </div>
                                            <span className="font-medium text-slate-200">{stat.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stat.overtimeDaysCount > 2 ? 'bg-red-500/10 text-red-400' :
                                                'bg-amber-500/10 text-amber-400'
                                            }`}>
                                            {stat.overtimeDaysCount} days
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-wrap gap-2">
                                            {stat.overtimeDates.map((date, i) => (
                                                <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                                    {formatDate(date)}
                                                </span>
                                            ))}
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
                            {overtimeStats.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Zap size={24} className="text-slate-600" />
                                            <span>No overtime detected for this sprint! 🎉</span>
                                        </div>
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

export default OvertimeView;
