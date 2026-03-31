import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { initDatabase, saveTasks, getTasks, deleteRemovedTasks } from './models/database.js';
import { fetchJiraIssues } from './services/jiraService.js';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDatabase();

// Routes
app.use('/api', tasksRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

const SYNC_INTERVAL_MINUTES = Number(process.env.SYNC_INTERVAL_MINUTES) || 30;

const runIncrementalSync = async () => {
    try {
        const jql = process.env.JIRA_JQL || 'project = "AM" order by created DESC';
        const tasks = await fetchJiraIssues();
        saveTasks(tasks, jql);
        deleteRemovedTasks(tasks.map(t => t.ID));
        console.log(`[sync] Incremental update complete — ${getTasks().length} tasks cached`);
    } catch (err: any) {
        console.error('[sync] Incremental update failed:', err.message);
    }
};

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`[sync] Incremental sync every ${SYNC_INTERVAL_MINUTES} minute(s)`);
    setInterval(runIncrementalSync, SYNC_INTERVAL_MINUTES * 60 * 1000);
});
