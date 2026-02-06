/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROJECT_TITLE: string
  readonly VITE_JIRA_DOMAIN: string
  readonly VITE_JIRA_EMAIL: string
  readonly VITE_JIRA_TOKEN: string
  readonly VITE_JIRA_JQL: string
  readonly VITE_CACHE_TTL_MINUTES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string;
