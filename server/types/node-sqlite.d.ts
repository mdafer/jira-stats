declare module 'node:sqlite' {
    export class DatabaseSync {
        constructor(path: string, options?: { open?: boolean });
        exec(sql: string): void;
        prepare(sql: string): StatementSync;
        close(): void;
    }

    export interface StatementSync {
        run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
        get(...params: any[]): Record<string, any> | undefined;
        all(...params: any[]): Record<string, any>[];
    }
}
