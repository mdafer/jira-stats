import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import type { JiraTask, CacheMetadata } from '../types/jira.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, '..', 'data');
const DB_PATH = resolve(DB_DIR, 'cache.db');

let db: DatabaseSync;

export const initDatabase = () => {
    mkdirSync(DB_DIR, { recursive: true });

    db = new DatabaseSync(DB_PATH);

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            jql TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cache_metadata (
            key TEXT PRIMARY KEY DEFAULT 'main',
            last_fetch INTEGER NOT NULL,
            total_tasks INTEGER NOT NULL,
            jql TEXT NOT NULL
        );
    `);
};

export const saveTasks = (tasks: JiraTask[], jql: string) => {
    const now = Date.now();

    db.exec('BEGIN');
    try {
        const upsert = db.prepare('INSERT OR REPLACE INTO tasks (id, data, jql, updated_at) VALUES (?, ?, ?, ?)');
        for (const task of tasks) {
            upsert.run(task.ID, JSON.stringify(task), jql, now);
        }
        const totalTasks = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;
        db.prepare(`
            INSERT OR REPLACE INTO cache_metadata (key, last_fetch, total_tasks, jql)
            VALUES ('main', ?, ?, ?)
        `).run(now, totalTasks, jql);
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
};

export const getTasks = (): JiraTask[] => {
    const rows = db.prepare('SELECT data FROM tasks').all() as { data: string }[];
    return rows.map(row => JSON.parse(row.data));
};

export const getMetadata = (): CacheMetadata | null => {
    const row = db.prepare('SELECT last_fetch, total_tasks, jql FROM cache_metadata WHERE key = ?').get('main') as any;
    if (!row) return null;
    return {
        lastFetch: row.last_fetch,
        totalTasks: row.total_tasks,
        jql: row.jql
    };
};

export const deleteRemovedTasks = (currentIds: string[]) => {
    if (currentIds.length === 0) return;
    const placeholders = currentIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM tasks WHERE id NOT IN (${placeholders})`).run(...currentIds);
};

export const clearCache = () => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM cache_metadata').run();
};
