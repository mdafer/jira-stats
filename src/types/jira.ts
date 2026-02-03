export interface JiraTask {
    ID: string;
    Link: string;
    Name: string;
    Type: string;
    AssigneeName: string;
    Status: string;
    StatusCategory: string;
    Sprint: string;
    SprintStart?: string;
    SprintEnd?: string;
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

export interface SelectedSprintInfo {
    name: string;
    tasks: JiraTask[];
}

export interface MetricStats {
    time: number;
    tasks: number;
    points: number;
}

export interface Metrics {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalTimeSpent: number;
    totalStoryPoints: number;
    devStats: (MetricStats & { name: string })[];
    sprintStats: (MetricStats & { name: string })[];
    statusStats: { name: string; value: number }[];
}
