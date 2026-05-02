import React, { useMemo, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import type { JiraTask } from '../types/jira';
import { round1dec, workDayDurationFromIntervals } from '../utils/dateUtils';
import {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

interface ReportsViewProps {
    data: JiraTask[];
    workDays: number[];
}

const ACTIVE_STATUS_KEYWORDS = ['in progress', 'in development'];
const isActiveStatus = (status: string) => {
    const s = status.toLowerCase();
    return ACTIVE_STATUS_KEYWORDS.some(k => s.includes(k));
};

const COLUMN_KEYS = ['id', 'name', 'epic', 'status', 'points', 'timeSpent', 'firstActive', 'lastActive'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
    id: 'Task ID',
    name: 'Name',
    epic: 'Epic',
    status: 'Status',
    points: 'Story Points',
    timeSpent: 'Time Spent (work days)',
    firstActive: 'First Active',
    lastActive: 'Last Active',
};

interface TaskRow {
    task: JiraTask;
    timeSpentDays: number;
    firstActive: number;
    lastActive: number;
}

interface DevSection {
    dev: string;
    tasks: TaskRow[];
}

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfMonthIso = () => {
    const d = new Date();
    return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};
const todayIso = () => toIsoDate(new Date());
const formatDateShort = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const inputStyle: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid var(--border)',
    color: 'white',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    colorScheme: 'dark',
};

const ReportsView: React.FC<ReportsViewProps> = ({ data, workDays }) => {
    const [from, setFrom] = useState(startOfMonthIso());
    const [to, setTo] = useState(todayIso());
    const [columns, setColumns] = useState<Set<ColumnKey>>(new Set(COLUMN_KEYS));
    const [exporting, setExporting] = useState(false);

    const fromMs = useMemo(() => {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }, [from]);
    const toMs = useMemo(() => {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        return d.getTime();
    }, [to]);

    const sections: DevSection[] = useMemo(() => {
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];

        const byDev = new Map<string, Map<string, { task: JiraTask; intervals: { start: number; end: number }[] }>>();

        for (const task of data) {
            for (const stage of task.Stages || []) {
                if (!isActiveStatus(stage.status)) continue;
                const dev = stage.assignee;
                if (!dev || dev === 'Unassigned') continue;
                const sStart = new Date(stage.start).getTime();
                const sEnd = new Date(stage.end).getTime();
                const clipStart = Math.max(sStart, fromMs);
                const clipEnd = Math.min(sEnd, toMs);
                if (clipStart >= clipEnd) continue;

                if (!byDev.has(dev)) byDev.set(dev, new Map());
                const taskMap = byDev.get(dev)!;
                if (!taskMap.has(task.ID)) taskMap.set(task.ID, { task, intervals: [] });
                taskMap.get(task.ID)!.intervals.push({ start: clipStart, end: clipEnd });
            }
        }

        return Array.from(byDev.entries())
            .map(([dev, taskMap]) => {
                const tasks: TaskRow[] = Array.from(taskMap.values()).map(({ task, intervals }) => {
                    const firstActive = Math.min(...intervals.map(i => i.start));
                    const lastActive = Math.max(...intervals.map(i => i.end));
                    return {
                        task,
                        timeSpentDays: round1dec(workDayDurationFromIntervals(intervals, workDays)),
                        firstActive,
                        lastActive,
                    };
                }).sort((a, b) => a.firstActive - b.firstActive);
                return { dev, tasks };
            })
            .sort((a, b) => a.dev.localeCompare(b.dev));
    }, [data, fromMs, toMs, workDays]);

    const totalTasks = sections.reduce((s, sec) => s + sec.tasks.length, 0);

    const toggleColumn = (key: ColumnKey) => {
        setColumns(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const cellText = (row: TaskRow, key: ColumnKey): string => {
        switch (key) {
            case 'id': return row.task.ID;
            case 'name': return row.task.Name;
            case 'epic': return row.task.Epic || '–';
            case 'status': return row.task.Status;
            case 'points': return row.task.StoryPoints ? String(row.task.StoryPoints) : '–';
            case 'timeSpent': return `${row.timeSpentDays} d`;
            case 'firstActive': return formatDateShort(row.firstActive);
            case 'lastActive': return formatDateShort(row.lastActive);
        }
    };

    const exportWord = async () => {
        if (sections.length === 0 || columns.size === 0) return;
        setExporting(true);
        try {
            const orderedColumns = COLUMN_KEYS.filter(k => columns.has(k));

            const headerCell = (text: string) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
                    shading: { fill: 'E2E8F0' },
                });

            const dataCell = (text: string) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
                });

            const docChildren: Paragraph[] | (Paragraph | Table)[] = [];

            docChildren.push(
                new Paragraph({
                    text: 'Developer Activity Report',
                    heading: HeadingLevel.HEADING_1,
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Range: ', bold: true }),
                        new TextRun({ text: `${formatDateShort(fromMs)} – ${formatDateShort(toMs)}` }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Activity counted: ', bold: true }),
                        new TextRun({ text: 'In Progress / In Development (Code Review and Ready for QA excluded).' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Developers: ', bold: true }),
                        new TextRun({ text: `${sections.length}` }),
                        new TextRun({ text: '   ·   ' }),
                        new TextRun({ text: 'Tasks: ', bold: true }),
                        new TextRun({ text: `${totalTasks}` }),
                    ],
                }),
                new Paragraph({ text: '' }),
            );

            for (const section of sections) {
                docChildren.push(
                    new Paragraph({
                        text: `${section.dev} — ${section.tasks.length} task${section.tasks.length === 1 ? '' : 's'}`,
                        heading: HeadingLevel.HEADING_2,
                    }),
                );

                const headerRow = new TableRow({
                    tableHeader: true,
                    children: orderedColumns.map(k => headerCell(COLUMN_LABELS[k])),
                });
                const bodyRows = section.tasks.map(row =>
                    new TableRow({
                        children: orderedColumns.map(k => dataCell(cellText(row, k))),
                    }),
                );

                const borders = {
                    top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                    left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                    right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                };

                docChildren.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...bodyRows],
                        borders,
                    }) as any,
                    new Paragraph({ text: '' }),
                );
            }

            const doc = new Document({
                creator: 'Jira Stats',
                title: 'Developer Activity Report',
                sections: [{ children: docChildren as any }],
            });

            const blob = await Packer.toBlob(doc);
            saveAs(blob, `activity-report-${from}-to-${to}.docx`);
        } finally {
            setExporting(false);
        }
    };

    const noColumns = columns.size === 0;
    const noData = sections.length === 0;

    return (
        <div className="card glass-morphism">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <FileText color="#6366f1" />
                <h3 style={{ margin: 0 }}>Developer Activity Report</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Tasks each developer was actively working on (status In Progress / In Development) during the chosen range.
                Code Review and Ready for QA do not count.
            </p>

            {/* Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    From
                    <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    To
                    <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} />
                </label>
                <button
                    onClick={exportWord}
                    disabled={exporting || noData || noColumns}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: (exporting || noData || noColumns) ? 'var(--border)' : 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        padding: '0.6rem 1rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: (exporting || noData || noColumns) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        marginLeft: 'auto',
                    }}
                    title={noColumns ? 'Select at least one column' : noData ? 'No activity in selected range' : 'Export to Word (.docx)'}
                >
                    <Download size={16} />
                    {exporting ? 'Generating…' : 'Export to Word'}
                </button>
            </div>

            {/* Column selector */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Columns</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {COLUMN_KEYS.map(key => {
                        const checked = columns.has(key);
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggleColumn(key)}
                                style={{
                                    fontSize: '0.75rem',
                                    color: checked ? 'white' : 'var(--text-muted)',
                                    background: checked ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${checked ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                                    borderRadius: '999px',
                                    padding: '0.3rem 0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <span
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 2,
                                        border: '1px solid var(--border)',
                                        background: checked ? 'var(--primary)' : 'transparent',
                                        flexShrink: 0,
                                    }}
                                />
                                {COLUMN_LABELS[key]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Developers: <strong style={{ color: 'white' }}>{sections.length}</strong></span>
                <span>Tasks: <strong style={{ color: 'white' }}>{totalTasks}</strong></span>
            </div>

            {/* Preview */}
            {noData ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.4)', borderRadius: '8px' }}>
                    No active development found in this range.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {sections.map(section => (
                        <div key={section.dev}>
                            <h4 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {section.dev}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                    · {section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}
                                </span>
                            </h4>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            {COLUMN_KEYS.filter(k => columns.has(k)).map(k => (
                                                <th key={k}>{COLUMN_LABELS[k]}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.tasks.map(row => (
                                            <tr key={row.task.ID}>
                                                {COLUMN_KEYS.filter(k => columns.has(k)).map(k => (
                                                    <td key={k} style={k === 'id' ? { whiteSpace: 'nowrap', fontWeight: 600 } : k === 'name' ? { maxWidth: '360px' } : undefined}>
                                                        {k === 'id' ? (
                                                            <a href={row.task.Link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                                                {row.task.ID}
                                                            </a>
                                                        ) : (
                                                            cellText(row, k)
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReportsView;
