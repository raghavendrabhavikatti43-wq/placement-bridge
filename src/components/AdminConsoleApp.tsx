import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminProfile,
  ApplicationRecord,
  ApplicationStatus,
  AuthUser,
  CompanyDrive,
  SecurityAuditEntry,
} from '../types';
import { AdminAvatarEditorModal, getAdminAvatarBgClass } from './AdminAvatarEditorModal';
import { ThemeToggleButton } from '../context/ThemeContext';

interface AdminConsoleAppProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onUpdateAuthUser: (updatedUser: AuthUser) => void;
}

type AdminSection = 'overview' | 'drives' | 'candidates' | 'profile' | 'security';

interface AdminStudentSummary {
  id: string;
  name: string;
  email: string;
  department: string;
  cgpa: number;
  gradYear: number;
  authMethod: string;
  createdAt: string;
}

interface AdminApplicationItem extends ApplicationRecord {
  studentEmail: string;
  studentName: string;
  studentCgpa: number;
}

const ADMIN_PROFILE_STORAGE_KEY = 'placement_portal_admin_profile_v1';

const DEFAULT_ADMIN_PROFILE: AdminProfile = {
  userId: 'TPO-ADMIN-01',
  email: 'admin.tpo@nie-placement.edu',
  name: 'Dr. Rajesh Verma',
  title: 'Chief Training & Placement Officer',
  department: 'Department of Computer Science & Placement Cell',
  institutionName: 'National Institute of Engineering',
  batchYear: 2027,
  phone: '+91 821 248 0475',
  officeLocation: 'Administrative Block, Wing B — Room 204',
  officeHours: 'Mon – Fri · 10:00 AM to 4:30 PM IST',
  deskEmail: 'tpo.office@nie-placement.edu',
  bio: 'Overseeing institutional recruiter partnerships, Day-0/Day-1 campus hiring governance, and academic eligibility compliance across all engineering branches.',
  avatarUrl: '',
  avatarBg: 'indigo',
};

const DEPT_CONVERSION_DATA = [
  { dept: 'Computer Science (CSE)', strength: 180, eligible: 164, placed: 128, avgCtc: '₹18.4 LPA' },
  { dept: 'Information Technology (IT)', strength: 120, eligible: 108, placed: 82, avgCtc: '₹15.2 LPA' },
  { dept: 'Electronics & Comm. (ECE)', strength: 140, eligible: 118, placed: 79, avgCtc: '₹12.6 LPA' },
  { dept: 'Electrical Engineering (EE)', strength: 110, eligible: 90, placed: 58, avgCtc: '₹10.4 LPA' },
  { dept: 'Mechanical Engineering (ME)', strength: 90, eligible: 74, placed: 46, avgCtc: '₹8.9 LPA' },
];

export const AdminConsoleApp: React.FC<AdminConsoleAppProps> = ({
  user,
  token,
  onLogout,
  onUpdateAuthUser,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [adminProfile, setAdminProfile] = useState<AdminProfile>(() => {
    try {
      const cached = localStorage.getItem(ADMIN_PROFILE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<AdminProfile>;
        return {
          ...DEFAULT_ADMIN_PROFILE,
          ...parsed,
          userId: user.id || DEFAULT_ADMIN_PROFILE.userId,
          email: user.email || DEFAULT_ADMIN_PROFILE.email,
        };
      }
    } catch {
      // Ignore storage read errors
    }
    return {
      ...DEFAULT_ADMIN_PROFILE,
      userId: user.id || DEFAULT_ADMIN_PROFILE.userId,
      email: user.email || DEFAULT_ADMIN_PROFILE.email,
      name: user.name || DEFAULT_ADMIN_PROFILE.name,
      title: user.title || DEFAULT_ADMIN_PROFILE.title,
      avatarUrl: user.avatarUrl || '',
      avatarBg: user.avatarBg || 'indigo',
    };
  });

  // Editable draft form state for the Admin Profile & Info view
  const [profileForm, setProfileForm] = useState<AdminProfile>(adminProfile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyDrive[]>([]);
  const [applications, setApplications] = useState<AdminApplicationItem[]>([]);
  const [students, setStudents] = useState<AdminStudentSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Publish Campus Drive form state
  const [driveName, setDriveName] = useState('');
  const [driveRole, setDriveRole] = useState('');
  const [drivePackage, setDrivePackage] = useState('');
  const [driveLocation, setDriveLocation] = useState('Bengaluru / Hybrid');
  const [driveMinCgpa, setDriveMinCgpa] = useState('7.5');
  const [driveBacklogs, setDriveBacklogs] = useState('0');
  const [driveDays, setDriveDays] = useState('14');
  const [driveFeedback, setDriveFeedback] = useState<string | null>(null);

  const persistAdminProfileLocally = (nextProfile: AdminProfile) => {
    try {
      localStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    } catch {
      // Ignore storage quota errors
    }
  };

  const saveAdminProfileToServer = useCallback(
    async (nextProfile: AdminProfile, showBanner = true) => {
      setProfileSaving(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/admin/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(nextProfile),
        });
        if (res.status === 401 || res.status === 403) {
          onLogout();
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Could not save Administrator profile changes.');
          return;
        }
        const authoritative: AdminProfile = {
          ...nextProfile,
          ...(data.adminCustodian || {}),
        };
        setAdminProfile(authoritative);
        setProfileForm(authoritative);
        persistAdminProfileLocally(authoritative);
        if (data.user) {
          onUpdateAuthUser(data.user);
        } else {
          onUpdateAuthUser({
            ...user,
            name: authoritative.name,
            title: authoritative.title,
            avatarUrl: authoritative.avatarUrl,
            avatarBg: authoritative.avatarBg,
          });
        }
        if (showBanner) {
          setProfileSavedNotice(
            'Administrator profile, portrait, and institutional details saved.'
          );
        }
      } catch {
        // Still persist locally if transient offline
        setAdminProfile(nextProfile);
        setProfileForm(nextProfile);
        persistAdminProfileLocally(nextProfile);
        setErrorMsg('Network issue while syncing profile to server; saved locally.');
      } finally {
        setProfileSaving(false);
      }
    },
    [token, onLogout, onUpdateAuthUser, user]
  );

  const fetchAdminDashboard = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load TPO administrative data.');
        return;
      }
      setCompanies(data.companies || []);
      setApplications(data.applications || []);
      setStudents(data.students || []);
      setAuditLogs(data.auditLogs || []);

      if (data.adminCustodian) {
        // Merge cached local customizations if server just rebooted with blank avatar
        let merged: AdminProfile = {
          ...DEFAULT_ADMIN_PROFILE,
          ...data.adminCustodian,
        };
        try {
          const rawCached = localStorage.getItem(ADMIN_PROFILE_STORAGE_KEY);
          if (rawCached) {
            const cached = JSON.parse(rawCached) as Partial<AdminProfile>;
            if (
              data.adminCustodian.name === DEFAULT_ADMIN_PROFILE.name &&
              !data.adminCustodian.avatarUrl &&
              cached.name
            ) {
              merged = {
                ...merged,
                ...cached,
                userId: data.adminCustodian.userId,
                email: data.adminCustodian.email,
              };
            }
          }
        } catch {
          // Ignore localStorage parse errors
        }
        setAdminProfile(merged);
        setProfileForm(merged);
        persistAdminProfileLocally(merged);
      }
    } catch {
      setErrorMsg('Unable to sync with TPO governance server.');
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    fetchAdminDashboard();
  }, [fetchAdminDashboard]);

  const handleAvatarSave = (nextAvatarUrl: string, nextAvatarBg: string) => {
    const updated: AdminProfile = {
      ...adminProfile,
      avatarUrl: nextAvatarUrl,
      avatarBg: nextAvatarBg,
    };
    saveAdminProfileToServer(updated, true);
  };

  const handleProfileFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.title.trim()) {
      setErrorMsg('Administrator Full Name and Official Designation are required.');
      return;
    }
    saveAdminProfileToServer(
      {
        ...profileForm,
        avatarUrl: adminProfile.avatarUrl,
        avatarBg: adminProfile.avatarBg,
      },
      true
    );
  };

  const handleResetAdminInfo = () => {
    const restored: AdminProfile = {
      ...DEFAULT_ADMIN_PROFILE,
      userId: adminProfile.userId,
      email: adminProfile.email,
    };
    saveAdminProfileToServer(restored, true);
  };

  const handlePublishDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveName.trim() || !driveRole.trim() || !drivePackage.trim()) return;
    setDriveFeedback(null);

    try {
      const res = await fetch('/api/admin/drives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: driveName.trim(),
          role: driveRole.trim(),
          packageLpa: drivePackage.trim(),
          location: driveLocation.trim(),
          minCgpa: parseFloat(driveMinCgpa) || 7.5,
          allowedBacklogs: parseInt(driveBacklogs, 10) || 0,
          daysRemaining: parseInt(driveDays, 10) || 14,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.companies || []);
        setDriveName('');
        setDriveRole('');
        setDrivePackage('');
        setDriveFeedback('Campus drive published and synced live to all authorized students.');
        fetchAdminDashboard();
      } else {
        setErrorMsg(data.error || 'Could not publish campus drive.');
      }
    } catch {
      setErrorMsg('Network failure while publishing campus drive.');
    }
  };

  const handleRemoveDrive = async (driveId: string) => {
    try {
      const res = await fetch(`/api/admin/drives/${encodeURIComponent(driveId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.companies || []);
        fetchAdminDashboard();
      }
    } catch {
      setErrorMsg('Could not remove campus drive.');
    }
  };

  const handleUpdateCandidateStatus = async (appId: string, status: ApplicationStatus) => {
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(appId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
        fetchAdminDashboard();
      }
    } catch {
      setErrorMsg('Could not update candidate stage.');
    }
  };

  const navItems: { id: AdminSection; label: string; icon: string }[] = [
    { id: 'overview', label: 'Executive Governance', icon: 'monitoring' },
    { id: 'drives', label: 'Campus Drives Control', icon: 'domain_add' },
    { id: 'candidates', label: 'Candidates & Pipeline', icon: 'badge' },
    { id: 'profile', label: 'Admin Profile & Info', icon: 'manage_accounts' },
    { id: 'security', label: 'Security & Audit Log', icon: 'gpp_good' },
  ];

  const adminInitials =
    adminProfile.name
      .split(' ')
      .filter((part) => Boolean(part) && !part.endsWith('.'))
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    adminProfile.name.slice(0, 2).toUpperCase() ||
    'AD';

  const offersCount = applications.filter((a) => a.status === 'Offer').length;
  const blockedEventsCount = auditLogs.filter((l) => l.outcome === 'BLOCKED').length;

  return (
    <div
      id="tpo-admin-console"
      className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 font-hanken flex selection:bg-indigo-600 selection:text-white transition-colors duration-150"
    >
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/55 z-40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Dedicated TPO Admin Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-slate-950 text-slate-100 border-r border-slate-800 z-50 flex flex-col justify-between overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div>
              <span className="font-headline-sm text-white font-bold block leading-tight">
                TPO Admin Console
              </span>
              <span className="text-[11px] text-slate-400 block leading-tight">
                Single-Custodian Control Plane
              </span>
            </div>
          </div>

          {/* Interactive Custodian Identity Card with Editable Avatar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                id="sidebar-admin-avatar-btn"
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                title="Change or modify Admin profile picture"
                className="relative group shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-indigo-400 outline-none"
              >
                {adminProfile.avatarUrl ? (
                  <img
                    src={adminProfile.avatarUrl}
                    alt={adminProfile.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-700 group-hover:ring-indigo-400 transition-all"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 rounded-full text-white flex items-center justify-center text-sm font-extrabold ring-2 ring-slate-700 group-hover:ring-indigo-400 transition-all ${getAdminAvatarBgClass(
                      adminProfile.avatarBg
                    )}`}
                  >
                    {adminInitials}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-slate-950 border border-slate-700 text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <span className="text-indigo-400 font-semibold block text-[11px]">
                  Authorized Officer
                </span>
                <span className="font-bold text-white block text-sm truncate">
                  {adminProfile.name}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {adminProfile.title}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-400">{adminProfile.userId}</span>
              <button
                type="button"
                onClick={() => {
                  setSection('profile');
                  setMobileNavOpen(false);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] hover:underline whitespace-nowrap shrink-0"
              >
                Edit Info →
              </button>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="TPO Admin Navigation">
            <span className="px-3 text-[11px] font-semibold text-slate-500 block mb-2">
              Administration Modules
            </span>
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  id={`admin-nav-${item.id}`}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setProfileSavedNotice(null);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-3">
          <div className="text-[11px] text-slate-400 leading-relaxed">
            Role Scope: Administrator Only · Student Portal Views Disabled
          </div>
          <button
            id="admin-logout-btn"
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-3.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-800/80 text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-[17px]">logout</span>
            <span>Sign Out &amp; Lock Vault</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 lg:ml-72 flex flex-col min-w-0">
        {/* Top Bar with Admin Quick Profile, Theme Toggle & Avatar Controls */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden shrink-0"
              title="Toggle Admin Navigation"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                {adminProfile.institutionName} · TPO Office
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden md:inline font-mono text-indigo-700 dark:text-indigo-400 font-semibold tabular-nums">
                Academic Year 2026-27
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <ThemeToggleButton compact />

            <button
              type="button"
              onClick={fetchAdminDashboard}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span className="hidden sm:inline">Sync Records</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* Header Admin Avatar & Profile Trigger */}
            <div className="flex items-center gap-2.5">
              <button
                id="header-admin-avatar-btn"
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                title="Change or modify Admin profile picture"
                className="relative group rounded-full focus-visible:ring-2 focus-visible:ring-indigo-600 outline-none shrink-0"
              >
                {adminProfile.avatarUrl ? (
                  <img
                    src={adminProfile.avatarUrl}
                    alt={adminProfile.name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-indigo-600 dark:group-hover:ring-indigo-400 transition-all"
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-indigo-600 dark:group-hover:ring-indigo-400 transition-all ${getAdminAvatarBgClass(
                      adminProfile.avatarBg
                    )}`}
                  >
                    {adminInitials}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                </span>
              </button>

              <button
                id="header-admin-profile-btn"
                type="button"
                onClick={() => setSection('profile')}
                className="hidden sm:flex flex-col text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight whitespace-nowrap">
                  {adminProfile.name}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">
                  {adminProfile.title}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Section Body */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center justify-between"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-700 dark:text-red-300 font-bold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
              Loading encrypted TPO administrative telemetry...
            </div>
          ) : (
            <>
              {/* 1. EXECUTIVE GOVERNANCE OVERVIEW */}
              {section === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        01. Institutional Batch Oversight · {adminProfile.institutionName}
                      </span>
                      <h1 className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">
                        Executive Placement Governance
                      </h1>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Managed by {adminProfile.name} ({adminProfile.title}) for the 2026-27
                        graduating cohort.
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSection('profile')}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        Edit Officer Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection('drives')}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        Schedule New Drive
                      </button>
                    </div>
                  </div>

                  {/* 4 Key Institutional Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        Graduating Cohort (2026-27)
                      </span>
                      <span className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold block mt-1">
                        640
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">
                        CSE · IT · ECE · EE · ME
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        Active Campus Drives
                      </span>
                      <span className="font-headline-xl text-indigo-600 dark:text-indigo-400 font-extrabold block mt-1">
                        {companies.length}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">
                        Live on student portal
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        Portal Candidate Accounts
                      </span>
                      <span className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold block mt-1">
                        {students.length}
                      </span>
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">
                        {applications.length} drive applications · {offersCount} offers
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        Security Audit Events
                      </span>
                      <span className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold block mt-1">
                        {auditLogs.length}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">
                        {blockedEventsCount} unauthorized attempts blocked
                      </span>
                    </div>
                  </div>

                  {/* Department Placement Conversion Matrix */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold">
                          Department-Wise Placement Conversion Matrix
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Verified zero-backlog eligibility and offer conversion across engineering
                          branches
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Median CTC: ₹14.8 LPA
                      </span>
                    </div>

                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-left border-collapse text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <th className="py-3 pr-4 font-semibold">Engineering Department</th>
                            <th className="py-3 px-3 font-semibold text-right">Batch Size</th>
                            <th className="py-3 px-3 font-semibold text-right">Eligible</th>
                            <th className="py-3 px-3 font-semibold text-right">Placed</th>
                            <th className="py-3 px-3 font-semibold text-right">Conversion</th>
                            <th className="py-3 pl-3 font-semibold text-right">Average CTC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {DEPT_CONVERSION_DATA.map((row) => {
                            const conv = Math.round((row.placed / row.eligible) * 100);
                            return (
                              <tr key={row.dept} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-3.5 pr-4 font-bold text-slate-900 dark:text-slate-100">
                                  {row.dept}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono">{row.strength}</td>
                                <td className="py-3.5 px-3 text-right font-mono">{row.eligible}</td>
                                <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {row.placed}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                  {conv}%
                                </td>
                                <td className="py-3.5 pl-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                  {row.avgCtc}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CAMPUS DRIVES CONTROL */}
              {section === 'drives' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                      02. Recruiter Schedule &amp; Eligibility Cutoffs
                    </span>
                    <h1 className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">
                      Campus Drives Control
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Publish new campus recruitment drives or retire completed listings. Changes
                      propagate immediately to authenticated students.
                    </p>
                  </div>

                  {driveFeedback && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
                      <span>{driveFeedback}</span>
                      <button
                        type="button"
                        onClick={() => setDriveFeedback(null)}
                        className="font-bold hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <form
                      onSubmit={handlePublishDrive}
                      className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
                    >
                      <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold pb-3 border-b border-slate-100 dark:border-slate-800">
                        Publish New Campus Recruiter Drive
                      </h2>

                      <div>
                        <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Atlassian, Uber, Cisco"
                          value={driveName}
                          onChange={(e) => setDriveName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          Target Engineering Role
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Software Engineer - New Grad"
                          value={driveRole}
                          onChange={(e) => setDriveRole(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            CTC Package
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="₹26 LPA"
                            value={drivePackage}
                            onChange={(e) => setDrivePackage(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Work Location
                          </label>
                          <input
                            type="text"
                            value={driveLocation}
                            onChange={(e) => setDriveLocation(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 tabular-nums">
                        <div>
                          <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Min CGPA
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="5"
                            max="9.5"
                            value={driveMinCgpa}
                            onChange={(e) => setDriveMinCgpa(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Max Backlogs
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="3"
                            value={driveBacklogs}
                            onChange={(e) => setDriveBacklogs(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Days Away
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={driveDays}
                            onChange={(e) => setDriveDays(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        Publish Drive to Student Catalog
                      </button>
                    </form>

                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold">
                          Active Campus Drives ({companies.length})
                        </h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Live Student Feed
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {companies.map((comp) => (
                          <div
                            key={comp.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs tabular-nums"
                          >
                            <div>
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <span className="font-bold text-indigo-700 dark:text-indigo-400">
                                  {comp.packageLpa}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>Min CGPA {comp.minCgpa.toFixed(1)}</span>
                                <span aria-hidden="true">·</span>
                                <span>{comp.location}</span>
                              </div>
                              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                                {comp.name} — {comp.role}
                              </h3>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveDrive(comp.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 font-bold transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CANDIDATE APPLICATIONS & REGISTERED STUDENTS */}
              {section === 'candidates' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                      03. Recruitment Funnel &amp; Candidate Roster
                    </span>
                    <h1 className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">
                      Candidate Applications &amp; Directory
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Advance shortlisted candidates across hiring rounds and audit registered
                      student accounts.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold pb-3 border-b border-slate-100 dark:border-slate-800">
                      Submitted Campus Drive Applications ({applications.length})
                    </h2>
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-left border-collapse text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 pr-3 font-semibold">Candidate</th>
                            <th className="py-2.5 px-3 font-semibold">Company &amp; Role</th>
                            <th className="py-2.5 px-3 font-semibold text-right">CGPA</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Package</th>
                            <th className="py-2.5 pl-3 font-semibold text-right">
                              Official Stage Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {applications.map((app) => (
                            <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-3 pr-3">
                                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                  {app.studentName}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                  {app.studentEmail}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                  {app.company}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {app.role}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {Number(app.studentCgpa || 8.1).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-indigo-700 dark:text-indigo-400 font-bold">
                                {app.packageLpa}
                              </td>
                              <td className="py-3 pl-3 text-right">
                                <select
                                  aria-label={`Update status for ${app.studentName} at ${app.company}`}
                                  value={app.status}
                                  onChange={(e) =>
                                    handleUpdateCandidateStatus(
                                      app.id,
                                      e.target.value as ApplicationStatus
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                                >
                                  <option value="Applied">Applied</option>
                                  <option value="OA Scheduled">OA Scheduled</option>
                                  <option value="Shortlisted">Shortlisted</option>
                                  <option value="Tech Round">Tech Round</option>
                                  <option value="Offer">Offer</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold pb-3 border-b border-slate-100 dark:border-slate-800">
                      Authenticated Student Accounts ({students.length})
                    </h2>
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-left border-collapse text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 pr-3 font-semibold">Student ID</th>
                            <th className="py-2.5 px-3 font-semibold">Full Name</th>
                            <th className="py-2.5 px-3 font-semibold">Email ID</th>
                            <th className="py-2.5 px-3 font-semibold">Department</th>
                            <th className="py-2.5 px-3 font-semibold text-right">CGPA</th>
                            <th className="py-2.5 pl-3 font-semibold text-right">Auth Method</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {students.map((stu) => (
                            <tr key={stu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-3 pr-3 font-mono text-slate-600 dark:text-slate-400">
                                {stu.id}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {stu.name}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                                {stu.email}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                                {stu.department}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {stu.cgpa.toFixed(2)}
                              </td>
                              <td className="py-3 pl-3 text-right text-indigo-700 dark:text-indigo-400 font-semibold">
                                {stu.authMethod}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ADMIN PROFILE & CUSTODIAN INFORMATION */}
              {section === 'profile' && (
                <div id="admin-profile-view" className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                        04. Custodian Identity &amp; Institutional Configuration
                      </span>
                      <h1 className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">
                        Administrator Profile &amp; Information
                      </h1>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Update your officer portrait, full name, official designation, contact
                        details, and placement cell governance profile.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAvatarModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <span className="material-symbols-outlined text-[17px]">photo_camera</span>
                      <span>Change Profile Picture</span>
                    </button>
                  </div>

                  {profileSavedNotice && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
                      <span>{profileSavedNotice}</span>
                      <button
                        type="button"
                        onClick={() => setProfileSavedNotice(null)}
                        className="font-bold hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Portrait & Custodian Card */}
                    <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                      <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsAvatarModalOpen(true)}
                          title="Click to upload, crop, or modify Admin portrait"
                          className="relative group rounded-full focus-visible:ring-2 focus-visible:ring-indigo-600 outline-none"
                        >
                          {adminProfile.avatarUrl ? (
                            <img
                              src={adminProfile.avatarUrl}
                              alt={adminProfile.name}
                              className="w-28 h-28 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-800 group-hover:ring-indigo-200 dark:group-hover:ring-indigo-500/40 transition-all"
                            />
                          ) : (
                            <div
                              className={`w-28 h-28 rounded-full text-white flex items-center justify-center font-headline-xl font-extrabold ring-4 ring-slate-100 dark:ring-slate-800 group-hover:ring-indigo-200 dark:group-hover:ring-indigo-500/40 transition-all ${getAdminAvatarBgClass(
                                adminProfile.avatarBg
                              )}`}
                            >
                              {adminInitials}
                            </div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-indigo-600 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </span>
                        </button>

                        <div>
                          <h2 className="font-headline-md text-slate-900 dark:text-slate-100 font-bold">
                            {adminProfile.name}
                          </h2>
                          <p className="text-xs text-indigo-700 dark:text-indigo-400 font-semibold mt-0.5">
                            {adminProfile.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {adminProfile.department}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAvatarModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                          >
                            {adminProfile.avatarUrl ? 'Modify Portrait' : 'Upload Portrait'}
                          </button>

                          {adminProfile.avatarUrl && (
                            <button
                              type="button"
                              onClick={() => handleAvatarSave('', adminProfile.avatarBg)}
                              className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                            >
                              Remove Photo
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Verified Custodian Security Identifiers */}
                      <div className="space-y-3 text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          Verified Custodian Credentials
                        </span>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">Custodian ID</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {adminProfile.userId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">
                            Auth Email
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                            {adminProfile.email}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">
                            Direct Phone
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                            {adminProfile.phone || 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">
                            Office Cabin
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 text-right">
                            {adminProfile.officeLocation || 'Not set'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Editable Officer & Institutional Form */}
                    <form
                      onSubmit={handleProfileFormSubmit}
                      className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-xs"
                    >
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold">
                            Edit Officer &amp; Placement Cell Details
                          </h2>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                            Changes update your administrator identity across the console and server
                            records immediately.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="admin-edit-name"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Administrator Full Name
                          </label>
                          <input
                            id="admin-edit-name"
                            type="text"
                            required
                            value={profileForm.name}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, name: e.target.value })
                            }
                            placeholder="e.g., Dr. Rajesh Verma"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-title"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Official Designation / Role Title
                          </label>
                          <input
                            id="admin-edit-title"
                            type="text"
                            required
                            value={profileForm.title}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, title: e.target.value })
                            }
                            placeholder="e.g., Chief Training & Placement Officer"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-dept"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Faculty / Academic Division
                          </label>
                          <input
                            id="admin-edit-dept"
                            type="text"
                            required
                            value={profileForm.department}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, department: e.target.value })
                            }
                            placeholder="Department of Computer Science & Placement Cell"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-institution"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Institution / University Name
                          </label>
                          <input
                            id="admin-edit-institution"
                            type="text"
                            required
                            value={profileForm.institutionName}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, institutionName: e.target.value })
                            }
                            placeholder="National Institute of Engineering"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-phone"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Direct Office Phone / Extension
                          </label>
                          <input
                            id="admin-edit-phone"
                            type="text"
                            value={profileForm.phone}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, phone: e.target.value })
                            }
                            placeholder="+91 821 248 0475"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-desk-email"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            Recruiter &amp; TPO Desk Contact Email
                          </label>
                          <input
                            id="admin-edit-desk-email"
                            type="email"
                            value={profileForm.deskEmail}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, deskEmail: e.target.value })
                            }
                            placeholder="tpo.office@nie-placement.edu"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-edit-location"
                            className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                          >
                            TPO Cabin / Office Location
                          </label>
                          <input
                            id="admin-edit-location"
                            type="text"
                            value={profileForm.officeLocation}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, officeLocation: e.target.value })
                            }
                            placeholder="Administrative Block, Wing B — Room 204"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label
                              htmlFor="admin-edit-hours"
                              className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                            >
                              Consultation Hours
                            </label>
                            <input
                              id="admin-edit-hours"
                              type="text"
                              value={profileForm.officeHours}
                              onChange={(e) =>
                                setProfileForm({ ...profileForm, officeHours: e.target.value })
                              }
                              placeholder="Mon – Fri · 10:00 AM to 4:30 PM"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="admin-edit-batch"
                              className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                            >
                              Batch Year
                            </label>
                            <input
                              id="admin-edit-batch"
                              type="number"
                              min="2022"
                              max="2032"
                              value={profileForm.batchYear}
                              onChange={(e) =>
                                setProfileForm({
                                  ...profileForm,
                                  batchYear: parseInt(e.target.value, 10) || 2027,
                                })
                              }
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="admin-edit-bio"
                          className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                        >
                          Official TPO Governance Note &amp; Bio
                        </label>
                        <textarea
                          id="admin-edit-bio"
                          rows={3}
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                          placeholder="Describe placement governance scope, recruiter relations, and institutional priorities..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 dark:focus:border-indigo-500 leading-relaxed"
                        />
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={handleResetAdminInfo}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors whitespace-nowrap shrink-0"
                        >
                          Restore Default Officer Info
                        </button>

                        <button
                          id="save-admin-profile-btn"
                          type="submit"
                          disabled={profileSaving}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span className="material-symbols-outlined text-[17px]">save</span>
                          <span>
                            {profileSaving
                              ? 'Saving Administrator Info...'
                              : 'Save Administrator Information'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 5. SECURITY & ACCESS AUDIT LOG */}
              {section === 'security' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                      05. Cryptographic Access Governance
                    </span>
                    <h1 className="font-headline-xl text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">
                      Security Posture &amp; Audit Trail
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Real-time verification of single-custodian administrator lock, student RBAC
                      isolation, and authentication events.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold block">
                        Single-Admin Enforcement
                      </span>
                      <span className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold block">
                        Locked to {adminProfile.userId}
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Admin sign-up and federated login are disabled. Only {adminProfile.email}{' '}
                        with master password and security challenge can unlock this console.
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold block">
                        Strict Portal Separation
                      </span>
                      <span className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold block">
                        Zero Cross-Role Visibility
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Student tokens receive HTTP 403 on all /api/admin/* endpoints, and Admin
                        sessions never render student personal or practice pages.
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold block">
                        Cryptographic Primitives
                      </span>
                      <span className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold block">
                        scrypt + HMAC-SHA256
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Constant-time credential comparison prevents timing side-channel leaks;
                        5 failed attempts trigger automatic 5-minute lockout.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h2 className="font-headline-sm text-slate-900 dark:text-slate-100 font-bold pb-3 border-b border-slate-100 dark:border-slate-800">
                      Live Security &amp; Access Audit Log
                    </h2>
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-left border-collapse text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 pr-3 font-semibold">Timestamp</th>
                            <th className="py-2.5 px-3 font-semibold">Actor</th>
                            <th className="py-2.5 px-3 font-semibold">Scope</th>
                            <th className="py-2.5 px-3 font-semibold">Security Event</th>
                            <th className="py-2.5 pl-3 font-semibold text-right">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-3 pr-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                                {log.actor}
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400 capitalize">
                                {log.role}
                              </td>
                              <td className="py-3 px-3 text-slate-800 dark:text-slate-200">
                                {log.event}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono font-bold">
                                <span
                                  className={
                                    log.outcome === 'SUCCESS'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-red-700 dark:text-red-400'
                                  }
                                >
                                  {log.outcome}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Admin Profile Picture Upload, Crop & Modify Modal */}
      <AdminAvatarEditorModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        adminProfile={adminProfile}
        onSaveAvatar={handleAvatarSave}
      />
    </div>
  );
};
