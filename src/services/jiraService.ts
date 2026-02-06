import type { JiraTask } from '../types/jira';
import { populateStages } from '../utils/jiraUtils';

const JIRA_DOMAIN = import.meta.env.VITE_JIRA_DOMAIN;
export const fetchJiraIssues = async (
    email: string,
    token: string,
    jql: string,
    onProgress?: (fetched: number, total: number) => void
): Promise<JiraTask[]> => {
    const basicAuth = btoa(`${email}:${token}`);

    const getHeaders = (useBearer: boolean) => {
        const h: any = {
            'Accept': 'application/json',
            'X-Atlassian-Token': 'no-check',
            'User-Agent': 'Jira-Data-Extractor'
        };
        if (useBearer) {
            h['Authorization'] = `Bearer ${token}`;
        } else {
            h['Authorization'] = `Basic ${basicAuth}`;
        }
        return h;
    };

    const batchSize = 100;
    let allIssues: any[] = [];
    let useBearer = false;
    const maxIterations = 50; // Safety cap
    let iteration = 0;
    let nextPageToken: string | null = null;
    let isLast = false;

    while (!isLast && iteration < maxIterations) {
        // Use /jira proxy path instead of direct JIRA_DOMAIN to avoid CORS issues
        let url = `/jira/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${batchSize}&expand=changelog&fields=*all`;

        if (nextPageToken) {
            url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
        }

        let response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(useBearer)
        });

        if ((response.status === 403 || response.status === 401) && !useBearer) {
            useBearer = true;
            response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(true)
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API ${response.status}: ${errorText.substring(0, 100)}`);
        }

        const result = await response.json();
        const currentBatchSize = result.issues?.length || 0;

        if (currentBatchSize === 0) {
            break;
        }

        // Filter out duplicates using ID
        const newIssues = result.issues.filter((issue: any) => !allIssues.some(existing => existing.key === issue.key));

        if (newIssues.length === 0) {
            break;
        }

        allIssues = [...allIssues, ...newIssues];

        // Update pagination state
        isLast = result.isLast === true; // Ensure boolean
        nextPageToken = result.nextPageToken || null;

        if (onProgress) {
            // We don't know total with this endpoint, so just send current count
            onProgress(allIssues.length, allIssues.length);
        }

        iteration++;
    }

    if (iteration >= maxIterations) {
        console.warn(`[Jira Fetch] ⚠️ Reached maximum iterations (${maxIterations}), stopping fetch`);
    }

    return allIssues.map(issue => transformIssue(issue));
};

const transformIssue = (issue: any): JiraTask => {
    const intervals = populateStages(issue);
    const stageObj: Record<string, number> = {};

    intervals.forEach(interval => {
        stageObj[interval.status] = (stageObj[interval.status] || 0) + interval.duration;
    });

    let sprintName = 'Backlog';
    let sprintStart: string | undefined;
    let sprintEnd: string | undefined;
    let storyPoints = 0;

    Object.keys(issue.fields).forEach(key => {
        // Detect Sprint
        if (key.includes('customfield_') && Array.isArray(issue.fields[key])) {
            const sprintData = issue.fields[key][0];
            if (sprintData && sprintData.name) {
                sprintName = sprintData.name;
                sprintStart = sprintData.startDate;
                sprintEnd = sprintData.endDate || sprintData.completeDate;
            }
        }
        // Detect Story Points common custom field IDs
        if (key === 'customfield_10016' || key === 'customfield_10002') {
            storyPoints = Number(issue.fields[key]) || 0;
        }
    });

    return {
        ID: issue.key,
        Link: `${JIRA_DOMAIN}/browse/${issue.key}`,
        Name: issue.fields.summary,
        Type: issue.fields.issuetype?.name || 'Task',
        AssigneeName: issue.fields.assignee?.displayName || 'Unassigned',
        Status: issue.fields.status?.name || 'Unknown',
        StatusCategory: issue.fields.status?.statusCategory?.name || 'To Do',
        Sprint: sprintName,
        SprintStart: sprintStart,
        SprintEnd: sprintEnd,
        TimeSpent: issue.fields.timespent ? issue.fields.timespent / 3600 / 8 : 0, // days
        StagesDurations: stageObj,
        Stages: intervals.map(i => ({
            status: i.status,
            start: i.start.toISOString(),
            end: i.end.toISOString(),
            duration: i.duration,
            assignee: i.assignee
        })),
        Created: issue.fields.created,
        StoryPoints: storyPoints
    };
};
