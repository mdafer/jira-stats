import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    key: string;
    direction: SortDirection;
}

export const useTableSort = <T>(data: T[], defaultKey?: string, defaultDir: SortDirection = 'asc') => {
    const [sort, setSort] = useState<SortConfig | null>(
        defaultKey ? { key: defaultKey, direction: defaultDir } : null
    );

    const toggleSort = useCallback((key: string) => {
        setSort(prev => {
            if (prev?.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    }, []);

    const sorted = useMemo(() => {
        if (!sort) return data;
        const { key, direction } = sort;
        return [...data].sort((a: any, b: any) => {
            let aVal = typeof key === 'string' && key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], a) : a[key];
            let bVal = typeof key === 'string' && key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], b) : b[key];

            // Handle nullish
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Strings
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
            return direction === 'asc' ? cmp : -cmp;
        });
    }, [data, sort]);

    return { sorted, sort, toggleSort };
};
