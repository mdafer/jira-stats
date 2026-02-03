# Jira Analytics Dashboard

A Vite + React based dashboard to visualize performance metrics from your Jira data extraction.

## Features
- **Project Overview**: High-level metrics on total tasks, completion rates, and cumulative effort.
- **Sprint/Version Tracking**: Break down effort and task counts by sprint or fix version.
- **Developer Performance**: Metrics per developer, including total time spent and average task duration.
- **Task Explorer**: Detailed table of all tracked tasks with direct links to Jira.

## How to Update Data
1. Run your Jira Data Extractor tool to generate a new CSV.
2. Copy the resulting `.csv` file to `jira-dashboard/public/data.csv`.
3. The dashboard will automatically reflect the new data on the next reload.

## Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```
