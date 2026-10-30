import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';
import { getAvatarBgClass } from './AvatarEditorModal';
import { ThemeToggleButton } from '../context/ThemeContext';

interface HeaderProps {
  profile: StudentProfile;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenAvatarEditor: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenSearch,
  onOpenProfile,
  onOpenAvatarEditor,
  onToggleMobileMenu,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile.avatarUrl]);

  const notifications = [
    {
      id: 1,
      title: 'Microsoft SDE Application',
      desc: 'Registration closes in 5 days. Focus sprint: Dynamic Programming.',
      time: '10m ago',
    },
    {
      id: 2,
      title: 'Deloitte Tech Assessment Slot',
      desc: 'Mock exam scheduled for Thursday at 6:00 PM.',
      time: '1h ago',
    },
    {
      id: 3,
      title: 'Weekly Readiness Calibrated',
      desc: `Your compatibility index rose by +4% to ${profile.readinessScore}%.`,
      time: '4h ago',
    },
  ];

  const initials =
    profile.name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST';

  const hasPhoto = Boolean(profile.avatarUrl) && !avatarFailed;

  return (
    <header
      id="main-top-header"
      className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-surface-container-low z-40 flex items-center justify-between px-gutter"
    >
      {/* Left Search Bar + Mobile Menu Toggle */}
      <div className="flex items-center gap-space-sm flex-1 max-w-md">
        <button
          id="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          className="p-1.5 text-on-surface-variant hover:text-on-surface lg:hidden rounded-lg hover:bg-surface-container-low transition-colors"
          title="Open Navigation"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <button
          id="header-search-box"
          type="button"
          onClick={onOpenSearch}
          className="relative w-full flex items-center bg-surface-container-low rounded-lg px-space-sm py-2 cursor-pointer hover:bg-surface-container transition-colors text-left"
        >
          <span className="material-symbols-outlined text-outline text-[20px] mr-space-xs">
            search
          </span>
          <span className="font-body-sm text-outline select-none truncate">
            Search companies, roles, skills, topics... [⌘K]
          </span>
        </button>
      </div>

      {/* Right User & Readiness Indicators */}
      <div className="flex items-center gap-space-md sm:gap-gutter">
        <div
          id="header-readiness-pill"
          className="hidden sm:flex items-center gap-1.5 text-xs text-on-surface-variant tabular-nums"
        >
          <span>Readiness:</span>
          <strong className="text-secondary font-bold">{profile.readinessScore}%</strong>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-semibold text-on-surface">
            CGPA {profile.cgpa.toFixed(2)}
          </span>
        </div>

        {/* Light / Dark Mode Switch */}
        <ThemeToggleButton compact />

        {/* Notifications Button */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-space-xs text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-low"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-error bg-error rounded-full tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              id="notifications-dropdown-menu"
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-low p-space-md z-50 flex flex-col gap-space-sm animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
                <span className="font-headline-sm text-on-surface">Placement Alerts</span>
                <span className="font-label-sm text-secondary font-semibold tabular-nums">
                  {unreadCount} Unread
                </span>
              </div>
              <div className="flex flex-col gap-space-xs max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setShowNotifications(false)}
                    className="p-space-sm rounded-lg bg-surface-container-low/50 hover:bg-surface-container-low transition-colors flex flex-col gap-0.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-on-surface font-semibold">
                        {item.title}
                      </span>
                      <span className="font-label-sm text-outline">{item.time}</span>
                    </div>
                    <p className="font-body-sm text-on-surface-variant">{item.desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setUnreadCount(0);
                  setShowNotifications(false);
                }}
                className="w-full text-center py-1.5 text-xs text-secondary font-label-md hover:underline pt-space-xs"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Avatar Controls */}
        <div className="flex items-center gap-2">
          <button
            id="header-avatar-edit-trigger"
            type="button"
            onClick={onOpenAvatarEditor}
            title="Change or modify profile picture"
            className="relative group rounded-full focus-visible:ring-2 focus-visible:ring-secondary outline-none"
          >
            {hasPhoto ? (
              <img
                id="header-profile-avatar"
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-surface-container-high group-hover:ring-secondary transition-all"
                src={profile.avatarUrl}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                id="header-profile-monogram"
                className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold ring-2 ring-surface-container-high group-hover:ring-secondary transition-all ${getAvatarBgClass(
                  profile.avatarBg
                )}`}
              >
                {initials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-surface-container-lowest border border-surface-container-high text-secondary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[11px]">photo_camera</span>
            </span>
          </button>

          <button
            id="header-profile-capsule"
            type="button"
            onClick={onOpenProfile}
            className="hidden md:flex flex-col text-left hover:opacity-85 transition-opacity"
          >
            <span className="font-label-lg text-on-surface font-bold leading-none whitespace-nowrap">
              {profile.name}
            </span>
            <span className="font-label-sm text-outline mt-0.5 leading-none whitespace-nowrap">
              {profile.degree} CSE · 2026-27
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
