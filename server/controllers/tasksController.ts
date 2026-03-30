import type { Request, Response } from 'express';
import { fetchJiraIssues } from '../services/jiraService.js';
import * as database from '../models/database.js';

const CACHE_TTL_MINUTES = Number(process.env.CACHE_TTL_MINUTES) || 720;

export const getTasks = async (_req: Request, res: Response) => {
    try {
        // Check cache first
        if (database.isCacheValid(CACHE_TTL_MINUTES)) {
            const tasks = database.getTasks();
            const metadata = database.getMetadata();
            if (tasks.length > 0) {
                res.json({ tasks, metadata, fromCache: true });
                return;
            }
        }

        // Cache miss or empty — fetch from Jira
        const tasks = await fetchJiraIssues();
        const jql = process.env.JIRA_JQL || 'project = "AM" order by created DESC';
        database.saveTasks(tasks, jql);
        const metadata = database.getMetadata();

        res.json({ tasks, metadata, fromCache: false });
    } catch (err: any) {
        console.error('[getTasks] Jira fetch failed:', err.message);

        // Fallback to stale cache
        const tasks = database.getTasks();
        const metadata = database.getMetadata();
        if (tasks.length > 0) {
            res.json({
                tasks,
                metadata,
                fromCache: true,
                error: `${err.message} (showing cached data)`
            });
            return;
        }

        res.status(502).json({ error: err.message, tasks: [], metadata: null });
    }
};

export const refreshTasks = async (_req: Request, res: Response) => {
    try {
        const tasks = await fetchJiraIssues();
        const jql = process.env.JIRA_JQL || 'project = "AM" order by created DESC';
        database.saveTasks(tasks, jql);
        const metadata = database.getMetadata();

        res.json({ tasks, metadata, fromCache: false });
    } catch (err: any) {
        console.error('[refreshTasks] Jira fetch failed:', err.message);
        res.status(502).json({ error: err.message });
    }
};

export const clearCacheHandler = (_req: Request, res: Response) => {
    database.clearCache();
    res.json({ success: true });
};

export const getCacheStatus = (_req: Request, res: Response) => {
    const metadata = database.getMetadata();
    res.json({ metadata });
};
