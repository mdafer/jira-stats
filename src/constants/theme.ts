export const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const TABS = {
    OVERVIEW: 'overview',
    DEVS: 'developers',
    SPRINTS: 'sprints',
    TASKS: 'tasks',
    IDLE_TIME: 'idle_time',
    SETTINGS: 'settings'
} as const;

export type TabType = typeof TABS[keyof typeof TABS];

export const JIRA_DOMAIN = 'https://mehe-modernization-division.atlassian.net';
