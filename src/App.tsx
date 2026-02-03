import React, { useState } from 'react';
import { useJiraData } from './hooks/useJiraData';
import type { TabType } from './constants/theme';
import { TABS } from './constants/theme';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import DeveloperTable from './components/DeveloperTable';
import SprintView from './components/SprintView';
import IssueExplorer from './components/IssueExplorer';
import LoadingScreen from './components/LoadingScreen';
import ErrorMessage from './components/ErrorMessage';
import SettingsView from './components/SettingsView';

import IdleTimeView from './components/IdleTimeView';
import OvertimeView from './components/OvertimeView';

import { useSettings } from './hooks/useSettings';

const App: React.FC = () => {
  const { data, loading, refreshing, error, metrics, refresh, cacheMetadata, isFromCache, clearCache } = useJiraData();
  const { settings, updateWorkDays } = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>(TABS.OVERVIEW);
  const [sprintToView, setSprintToView] = useState<string | null>(null);

  const handleNavigateToSprint = (sprintName: string) => {
    setSprintToView(sprintName);
    setActiveTab(TABS.SPRINTS);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="dashboard-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <main className="main-content">
        <header className="dashboard-header">
          <div className="header-content">
            <div>
              <h1 className="page-title">Live API Dashboard</h1>
              <p className="project-subtitle">Project: AM (Modernization)</p>
            </div>
            <div className="connection-badge card glass-morphism">
              <div className="status-dot"></div>
              <span>Connected to Atlassian</span>
            </div>
          </div>
        </header>

        {error && <ErrorMessage message={error} />}

        {activeTab === TABS.SETTINGS ? (
          <SettingsView
            cacheMetadata={cacheMetadata}
            isFromCache={isFromCache}
            refreshing={refreshing}
            onRefresh={() => refresh(true)}
            onClearCache={clearCache}
            workDays={settings.workDays}
            onUpdateWorkDays={updateWorkDays}
          />
        ) : (
          metrics && (
            <>
              {activeTab === TABS.OVERVIEW && <Overview metrics={metrics} />}
              {activeTab === TABS.DEVS && <DeveloperTable metrics={metrics} />}
              {activeTab === TABS.SPRINTS && <SprintView data={data} metrics={metrics} initialSprint={sprintToView} />}
              {activeTab === TABS.TASKS && <IssueExplorer data={data} />}
              {activeTab === TABS.IDLE_TIME && <IdleTimeView data={data} onNavigateToSprint={handleNavigateToSprint} workDays={settings.workDays} />}
              {activeTab === TABS.OVERTIME && <OvertimeView data={data} onNavigateToSprint={handleNavigateToSprint} workDays={settings.workDays} />}
            </>
          )
        )}
      </main>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
