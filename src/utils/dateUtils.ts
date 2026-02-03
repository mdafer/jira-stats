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
