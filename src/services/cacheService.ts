import type { JiraTask } from '../types/jira';

const DB_NAME = 'jira-dashboard-cache';
const DB_VERSION = 1;
const TASKS_STORE = 'tasks';
const METADATA_STORE = 'metadata';

export interface CacheMetadata {
    key: string;
    lastFetch: number;
    totalTasks: number;
    jql: string;
}

class CacheService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Tasks store
                if (!db.objectStoreNames.contains(TASKS_STORE)) {
                    const tasksStore = db.createObjectStore(TASKS_STORE, { keyPath: 'ID' });
                    tasksStore.createIndex('jql', 'jql', { unique: false });
                    tasksStore.createIndex('Sprint', 'Sprint', { unique: false });
                    tasksStore.createIndex('AssigneeName', 'AssigneeName', { unique: false });
                }

                // Metadata store
                if (!db.objectStoreNames.contains(METADATA_STORE)) {
                    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
                }
            };
        });
    }

    async saveTasks(tasks: JiraTask[], jql: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([TASKS_STORE, METADATA_STORE], 'readwrite');
            const tasksStore = transaction.objectStore(TASKS_STORE);
            const metadataStore = transaction.objectStore(METADATA_STORE);

            // Clear existing tasks for this JQL
            const clearRequest = tasksStore.clear();

            clearRequest.onsuccess = () => {
                // Save all tasks
                tasks.forEach(task => {
                    tasksStore.put({ ...task, jql });
                });

                // Update metadata
                const metadata: CacheMetadata = {
                    key: 'jira-tasks',
                    lastFetch: Date.now(),
                    totalTasks: tasks.length,
                    jql
                };
                metadataStore.put(metadata);
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getTasks(): Promise<JiraTask[]> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(TASKS_STORE, 'readonly');
            const store = transaction.objectStore(TASKS_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                const tasks = request.result.map(task => {
                    // Remove the jql field we added for indexing
                    const { jql, ...taskData } = task;
                    return taskData as JiraTask;
                });
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getMetadata(): Promise<CacheMetadata | null> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(METADATA_STORE, 'readonly');
            const store = transaction.objectStore(METADATA_STORE);
            const request = store.get('jira-tasks');

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async isCacheValid(maxAgeMinutes: number = 30): Promise<boolean> {
        const metadata = await this.getMetadata();
        if (!metadata) return false;

        const ageMs = Date.now() - metadata.lastFetch;
        const ageMinutes = ageMs / (1000 * 60);
        return ageMinutes < maxAgeMinutes;
    }

    async clearCache(): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([TASKS_STORE, METADATA_STORE], 'readwrite');

            transaction.objectStore(TASKS_STORE).clear();
            transaction.objectStore(METADATA_STORE).clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getCacheSize(): Promise<number> {
        if (!navigator.storage?.estimate) return 0;

        try {
            const estimate = await navigator.storage.estimate();
            return estimate.usage || 0;
        } catch {
            return 0;
        }
    }
}

export const cacheService = new CacheService();
