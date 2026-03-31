import type { Request, Response } from 'express';
import { fetchJiraIssues } from '../services/jiraService.js';
import * as database from '../models/database.js';

export const getTasks = async (_req: Request, res: Response) => {
    try {
        const tasks = database.getTasks();
        const metadata = database.getMetadata();

        // Serve from cache if populated
        if (tasks.length > 0) {
            res.json({ tasks, metadata, fromCache: true });
            return;
        }

        // Empty cache — do initial fetch from Jira
        const fetchedTasks = await fetchJiraIssues();
        const jql = process.env.JIRA_JQL || 'project = "AM" order by created DESC';
        database.saveTasks(fetchedTasks, jql);
        const newMetadata = database.getMetadata();

        res.json({ tasks: fetchedTasks, metadata: newMetadata, fromCache: false });
    } catch (err: any) {
        console.error('[getTasks] Jira fetch failed:', err.message);
        res.status(502).json({ error: err.message, tasks: [], metadata: null });
    }
};

export const refreshTasks = async (_req: Request, res: Response) => {
    try {
        const tasks = await fetchJiraIssues();
        const jql = process.env.JIRA_JQL || 'project = "AM" order by created DESC';
        database.saveTasks(tasks, jql);
        database.deleteRemovedTasks(tasks.map(t => t.ID));
        const metadata = database.getMetadata();

        res.json({ tasks: database.getTasks(), metadata, fromCache: false });
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
