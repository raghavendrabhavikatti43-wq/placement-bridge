import React, { useState } from 'react';
import { NavigationPath } from '../types';
import { LOGO_URL } from '../data/placementData';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  currentPath: NavigationPath;
  onNavigate: (path: NavigationPath) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [logoError, setLogoError] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleNav = (path: NavigationPath) => {
    onNavigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (path: NavigationPath) => {
    const isActive = currentPath === path;
    if (isActive) {
      return 'flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg transition-colors bg-surface-container-high text-secondary font-headline-sm whitespace-nowrap';
    }
    return 'flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors whitespace-nowrap';
  };

  return (
    <>
      {mobileOpen && (
        <div
          id="sidebar-overlay"
          className="fixed inset-0 bg-black/55 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="main-sidebar"
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-lowest border-r border-surface-container-low z-50 flex flex-col justify-between overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-space-lg">
          {/* Logo Brand Header */}
          <div className="flex items-center gap-space-sm mb-space-lg">
            {!logoError ? (
              <img
                id="sidebar-logo-img"
                alt="Placement Guidance System Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-8 w-8 rounded-lg object-contain shrink-0"
                src={LOGO_URL}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">school</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-headline-sm text-on-surface tracking-tight leading-tight">
                Placement Guidance
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Engineering Career Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-space-md" id="main-navigation">
            <div className="flex flex-col gap-space-xs">
              <span className="px-space-sm py-space-xs font-label-sm text-outline">Main</span>
              <button
                id="nav-dashboard"
                onClick={() => handleNav('dashboard')}
                className={navItemClass('dashboard')}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="font-label-lg">Dashboard</span>
              </button>
              <button
                id="nav-my-profile"
                onClick={() => handleNav('my-profile')}
                className={navItemClass('my-profile')}
              >
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="font-label-lg">My Profile</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <span className="px-space-sm py-space-xs font-label-sm text-outline">
                Placement Engine
              </span>
              <button
                id="nav-companies"
                onClick={() => handleNav('companies')}
                className={navItemClass('companies')}
              >
                <span className="material-symbols-outlined text-[20px]">apartment</span>
                <span className="font-label-lg">Companies</span>
              </button>
              <button
                id="nav-eligibility-checker"
                onClick={() => handleNav('eligibility-checker')}
                className={navItemClass('eligibility-checker')}
              >
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
                <span className="font-label-lg">Eligibility Checker</span>
              </button>
              <button
                id="nav-skill-gap"
                onClick={() => handleNav('skill-gap')}
                className={navItemClass('skill-gap')}
              >
                <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
                <span className="font-label-lg">Skill Gap</span>
              </button>
              <button
                id="nav-recommendations"
                onClick={() => handleNav('recommendations')}
                className={navItemClass('recommendations')}
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                <span className="font-label-lg">Recommendations</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <span className="px-space-sm py-space-xs font-label-sm text-outline">
                Preparation Hub
              </span>
              <button
                id="nav-practice-hub"
                onClick={() => handleNav('practice-hub')}
                className={navItemClass('practice-hub')}
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
                <span className="font-label-lg">Practice Hub</span>
              </button>
              <button
                id="nav-aptitude-practice"
                onClick={() => handleNav('aptitude-practice')}
                className={navItemClass('aptitude-practice')}
              >
                <span className="material-symbols-outlined text-[20px]">calculate</span>
                <span className="font-label-lg">Aptitude Practice</span>
              </button>
              <button
                id="nav-coding-practice"
                onClick={() => handleNav('coding-practice')}
                className={navItemClass('coding-practice')}
              >
                <span className="material-symbols-outlined text-[20px]">code</span>
                <span className="font-label-lg">Technical Coding</span>
              </button>
              <button
                id="nav-interview-prep"
                onClick={() => handleNav('interview-prep')}
                className={navItemClass('interview-prep')}
              >
                <span className="material-symbols-outlined text-[20px]">groups</span>
                <span className="font-label-lg">Interview Prep</span>
              </button>
              <button
                id="nav-study-plan"
                onClick={() => handleNav('study-plan')}
                className={navItemClass('study-plan')}
              >
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                <span className="font-label-lg">Study Plan</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <span className="px-space-sm py-space-xs font-label-sm text-outline">
                Career Tracking
              </span>
              <button
                id="nav-progress-analytics"
                onClick={() => handleNav('progress-analytics')}
                className={navItemClass('progress-analytics')}
              >
                <span className="material-symbols-outlined text-[20px]">insights</span>
                <span className="font-label-lg">Progress &amp; Analytics</span>
              </button>
              <button
                id="nav-applications"
                onClick={() => handleNav('applications')}
                className={navItemClass('applications')}
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
                <span className="font-label-lg">Applications</span>
              </button>
              <button
                id="nav-resources"
                onClick={() => handleNav('resources')}
                className={navItemClass('resources')}
              >
                <span className="material-symbols-outlined text-[20px]">folder</span>
                <span className="font-label-lg">Resources</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <span className="px-space-sm py-space-xs font-label-sm text-outline">
                Intelligence
              </span>
              <button
                id="nav-ai-assistant"
                onClick={() => handleNav('ai-assistant')}
                className={navItemClass('ai-assistant')}
              >
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                <span className="font-label-lg">AI Assistant</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-space-lg pt-0 flex flex-col gap-space-xs">
          <button
            id="sidebar-theme-toggle"
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-between gap-space-sm px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="font-label-lg">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </span>
            <span className="text-[11px] font-mono text-outline uppercase">
              {theme}
            </span>
          </button>
          <button
            id="nav-settings"
            onClick={() => handleNav('settings')}
            className={navItemClass('settings')}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="font-label-lg">Settings</span>
          </button>
          <button
            id="nav-logout"
            onClick={() => handleNav('logout')}
            className="flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="font-label-lg">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
