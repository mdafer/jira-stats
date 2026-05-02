export interface SprintInfo {
    name: string;
    startDate?: string;
    endDate?: string;
    state?: string;
}

export interface JiraTask {
    ID: string;
    Link: string;
    Name: string;
    Type: string;
    Epic: string;
    AssigneeName: string;
    Status: string;
    StatusCategory: string;
    Sprint: string;
    SprintStart?: string;
    SprintEnd?: string;
    Sprints?: SprintInfo[];
    IsSubtask?: boolean;
    ParentID?: string;
    ParentName?: string;
    TimeSpent: number;
    StagesDurations: Record<string, number>;
    Stages: {
        status: string;
        start: string;
        end: string;
        duration: number;
        assignee: string;
    }[];
    Created: string;
    StoryPoints: number;
}

export interface CacheMetadata {
    lastFetch: number;
    totalTasks: number;
    jql: string;
}
