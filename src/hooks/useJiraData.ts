import { useState, useEffect, useMemo, useCallback } from 'react';
import type { JiraTask, Metrics } from '../types/jira';
import { apiClient, type CacheMetadata } from '../services/jiraService';
import { round1dec } from '../utils/dateUtils';

export const useJiraData = () => {
    const [data, setData] = useState<JiraTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | null>(null);
    const [isFromCache, setIsFromCache] = useState(false);

    const fetchData = useCallback(async (forceRefresh: boolean = false) => {
        setRefreshing(true);
        setError(null);

        try {
            const result = forceRefresh
                ? await apiClient.refreshTasks()
                : await apiClient.getTasks();

            setData(result.tasks);
            setCacheMetadata(result.metadata);
            setIsFromCache(result.fromCache);

            if (result.error) {
                setError(result.error);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const metrics = useMemo((): Metrics | null => {
        if (data.length === 0) return null;

        const totalTasks = data.length;
        const completedTasks = data.filter(t => t.StatusCategory === 'Done').length;

        const devStats: Record<string, { time: number; tasks: number; points: number }> = {};
        const sprintStats: Record<string, { time: number; tasks: number; points: number }> = {};
        const statusStats: Record<string, number> = {};

        data.forEach(task => {
            const devCycleStatuses = ['progress', 'review', 'developing', 'implementing'];
            const devDuration = Object.entries(task.StagesDurations || {}).reduce((sum, [status, duration]) => {
                const s = status.toLowerCase();
                if (devCycleStatuses.some(k => s.includes(k)) && !s.includes('ready for qa') && !s.includes('in qa')) {
                    return sum + duration;
                }
                return sum;
            }, 0);

            const points = task.StoryPoints || 0;

            if (!devStats[task.AssigneeName]) devStats[task.AssigneeName] = { time: 0, tasks: 0, points: 0 };
            devStats[task.AssigneeName].time += devDuration;
            devStats[task.AssigneeName].tasks += 1;
            devStats[task.AssigneeName].points += points;

            if (!sprintStats[task.Sprint]) sprintStats[task.Sprint] = { time: 0, tasks: 0, points: 0 };
            sprintStats[task.Sprint].time += devDuration;
            sprintStats[task.Sprint].tasks += 1;
            sprintStats[task.Sprint].points += points;

            statusStats[task.Status] = (statusStats[task.Status] || 0) + 1;
        });

        return {
            totalTasks,
            completedTasks,
            completionRate: Math.round((completedTasks / totalTasks) * 100),
            totalTimeSpent: round1dec(data.reduce((acc, t) => acc + (t.TimeSpent > 0 ? t.TimeSpent : Object.values(t.StagesDurations).reduce((s, v) => s + v, 0)), 0)),
            totalStoryPoints: data.reduce((acc, t) => acc + (t.StoryPoints || 0), 0),
            devStats: Object.entries(devStats).map(([name, stats]) => ({ name, ...stats })),
            sprintStats: Object.entries(sprintStats).map(([name, stats]) => ({ name, ...stats })),
            statusStats: Object.entries(statusStats).map(([name, value]) => ({ name, value }))
        };
    }, [data]);

    return {
        data,
        loading,
        refreshing,
        error,
        metrics,
        refresh: fetchData,
        cacheMetadata,
        isFromCache,
        clearCache: async () => {
            await apiClient.clearCache();
            await fetchData(true);
        }
    };
};
