import React from 'react';
import { Layers, CheckCircle2, Clock, Timer } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import type { Metrics } from '../types/jira';
import { round1dec } from '../utils/dateUtils';
import { COLORS } from '../constants/theme';
import MetricsCard from './MetricsCard';

interface OverviewProps {
    metrics: Metrics;
    onNavigateToSprint: (sprintName: string) => void;
}

const Overview: React.FC<OverviewProps> = ({ metrics, onNavigateToSprint }) => {
    return (
        <>
            <div className="metrics-grid">
                <MetricsCard
                    label="Total Tasks"
                    value={metrics.totalTasks}
                    icon={<Layers size={20} color="var(--primary)" />}
                />
                <MetricsCard
                    label="Completion"
                    value={`${metrics.completionRate}%`}
                    icon={<CheckCircle2 size={20} color="var(--success)" />}
                    progress={{ percent: metrics.completionRate, color: 'var(--success)' }}
                />
                <MetricsCard
                    label="Total Points"
                    value={metrics.totalStoryPoints}
                    icon={<Clock size={20} color="var(--warning)" />}
                    subtitle="story points"
                />
                <MetricsCard
                    label="Lead Time (Avg)"
                    value={round1dec(metrics.totalTimeSpent / metrics.totalTasks)}
                    icon={<Timer size={20} color="var(--accent)" />}
                    subtitle="avg days per issue"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                <div className="card glass-morphism">
                    <h3>Points by Sprint</h3>
                    <div style={{ height: '300px', marginTop: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={metrics.sprintStats}
                                onClick={(data) => {
                                    if (data && data.activeLabel) {
                                        onNavigateToSprint(data.activeLabel);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }} />
                                <Bar dataKey="points" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Points" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="card glass-morphism">
                    <h3>Status Distribution</h3>
                    <div style={{ height: '300px', marginTop: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.statusStats}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {metrics.statusStats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Overview;
