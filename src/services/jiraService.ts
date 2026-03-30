import type { JiraTask } from '../types/jira';

export interface CacheMetadata {
    lastFetch: number;
    totalTasks: number;
    jql: string;
}

export interface TasksResponse {
    tasks: JiraTask[];
    metadata: CacheMetadata | null;
    fromCache: boolean;
    error?: string;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
};

export const apiClient = {
    getTasks: (): Promise<TasksResponse> =>
        fetch(`${API_URL}/tasks`).then(handleResponse),

    refreshTasks: (): Promise<TasksResponse> =>
        fetch(`${API_URL}/tasks/refresh`, { method: 'POST' }).then(handleResponse),

    clearCache: (): Promise<{ success: boolean }> =>
        fetch(`${API_URL}/cache`, { method: 'DELETE' }).then(handleResponse),

    getCacheStatus: (): Promise<{ metadata: CacheMetadata | null }> =>
        fetch(`${API_URL}/cache/status`).then(handleResponse),
};
