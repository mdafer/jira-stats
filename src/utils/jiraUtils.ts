import { dateDiffDays } from './dateUtils';

export const populateStages = (issue: any) => {
    const histories = issue.changelog?.histories || [];
    const created = new Date(issue.fields.created);
    const nowAt = new Date();

    // Initial status
    let lastDate = created;
    let currentStatus = 'To Do'; // Default fallback
    let currentAssignee = issue.fields.assignee?.displayName || 'Unassigned';

    const rawIntervals: { status: string; start: Date; end: Date; duration: number; assignee: string }[] = [];

    // Sort histories by date
    const sortedHistories = [...histories].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

    sortedHistories.forEach((h: any) => {
        const hDate = new Date(h.created);
        const statusChange = h.items.find((item: any) => item.field === 'status');
        const assigneeChange = h.items.find((item: any) => item.field === 'assignee');

        if (statusChange || assigneeChange) {
            const duration = dateDiffDays(lastDate, hDate);
            rawIntervals.push({
                status: currentStatus,
                start: lastDate,
                end: hDate,
                duration,
                assignee: currentAssignee
            });

            if (statusChange) currentStatus = statusChange.toString;
            if (assigneeChange) currentAssignee = assigneeChange.toString || 'Unassigned';
            lastDate = hDate;
        }
    });

    // Final interval until now
    const finalDuration = dateDiffDays(lastDate, nowAt);
    rawIntervals.push({
        status: currentStatus,
        start: lastDate,
        end: nowAt,
        duration: finalDuration,
        assignee: currentAssignee
    });

    // Merge contiguous intervals with the same status (or both are 'Done')
    const mergedIntervals: typeof rawIntervals = [];
    rawIntervals.forEach(interval => {
        const lastMerged = mergedIntervals[mergedIntervals.length - 1];
        const isDone = (s: string) => s.toLowerCase().includes('done');

        if (lastMerged && (lastMerged.status === interval.status || (isDone(lastMerged.status) && isDone(interval.status)))) {
            lastMerged.end = interval.end;
            lastMerged.duration += interval.duration;
        } else {
            mergedIntervals.push({ ...interval });
        }
    });

    return mergedIntervals;
};
