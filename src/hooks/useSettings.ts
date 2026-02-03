import { useState, useEffect } from 'react';

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export interface AppSettings {
    workDays: number[];
}

export const useSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const stored = localStorage.getItem('jira_dashboard_settings');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
        return {
            workDays: DEFAULT_WORK_DAYS
        };
    });

    useEffect(() => {
        localStorage.setItem('jira_dashboard_settings', JSON.stringify(settings));
    }, [settings]);

    const updateWorkDays = (days: number[]) => {
        setSettings(prev => ({
            ...prev,
            workDays: days
        }));
    };

    return {
        settings,
        updateWorkDays
    };
};
