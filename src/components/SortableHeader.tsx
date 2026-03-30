import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortConfig } from '../hooks/useTableSort';

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    sort: SortConfig | null;
    onToggle: (key: string) => void;
    children?: React.ReactNode;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ label, sortKey, sort, onToggle, children }) => {
    const active = sort?.key === sortKey;
    return (
        <th
            onClick={() => onToggle(sortKey)}
            style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                {label}
                {children}
                {active
                    ? sort!.direction === 'asc'
                        ? <ChevronUp size={14} style={{ opacity: 0.9 }} />
                        : <ChevronDown size={14} style={{ opacity: 0.9 }} />
                    : <ChevronsUpDown size={14} style={{ opacity: 0.3 }} />
                }
            </span>
        </th>
    );
};

export default SortableHeader;
