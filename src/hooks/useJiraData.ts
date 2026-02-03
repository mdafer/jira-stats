import { useState, useEffect, useMemo, useCallback } from 'react';
import type { JiraTask, Metrics } from '../types/jira';
import { fetchJiraIssues } from '../services/jiraService';
import { cacheService, type CacheMetadata } from '../services/cacheService';
import { round1dec } from '../utils/dateUtils';

// Cache TTL in minutes (default: 12 hours)
const CACHE_TTL_MINUTES = Number(import.meta.env.VITE_CACHE_TTL_MINUTES) || 720;

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
            const email = import.meta.env.VITE_JIRA_EMAIL;
            const token = import.meta.env.VITE_JIRA_TOKEN;
            const jql = import.meta.env.VITE_JIRA_JQL || 'project = "AM" order by created DESC';

            // Check if cache is valid (unless force refresh)
            if (!forceRefresh) {
                const isCacheValid = await cacheService.isCacheValid(CACHE_TTL_MINUTES);

                if (isCacheValid) {
                    // Load from cache
                    const cachedTasks = await cacheService.getTasks();
                    const metadata = await cacheService.getMetadata();

                    if (cachedTasks.length > 0) {
                        setData(cachedTasks);
                        setCacheMetadata(metadata);
                        setIsFromCache(true);
                        setLoading(false);
                        setRefreshing(false);
                        return;
                    }
                }
            }

            // Fetch fresh data from API
            setIsFromCache(false);
            const transformed = await fetchJiraIssues(email, token, jql);

            // Save to cache
            await cacheService.saveTasks(transformed, jql);
            const metadata = await cacheService.getMetadata();

            setData(transformed);
            setCacheMetadata(metadata);
        } catch (e: any) {
            setError(e.message);

            // On error, try to load from cache as fallback
            try {
                const cachedTasks = await cacheService.getTasks();
                const metadata = await cacheService.getMetadata();
                if (cachedTasks.length > 0) {
                    setData(cachedTasks);
                    setCacheMetadata(metadata);
                    setIsFromCache(true);
                    setError(`${e.message} (showing cached data)`);
                }
            } catch {
                // Cache load failed too, keep the error
            }
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
            // Calculate Dev Time: Duration in 'In Progress' or 'Review' statuses
            // "in progress till ready for qa" -> We sum durations of development statuses
            const devCycleStatuses = ['progress', 'review', 'developing', 'implementing'];
            const devDuration = Object.entries(task.StagesDurations || {}).reduce((sum, [status, duration]) => {
                const s = status.toLowerCase();
                // Include if status matches dev keywords and is not a QA/Ready status explicitly
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
            await cacheService.clearCache();
            await fetchData(true);
        }
    };
};
