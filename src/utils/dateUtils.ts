export const round1dec = (num: number): number => {
    return Math.round(num * 10) / 10;
};

export const dateDiffDays = (from: Date, to: Date): number => {
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return diffTime / (1000 * 60 * 60 * 24);
};

export const mergeIntervals = (intervals: { start: number; end: number }[]): number => {
    if (intervals.length === 0) return 0;
    // Sort by start time
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];

    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start <= current.end) {
            current.end = Math.max(current.end, sorted[i].end);
        } else {
            merged.push(current);
            current = sorted[i];
        }
    }
    merged.push(current);

    const totalMs = merged.reduce((acc, interval) => acc + (interval.end - interval.start), 0);
    return totalMs / 1000 / 3600 / 24; // convert to days
};

/** Count work days (exclude days off) overlapping [startMs, endMs]. Used for "time in progress" so days off are not counted. */
export const workDaysInRange = (startMs: number, endMs: number, workDays: number[]): number => {
    const start = new Date(startMs);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endMs);
    end.setHours(23, 59, 59, 999);
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        if (workDays.includes(current.getDay())) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
};

/** Total "time in progress" in days, counting only work days (days off excluded). */
export const workDayDurationFromIntervals = (intervals: { start: number; end: number }[], workDays: number[]): number => {
    if (intervals.length === 0 || workDays.length === 0) return 0;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start <= current.end) {
            current.end = Math.max(current.end, sorted[i].end);
        } else {
            merged.push(current);
            current = sorted[i];
        }
    }
    merged.push(current);
    return merged.reduce((acc, iv) => acc + workDaysInRange(iv.start, iv.end, workDays), 0);
};

/** Format idle dates as compact ranges: "1, 3" or "5-8" (day of month; consecutive merged). */
export const formatIdleDayRanges = (dates: Date[]): string => {
    if (dates.length === 0) return '';
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const parts: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const d = sorted[i];
        const diffDays = (d.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
        if (diffDays === 1) end = d;
        else {
            parts.push(start.getTime() === end.getTime() ? String(start.getDate()) : `${start.getDate()}-${end.getDate()}`);
            start = d;
            end = d;
        }
    }
    parts.push(start.getTime() === end.getTime() ? String(start.getDate()) : `${start.getDate()}-${end.getDate()}`);
    return parts.join(', ');
};
