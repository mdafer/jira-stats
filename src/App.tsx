import React, { useState, useEffect, useCallback } from 'react';
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

import { useSettings } from './hooks/useSettings';

const App: React.FC = () => {
  const { data, loading, refreshing, error, metrics, refresh, cacheMetadata, isFromCache, clearCache } = useJiraData();
  const { settings, updateWorkDays } = useSettings();
  
  // Initialize state from URL
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType;
    return Object.values(TABS).includes(tab) ? tab : TABS.OVERVIEW;
  });
  
  const [sprintToView, setSprintToView] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sprint');
  });
  
  const [userToFilter, setUserToFilter] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('user');
  });

  // Sync state to URL
  const updateUrl = useCallback((tab: TabType, sprint: string | null, user: string | null) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (sprint) params.set('sprint', sprint);
    if (user) params.set('user', user);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      window.history.pushState({ tab, sprint, user }, '', newUrl);
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        setActiveTabState(state.tab || TABS.OVERVIEW);
        setSprintToView(state.sprint || null);
        setUserToFilter(state.user || null);
      } else {
        // Fallback to URL params if no state
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') as TabType;
        setActiveTabState(Object.values(TABS).includes(tab) ? tab : TABS.OVERVIEW);
        setSprintToView(params.get('sprint'));
        setUserToFilter(params.get('user'));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    // When switching tabs normally, we might want to clear sprint/user filters 
    // unless we're going to the sprints tab which might already have them set
    if (tab !== TABS.SPRINTS) {
      setSprintToView(null);
      setUserToFilter(null);
      updateUrl(tab, null, null);
    } else {
      updateUrl(tab, sprintToView, userToFilter);
    }
  };

  const handleNavigateToSprint = (sprintName: string, userName?: string | null) => {
    const user = userName || null;
    setSprintToView(sprintName);
    setUserToFilter(user);
    setActiveTabState(TABS.SPRINTS);
    updateUrl(TABS.SPRINTS, sprintName, user);
  };

  const handleUserSelectInSprint = (user: string | null) => {
    setUserToFilter(user);
    updateUrl(TABS.SPRINTS, sprintToView, user);
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
              <h1 className="page-title">{import.meta.env.VITE_PROJECT_TITLE || 'Jira Stats'}</h1>
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
              {activeTab === TABS.OVERVIEW && <Overview metrics={metrics} onNavigateToSprint={handleNavigateToSprint} />}
              {activeTab === TABS.DEVS && <DeveloperTable metrics={metrics} data={data} onNavigateToSprint={handleNavigateToSprint} />}
              {activeTab === TABS.SPRINTS && <SprintView data={data} metrics={metrics} initialSprint={sprintToView} initialUser={userToFilter} workDays={settings.workDays} onSprintSelect={handleNavigateToSprint} onUserSelect={handleUserSelectInSprint} />}
              {activeTab === TABS.TASKS && <IssueExplorer data={data} />}
              {activeTab === TABS.IDLE_TIME && <IdleTimeView data={data} onNavigateToSprint={handleNavigateToSprint} workDays={settings.workDays} />}
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
