import React from 'react';
import {
    Users,
    BarChart3,
    LayoutDashboard,
    Layers,
    CheckCircle2,
    Settings,
    Clock
} from 'lucide-react';
import type { TabType } from '../constants/theme';
import { TABS } from '../constants/theme';

interface SidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    refreshing: boolean;
    onRefresh: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    return (
        <aside className="sidebar">
            <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 color="#6366f1" /> JiraStats
                </h2>
                <nav>
                    <div className={`nav-item ${activeTab === TABS.OVERVIEW ? 'active' : ''}`} onClick={() => setActiveTab(TABS.OVERVIEW)}>
                        <LayoutDashboard size={18} /> Overview
                    </div>
                    <div className={`nav-item ${activeTab === TABS.SPRINTS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.SPRINTS)}>
                        <Layers size={18} /> Sprints
                    </div>
                    <div className={`nav-item ${activeTab === TABS.DEVS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.DEVS)}>
                        <Users size={18} /> Developers
                    </div>
                    <div className={`nav-item ${activeTab === TABS.TASKS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.TASKS)}>
                        <CheckCircle2 size={18} /> Task Explorer
                    </div>
                    <div className={`nav-item ${activeTab === TABS.IDLE_TIME ? 'active' : ''}`} onClick={() => setActiveTab(TABS.IDLE_TIME)}>
                        <Clock size={18} /> Idle Time
                    </div>
                    <div className={`nav-item ${activeTab === TABS.SETTINGS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.SETTINGS)}>
                        <Settings size={18} /> Settings
                    </div>
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;
