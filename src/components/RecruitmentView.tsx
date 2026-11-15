import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StudentProfile } from '../types';

interface RecruitmentViewProps {
  profile: StudentProfile;
}

// ── API types ─────────────────────────────────────────────────────────────────

interface DriveMatch {
  eligibilityStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'CONDITIONAL';
  failingCriteria: string[];
  compatibilityScore?: number;
}

interface PlacementDrive {
  id: string;
  jobTitle: string;
  jobDescription: string;
  location: string | null;
  ctcMin: string | null;
  ctcMax: string | null;
  applicationDeadline: string;
  driveDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
  company: { id: string; name: string; logoUrl?: string; industry?: string };
  driveMatch?: DriveMatch;
  hasApplied?: boolean;
}

type AppStatus =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'SELECTED'
  | 'REJECTED'
  | 'WITHDRAWN';

interface StatusHistoryEntry {
  status: AppStatus;
  changedAt: string;
  note?: string;
}

interface MyApplication {
  id: string;
  driveId: string;
  status: AppStatus;
  appliedAt: string;
  coverNote?: string;
  statusHistory: StatusHistoryEntry[];
  drive: {
    jobTitle: string;
    company: { name: string; logoUrl?: string };
  };
}

type InterviewMode = 'ONLINE' | 'OFFLINE';
type InterviewStatus = 'SCHEDULED' | 'ACKNOWLEDGED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';

interface MyInterview {
  id: string;
  scheduledAt: string;
  durationMins: number;
  mode: InterviewMode;
  meetingLink?: string;
  location?: string;
  instructions?: string;
  status: InterviewStatus;
  application: {
    id: string;
    drive: { jobTitle: string; company: { name: string } };
  };
}

interface PlacementNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  driveId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: AppStatus) {
  const map: Record<AppStatus, { label: string; cls: string }> = {
    APPLIED: { label: 'Applied', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    UNDER_REVIEW: { label: 'Under Review', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
    SHORTLISTED: { label: 'Shortlisted', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
    SELECTED: { label: 'Selected 🎉', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    WITHDRAWN: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function driveBadge(status: PlacementDrive['status']) {
  const map: Record<PlacementDrive['status'], { label: string; cls: string }> = {
    DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
    PUBLISHED: { label: 'Open', cls: 'bg-green-100 text-green-700' },
    CLOSED: { label: 'Closed', cls: 'bg-slate-100 text-slate-600' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${cls}`}>
      {label}
    </span>
  );
}

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Deadline passed';
  if (diffDays === 0) return 'Closes today';
  if (diffDays === 1) return 'Closes tomorrow';
  return `${diffDays} days left`;
}

function formatCountdown(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return 'Now';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `in ${days}d ${hours}h`;
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `in ${hours}h ${mins}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ctcRange(min: string | null, max: string | null) {
  if (!min && !max) return 'CTC Not Disclosed';
  if (min && max) return `₹${min}–${max} LPA`;
  if (min) return `From ₹${min} LPA`;
  return `Up to ₹${max} LPA`;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <span className="material-symbols-outlined text-[48px] text-outline/50">{icon}</span>
      <p className="font-label-lg text-on-surface font-semibold">{title}</p>
      <p className="font-body-sm text-on-surface-variant">{subtitle}</p>
    </div>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-error-container text-on-error-container text-sm">
      <span className="material-symbols-outlined text-[20px]">error</span>
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="underline font-semibold shrink-0">Retry</button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'drives' | 'applications' | 'interviews'>('drives');

  // Data state
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [myInterviews, setMyInterviews] = useState<MyInterview[]>([]);
  const [notifications, setNotifications] = useState<PlacementNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Loading
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Errors
  const [errorDrives, setErrorDrives] = useState<string | null>(null);
  const [errorApps, setErrorApps] = useState<string | null>(null);
  const [errorInterviews, setErrorInterviews] = useState<string | null>(null);

  // UI state
  const [notifOpen, setNotifOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyNote, setApplyNote] = useState('');
  const [applyModalDriveId, setApplyModalDriveId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [expandedDrive, setExpandedDrive] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchDrives = useCallback(async () => {
    setLoadingDrives(true);
    setErrorDrives(null);
    try {
      const res = await fetch('/api/recruitment/drives');
      if (!res.ok) throw new Error('Failed to load drives');
      const data = await res.json();
      setDrives(data.drives ?? data ?? []);
    } catch (e: unknown) {
      setErrorDrives(e instanceof Error ? e.message : 'Could not load drives');
    } finally {
      setLoadingDrives(false);
    }
  }, []);

  const fetchApps = useCallback(async () => {
    setLoadingApps(true);
    setErrorApps(null);
    try {
      const res = await fetch('/api/recruitment/applications/my');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      setMyApps(data.applications ?? data ?? []);
    } catch (e: unknown) {
      setErrorApps(e instanceof Error ? e.message : 'Could not load applications');
    } finally {
      setLoadingApps(false);
    }
  }, []);

  const fetchInterviews = useCallback(async () => {
    setLoadingInterviews(true);
    setErrorInterviews(null);
    try {
      const res = await fetch('/api/recruitment/interviews/my');
      if (!res.ok) throw new Error('Failed to load interviews');
      const data = await res.json();
      setMyInterviews(data.interviews ?? data ?? []);
    } catch (e: unknown) {
      setErrorInterviews(e instanceof Error ? e.message : 'Could not load interviews');
    } finally {
      setLoadingInterviews(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch('/api/recruitment/placement-notifications'),
        fetch('/api/recruitment/placement-notifications/count'),
      ]);
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications ?? data ?? []);
      }
      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // Notifications are non-critical
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    fetchDrives();
    fetchApps();
    fetchInterviews();
    fetchNotifications();
  }, [fetchDrives, fetchApps, fetchInterviews, fetchNotifications]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleApply = async (driveId: string) => {
    // Optimistic: mark drive as applied
    setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, hasApplied: true } : d));
    setApplyModalDriveId(null);
    setApplyingId(driveId);
    try {
      const res = await fetch(`/api/recruitment/drives/${driveId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverNote: applyNote.trim() || undefined }),
      });
      if (!res.ok) {
        // Rollback
        setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, hasApplied: false } : d));
      } else {
        await fetchApps();
      }
    } catch {
      setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, hasApplied: false } : d));
    } finally {
      setApplyingId(null);
      setApplyNote('');
    }
  };

  const handleWithdraw = async (appId: string) => {
    setWithdrawingId(appId);
    // Optimistic: set status to WITHDRAWN
    setMyApps((prev) =>
      prev.map((a) => a.id === appId ? { ...a, status: 'WITHDRAWN' as AppStatus } : a)
    );
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}/withdraw`, { method: 'POST' });
      if (!res.ok) {
        await fetchApps(); // Revert on error
      } else {
        await fetchDrives();
      }
    } catch {
      await fetchApps();
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleAcknowledge = async (interviewId: string) => {
    try {
      await fetch(`/api/recruitment/interviews/${interviewId}/acknowledge`, { method: 'POST' });
      setMyInterviews((prev) =>
        prev.map((i) => i.id === interviewId ? { ...i, status: 'ACKNOWLEDGED' as InterviewStatus } : i)
      );
    } catch {
      // Non-critical
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/recruitment/placement-notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Non-critical
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const eligibilityTag = (drive: PlacementDrive) => {
    const dm = drive.driveMatch;
    if (!dm) return null;
    if (dm.eligibilityStatus === 'ELIGIBLE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Eligible
        </span>
      );
    }
    const reasons = dm.failingCriteria?.slice(0, 2).join(', ') || 'criteria not met';
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
        <span className="material-symbols-outlined text-[14px]">cancel</span>
        Not Eligible ({reasons})
      </span>
    );
  };

  const canApply = (drive: PlacementDrive) => {
    if (drive.status !== 'PUBLISHED') return false;
    if (drive.hasApplied) return false;
    if (new Date(drive.applicationDeadline) < new Date()) return false;
    const dm = drive.driveMatch;
    if (dm && dm.eligibilityStatus === 'NOT_ELIGIBLE') return false;
    return true;
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabClass = (t: typeof activeTab) =>
    `px-4 py-2 font-label-lg text-label-lg rounded-lg transition-colors ${
      activeTab === t
        ? 'bg-secondary text-on-secondary shadow-xs'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
    }`;

  return (
    <div className="space-y-space-md animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
        <div>
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
            Placement Cell · Recruitment Automation
          </span>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-extrabold tracking-tight">
            My Recruitment Dashboard
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {profile.name.split(' ')[0]} · {profile.department} · CGPA {profile.cgpa.toFixed(2)}
          </p>
        </div>

        {/* Notifications Bell */}
        <div className="relative shrink-0" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) fetchNotifications(); }}
            className="relative p-2.5 rounded-xl border border-surface-container-low bg-surface-container-lowest hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-error text-on-error text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-surface-container-low rounded-2xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container-low">
                <span className="font-label-lg font-bold text-on-surface">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[11px] font-semibold text-secondary hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-surface-container-low">
                {loadingNotifs ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 rounded-full border-2 border-secondary border-t-transparent animate-spin" /></div>
                ) : notifications.length === 0 ? (
                  <p className="text-center text-sm text-outline py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 15).map((n) => (
                    <div key={n.id} className={`px-4 py-3 ${!n.isRead ? 'bg-secondary/5' : ''}`}>
                      <div className="flex gap-2 items-start">
                        {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-secondary shrink-0" />}
                        <div>
                          <p className="font-label-md font-semibold text-on-surface text-[13px]">{n.title}</p>
                          <p className="text-[12px] text-on-surface-variant leading-snug mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-outline mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-2">
        <button className={tabClass('drives')} onClick={() => setActiveTab('drives')}>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">business_center</span>
            Available Drives
          </span>
        </button>
        <button className={tabClass('applications')} onClick={() => setActiveTab('applications')}>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">send</span>
            My Applications
            {myApps.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold">{myApps.length}</span>}
          </span>
        </button>
        <button className={tabClass('interviews')} onClick={() => setActiveTab('interviews')}>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            Upcoming Interviews
            {myInterviews.filter(i => i.status === 'SCHEDULED').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 text-[10px] font-bold">
                {myInterviews.filter(i => i.status === 'SCHEDULED').length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ── Tab: Available Drives ─────────────────────────────────────────────── */}
      {activeTab === 'drives' && (
        <div>
          {errorDrives && <ErrorBanner msg={errorDrives} onRetry={fetchDrives} />}
          {loadingDrives ? (
            <Spinner />
          ) : drives.length === 0 ? (
            <EmptyState icon="business_center" title="No drives yet" subtitle="New placement drives will appear here when published by the placement cell." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-sm">
              {drives.map((drive) => (
                <div key={drive.id} className="bg-surface-container-lowest border border-surface-container-low rounded-2xl shadow-xs p-space-md flex flex-col gap-3">
                  {/* Company header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {drive.company.logoUrl ? (
                        <img src={drive.company.logoUrl} alt={drive.company.name} className="w-10 h-10 rounded-xl object-contain border border-surface-container" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[20px] text-secondary">apartment</span>
                        </div>
                      )}
                      <div>
                        <p className="font-label-lg font-bold text-on-surface leading-tight">{drive.company.name}</p>
                        <p className="text-[12px] text-on-surface-variant">{drive.jobTitle}</p>
                      </div>
                    </div>
                    {driveBadge(drive.status)}
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-on-surface-variant">
                    {drive.location && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {drive.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">payments</span>
                      {ctcRange(drive.ctcMin, drive.ctcMax)}
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${new Date(drive.applicationDeadline) < new Date() ? 'text-red-500' : 'text-secondary'}`}>
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {formatDeadline(drive.applicationDeadline)}
                    </span>
                  </div>

                  {/* Eligibility */}
                  <div>{eligibilityTag(drive)}</div>

                  {/* Expanded description */}
                  {expandedDrive === drive.id && (
                    <p className="text-[12px] text-on-surface-variant leading-relaxed border-t border-surface-container-low pt-2">
                      {drive.jobDescription}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-1">
                    <button
                      onClick={() => setExpandedDrive(expandedDrive === drive.id ? null : drive.id)}
                      className="flex-1 text-[13px] font-semibold px-3 py-2 rounded-xl border border-secondary text-secondary hover:bg-secondary/5 transition-colors"
                    >
                      {expandedDrive === drive.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {drive.hasApplied ? (
                      <span className="flex-1 flex items-center justify-center gap-1 text-[13px] font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Applied
                      </span>
                    ) : (
                      <button
                        disabled={!canApply(drive) || applyingId === drive.id}
                        onClick={() => { setApplyModalDriveId(drive.id); setApplyNote(''); }}
                        className={`flex-1 text-[13px] font-semibold px-3 py-2 rounded-xl transition-colors ${
                          canApply(drive)
                            ? 'bg-secondary text-on-secondary hover:bg-secondary-container shadow-xs'
                            : 'bg-surface-container text-outline cursor-not-allowed'
                        }`}
                      >
                        {applyingId === drive.id ? 'Applying…' : 'Apply Now'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Apply modal */}
          {applyModalDriveId && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-surface-container-lowest rounded-2xl shadow-lg w-full max-w-md p-6 space-y-4">
                <h3 className="font-headline-sm font-bold text-on-surface">Apply to Drive</h3>
                <p className="text-sm text-on-surface-variant">
                  {drives.find((d) => d.id === applyModalDriveId)?.company.name} ·{' '}
                  {drives.find((d) => d.id === applyModalDriveId)?.jobTitle}
                </p>
                <textarea
                  rows={4}
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="Optional cover note (max 500 chars)…"
                  maxLength={500}
                  className="w-full text-sm rounded-xl border border-surface-container-low bg-surface-container p-3 text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-secondary"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setApplyModalDriveId(null)}
                    className="px-4 py-2 rounded-xl border border-surface-container-low text-on-surface-variant text-sm hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApply(applyModalDriveId)}
                    className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-sm font-semibold hover:bg-secondary-container shadow-xs"
                  >
                    Submit Application
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: My Applications ──────────────────────────────────────────────── */}
      {activeTab === 'applications' && (
        <div>
          {errorApps && <ErrorBanner msg={errorApps} onRetry={fetchApps} />}
          {loadingApps ? (
            <Spinner />
          ) : myApps.length === 0 ? (
            <EmptyState icon="send" title="No applications yet" subtitle="Apply to available drives and your applications will appear here." />
          ) : (
            <div className="flex flex-col gap-space-sm">
              {myApps.map((app) => (
                <div key={app.id} className="bg-surface-container-lowest border border-surface-container-low rounded-2xl shadow-xs p-space-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-label-lg font-bold text-on-surface">{app.drive.company.name}</p>
                      <p className="text-[13px] text-on-surface-variant">{app.drive.jobTitle}</p>
                      <p className="text-[12px] text-outline mt-0.5">Applied {formatDate(app.appliedAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {statusBadge(app.status)}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                          className="text-[12px] font-semibold text-secondary hover:underline"
                        >
                          {expandedApp === app.id ? 'Hide history' : 'View history'}
                        </button>
                        {(app.status === 'APPLIED' || app.status === 'UNDER_REVIEW') && (
                          <button
                            disabled={withdrawingId === app.id}
                            onClick={() => handleWithdraw(app.id)}
                            className="text-[12px] font-semibold text-red-500 hover:underline disabled:opacity-50"
                          >
                            {withdrawingId === app.id ? 'Withdrawing…' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status history timeline */}
                  {expandedApp === app.id && app.statusHistory && app.statusHistory.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-surface-container space-y-3">
                      {app.statusHistory.map((h, idx) => (
                        <div key={idx} className="relative flex items-start gap-3">
                          <div className="absolute -left-[21px] mt-0.5 w-4 h-4 rounded-full border-2 border-secondary bg-surface-container-lowest flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          </div>
                          <div>
                            {statusBadge(h.status)}
                            <p className="text-[11px] text-outline mt-0.5">{formatDateTime(h.changedAt)}</p>
                            {h.note && <p className="text-[12px] text-on-surface-variant mt-0.5">{h.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Upcoming Interviews ──────────────────────────────────────────── */}
      {activeTab === 'interviews' && (
        <div>
          {errorInterviews && <ErrorBanner msg={errorInterviews} onRetry={fetchInterviews} />}
          {loadingInterviews ? (
            <Spinner />
          ) : myInterviews.length === 0 ? (
            <EmptyState icon="calendar_today" title="No interviews scheduled" subtitle="When you get shortlisted, your interview schedule will appear here." />
          ) : (
            <div className="flex flex-col gap-space-sm">
              {myInterviews.map((iv) => (
                <div key={iv.id} className={`bg-surface-container-lowest border rounded-2xl shadow-xs p-space-md flex flex-col sm:flex-row gap-4 ${
                  iv.status === 'SCHEDULED' ? 'border-purple-200 dark:border-purple-800' : 'border-surface-container-low'
                }`}>
                  <div className="flex flex-col items-center justify-center sm:w-24 shrink-0 text-center">
                    <span className="font-headline-xl text-headline-xl font-extrabold text-secondary">
                      {new Date(iv.scheduledAt).getDate()}
                    </span>
                    <span className="font-label-sm text-outline uppercase">
                      {new Date(iv.scheduledAt).toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                    <span className="text-[11px] font-semibold text-secondary mt-1">
                      {formatCountdown(iv.scheduledAt)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-label-lg font-bold text-on-surface">{iv.application.drive.company.name}</p>
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        iv.mode === 'ONLINE'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {iv.mode}
                      </span>
                    </div>
                    <p className="text-[13px] text-on-surface-variant">{iv.application.drive.jobTitle}</p>
                    <p className="text-[12px] text-outline mt-0.5">
                      {formatDateTime(iv.scheduledAt)} · {iv.durationMins} mins
                    </p>
                    {iv.mode === 'ONLINE' && iv.meetingLink && (
                      <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-semibold text-secondary hover:underline">
                        <span className="material-symbols-outlined text-[14px]">video_call</span>
                        Join Meeting
                      </a>
                    )}
                    {iv.mode === 'OFFLINE' && iv.location && (
                      <p className="flex items-center gap-1 mt-1.5 text-[12px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {iv.location}
                      </p>
                    )}
                    {iv.instructions && (
                      <p className="mt-2 text-[12px] text-on-surface-variant bg-surface-container rounded-lg p-2">
                        <span className="font-semibold">Instructions:</span> {iv.instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                    <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      iv.status === 'SCHEDULED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                      iv.status === 'ACKNOWLEDGED' ? 'bg-green-100 text-green-700' :
                      iv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {iv.status.replace('_', ' ')}
                    </span>
                    {iv.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handleAcknowledge(iv.id)}
                        className="text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-xs"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
