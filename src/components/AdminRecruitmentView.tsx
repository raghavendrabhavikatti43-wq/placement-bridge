import React, { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
}

interface PlacementDrive {
  id: string;
  jobTitle: string;
  jobDescription: string;
  location: string | null;
  ctcMin: number | null;
  ctcMax: number | null;
  eligibilityCriteria: {
    minCgpa?: number | null;
    maxActiveBacklogs?: number | null;
    allowedBranches?: string[] | null;
  } | null;
  applicationDeadline: string;
  driveDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
  company: { name: string };
  _count?: { applications: number };
}

interface ApplicationItem {
  id: string;
  status: string;
  createdAt: string;
  coverNote: string | null;
  student: {
    name: string;
    user: { email: string };
    cgpa?: number | null;
    branch?: string | null;
  };
  statusHistory: {
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
    note: string | null;
  }[];
}

interface DriveForm {
  companyId: string;
  jobTitle: string;
  jobDescription: string;
  location: string;
  ctcMin: string;
  ctcMax: string;
  applicationDeadline: string;
  driveDate: string;
  minCgpa: string;
  maxActiveBacklogs: string;
  allowedBranches: string;
}

interface InterviewForm {
  scheduledAt: string;
  durationMins: string;
  mode: 'ONLINE' | 'OFFLINE';
  meetingLink: string;
  location: string;
  instructions: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CLOSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const APP_STATUS_COLORS: Record<string, string> = {
  APPLIED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  SHORTLISTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  SELECTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  WITHDRAWN: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED'],
  SELECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

// ── Main Panel ────────────────────────────────────────────────────────────────

interface AdminRecruitmentPanelProps {
  token: string;
}

export const AdminRecruitmentPanel: React.FC<AdminRecruitmentPanelProps> = ({ token }) => {
  const [tab, setTab] = useState<'drives' | 'applicants' | 'analytics'>('drives');
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showInterviewForm, setShowInterviewForm] = useState<string | null>(null); // applicationId

  const [form, setForm] = useState<DriveForm>({
    companyId: '',
    jobTitle: '',
    jobDescription: '',
    location: '',
    ctcMin: '',
    ctcMax: '',
    applicationDeadline: '',
    driveDate: '',
    minCgpa: '',
    maxActiveBacklogs: '',
    allowedBranches: '',
  });

  const [interviewForm, setInterviewForm] = useState<InterviewForm>({
    scheduledAt: '',
    durationMins: '60',
    mode: 'ONLINE',
    meetingLink: '',
    location: '',
    instructions: '',
  });

  const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch drives ──────────────────────────────────────────────────────────
  const fetchDrives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recruitment/drives', { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load drives');
      setDrives(data.data?.drives ?? data.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load drives');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Fetch companies for dropdown ──────────────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=200', { headers: authHeader });
      const data = await res.json();
      setCompanies(data.data?.companies ?? data.data ?? []);
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => {
    fetchDrives();
    fetchCompanies();
  }, [fetchDrives, fetchCompanies]);

  // ── Fetch applications for selected drive ─────────────────────────────────
  const fetchApplications = useCallback(async (driveId: string) => {
    setAppsLoading(true);
    try {
      const res = await fetch(`/api/recruitment/drives/${driveId}/applications`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load applications');
      setApplications(data.data?.applications ?? data.data ?? []);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to load applications', false);
    } finally {
      setAppsLoading(false);
    }
  }, [token]);

  // ── Reset form ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ companyId: '', jobTitle: '', jobDescription: '', location: '', ctcMin: '', ctcMax: '', applicationDeadline: '', driveDate: '', minCgpa: '', maxActiveBacklogs: '', allowedBranches: '' });
    setEditingDrive(null);
    setShowDriveForm(false);
  };

  // ── Prefill form for editing ──────────────────────────────────────────────
  const openEditForm = (drive: PlacementDrive) => {
    setEditingDrive(drive);
    setForm({
      companyId: drive.company.name, // We store name but need id; not ideal but company may not have id here
      jobTitle: drive.jobTitle,
      jobDescription: drive.jobDescription,
      location: drive.location ?? '',
      ctcMin: drive.ctcMin != null ? String(drive.ctcMin) : '',
      ctcMax: drive.ctcMax != null ? String(drive.ctcMax) : '',
      applicationDeadline: drive.applicationDeadline ? new Date(drive.applicationDeadline).toISOString().slice(0, 16) : '',
      driveDate: drive.driveDate ? new Date(drive.driveDate).toISOString().slice(0, 16) : '',
      minCgpa: drive.eligibilityCriteria?.minCgpa != null ? String(drive.eligibilityCriteria.minCgpa) : '',
      maxActiveBacklogs: drive.eligibilityCriteria?.maxActiveBacklogs != null ? String(drive.eligibilityCriteria.maxActiveBacklogs) : '',
      allowedBranches: drive.eligibilityCriteria?.allowedBranches?.join(', ') ?? '',
    });
    setShowDriveForm(true);
  };

  // ── Create / Update drive ─────────────────────────────────────────────────
  const handleSubmitDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const payload = {
        companyId: form.companyId,
        jobTitle: form.jobTitle,
        jobDescription: form.jobDescription,
        location: form.location || undefined,
        ctcMin: form.ctcMin ? Number(form.ctcMin) : undefined,
        ctcMax: form.ctcMax ? Number(form.ctcMax) : undefined,
        applicationDeadline: new Date(form.applicationDeadline).toISOString(),
        driveDate: form.driveDate ? new Date(form.driveDate).toISOString() : undefined,
        eligibilityCriteria: {
          minCgpa: form.minCgpa ? Number(form.minCgpa) : undefined,
          maxActiveBacklogs: form.maxActiveBacklogs ? Number(form.maxActiveBacklogs) : undefined,
          allowedBranches: form.allowedBranches ? form.allowedBranches.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        },
      };
      const url = editingDrive ? `/api/recruitment/drives/${editingDrive.id}` : '/api/recruitment/drives';
      const method = editingDrive ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeader, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save drive');
      showToast(editingDrive ? 'Drive updated!' : 'Drive created as DRAFT!');
      resetForm();
      fetchDrives();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to save drive', false);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Publish drive ─────────────────────────────────────────────────────────
  const handlePublish = async (drive: PlacementDrive) => {
    if (!confirm(`Publish "${drive.jobTitle}"? This will notify eligible students.`)) return;
    try {
      const res = await fetch(`/api/recruitment/drives/${drive.id}/publish`, { method: 'POST', headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to publish');
      showToast('Drive published! Eligible students notified.');
      fetchDrives();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to publish', false);
    }
  };

  // ── Close drive ───────────────────────────────────────────────────────────
  const handleClose = async (drive: PlacementDrive) => {
    if (!confirm(`Close "${drive.jobTitle}"? This will stop new applications.`)) return;
    try {
      const res = await fetch(`/api/recruitment/drives/${drive.id}/close`, { method: 'POST', headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to close');
      showToast('Drive closed.');
      fetchDrives();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to close', false);
    }
  };

  // ── Update application status ─────────────────────────────────────────────
  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}/status`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update status');
      showToast(`Status updated to ${newStatus}`);
      if (selectedDrive) fetchApplications(selectedDrive.id);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update status', false);
    }
  };

  // ── Schedule interview ────────────────────────────────────────────────────
  const handleScheduleInterview = async (appId: string) => {
    try {
      const payload = {
        scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
        durationMins: Number(interviewForm.durationMins),
        mode: interviewForm.mode,
        meetingLink: interviewForm.mode === 'ONLINE' ? interviewForm.meetingLink : undefined,
        location: interviewForm.mode === 'OFFLINE' ? interviewForm.location : undefined,
        instructions: interviewForm.instructions || undefined,
      };
      const res = await fetch(`/api/recruitment/applications/${appId}/interview`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to schedule interview');
      showToast('Interview scheduled!');
      setShowInterviewForm(null);
      setInterviewForm({ scheduledAt: '', durationMins: '60', mode: 'ONLINE', meetingLink: '', location: '', instructions: '' });
      if (selectedDrive) fetchApplications(selectedDrive.id);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to schedule interview', false);
    }
  };

  // ── Analytics helpers ─────────────────────────────────────────────────────
  const stats = {
    total: drives.length,
    published: drives.filter(d => d.status === 'PUBLISHED').length,
    closed: drives.filter(d => d.status === 'CLOSED').length,
    draft: drives.filter(d => d.status === 'DRAFT').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <span className="material-symbols-outlined text-[18px]">{toast.ok ? 'check_circle' : 'error'}</span>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['drives', 'applicants', 'analytics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            {t === 'drives' ? 'Drives' : t === 'applicants' ? 'Applicants' : 'Analytics'}
          </button>
        ))}
      </div>

      {/* ── DRIVES TAB ── */}
      {tab === 'drives' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Placement Drives ({drives.length})</h2>
            <button
              onClick={() => { resetForm(); setShowDriveForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Drive
            </button>
          </div>

          {/* Drive Form */}
          {showDriveForm && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                {editingDrive ? 'Edit Drive' : 'Create New Drive'}
              </h3>
              <form onSubmit={handleSubmitDrive} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company *</label>
                    <select
                      required
                      value={form.companyId}
                      onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                    >
                      <option value="">Select company</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Job Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Title *</label>
                    <input required value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="e.g. Software Engineer (SDE-1)" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* Location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Location</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Bangalore, Remote" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* CTC */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">CTC Min (LPA)</label>
                      <input type="number" step="0.5" min="0" value={form.ctcMin} onChange={e => setForm(f => ({ ...f, ctcMin: e.target.value }))} placeholder="6" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">CTC Max (LPA)</label>
                      <input type="number" step="0.5" min="0" value={form.ctcMax} onChange={e => setForm(f => ({ ...f, ctcMax: e.target.value }))} placeholder="12" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                    </div>
                  </div>
                  {/* Deadline */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Application Deadline *</label>
                    <input required type="datetime-local" value={form.applicationDeadline} onChange={e => setForm(f => ({ ...f, applicationDeadline: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* Drive Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Drive Date</label>
                    <input type="datetime-local" value={form.driveDate} onChange={e => setForm(f => ({ ...f, driveDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* Min CGPA */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Min CGPA (eligibility)</label>
                    <input type="number" step="0.1" min="0" max="10" value={form.minCgpa} onChange={e => setForm(f => ({ ...f, minCgpa: e.target.value }))} placeholder="6.5" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* Max Backlogs */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Max Active Backlogs</label>
                    <input type="number" min="0" value={form.maxActiveBacklogs} onChange={e => setForm(f => ({ ...f, maxActiveBacklogs: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                  {/* Branches */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Allowed Branches (comma-separated, leave blank for all)</label>
                    <input value={form.allowedBranches} onChange={e => setForm(f => ({ ...f, allowedBranches: e.target.value }))} placeholder="CSE, IT, ECE" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                  </div>
                </div>
                {/* Job Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Description *</label>
                  <textarea required rows={4} value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} placeholder="Describe the role, responsibilities, and required skills..." className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={formSubmitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
                    {formSubmitting ? 'Saving…' : editingDrive ? 'Save Changes' : 'Create Draft'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Drives list */}
          {loading ? (
            <div className="flex items-center gap-3 py-12 justify-center text-slate-500">
              <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
              Loading drives…
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 text-sm">
              {error}
              <button onClick={fetchDrives} className="ml-3 underline font-semibold">Retry</button>
            </div>
          ) : drives.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-[48px] block mb-3">work_outline</span>
              No placement drives yet. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {drives.map(drive => (
                <div key={drive.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[drive.status]}`}>{drive.status}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{drive.company.name}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{drive.jobTitle}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {drive.location && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">location_on</span>{drive.location}</span>}
                      {(drive.ctcMin || drive.ctcMax) && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">currency_rupee</span>
                          {drive.ctcMin && drive.ctcMax ? `${drive.ctcMin}–${drive.ctcMax} LPA` : `${drive.ctcMin || drive.ctcMax} LPA`}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span>Deadline: {new Date(drive.applicationDeadline).toLocaleDateString('en-IN')}</span>
                      {drive._count?.applications !== undefined && (
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span>{drive._count.applications} applicants</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {drive.status === 'DRAFT' && (
                      <>
                        <button onClick={() => openEditForm(drive)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">Edit</button>
                        <button onClick={() => handlePublish(drive)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">Publish</button>
                      </>
                    )}
                    {drive.status === 'PUBLISHED' && (
                      <>
                        <button
                          onClick={() => { setSelectedDrive(drive); setTab('applicants'); fetchApplications(drive.id); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        >
                          View Applicants
                        </button>
                        <button onClick={() => handleClose(drive)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors">Close</button>
                      </>
                    )}
                    {(drive.status === 'CLOSED' || drive.status === 'CANCELLED') && (
                      <button
                        onClick={() => { setSelectedDrive(drive); setTab('applicants'); fetchApplications(drive.id); }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        View Applicants
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── APPLICANTS TAB ── */}
      {tab === 'applicants' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {selectedDrive ? `${selectedDrive.jobTitle} — Applicants` : 'Select a drive to view applicants'}
            </h2>
            {selectedDrive && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedDrive.status]}`}>{selectedDrive.status}</span>
            )}
          </div>

          {!selectedDrive ? (
            <div className="text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-[48px] block mb-3">manage_search</span>
              Go to Drives tab and click "View Applicants" for a drive.
            </div>
          ) : appsLoading ? (
            <div className="flex items-center gap-3 py-12 justify-center text-slate-500">
              <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
              Loading applicants…
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-[48px] block mb-3">inbox</span>
              No applications yet for this drive.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Student</th>
                    <th className="text-left py-3 px-4 font-semibold">Applied</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {applications.map(app => (
                    <React.Fragment key={app.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{app.student.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{app.student.user.email}</div>
                          {app.student.cgpa && <div className="text-xs text-slate-400">CGPA: {app.student.cgpa}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(app.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${APP_STATUS_COLORS[app.status] ?? ''}`}>
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Status transitions */}
                            {ALLOWED_TRANSITIONS[app.status]?.map(next => (
                              <button
                                key={next}
                                onClick={() => handleStatusChange(app.id, next)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${next === 'REJECTED' ? 'border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                              >
                                → {next.replace(/_/g, ' ')}
                              </button>
                            ))}
                            {/* Interview button for shortlisted */}
                            {app.status === 'SHORTLISTED' && (
                              <button
                                onClick={() => setShowInterviewForm(app.id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                              >
                                📅 Schedule
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Interview form for this application */}
                      {showInterviewForm === app.id && (
                        <tr className="bg-purple-50 dark:bg-purple-900/10">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="max-w-2xl">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Schedule Interview for {app.student.name}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Date & Time *</label>
                                  <input type="datetime-local" required value={interviewForm.scheduledAt} onChange={e => setInterviewForm(f => ({ ...f, scheduledAt: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Duration (mins)</label>
                                  <input type="number" min="15" max="180" value={interviewForm.durationMins} onChange={e => setInterviewForm(f => ({ ...f, durationMins: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mode</label>
                                  <div className="flex gap-3">
                                    {(['ONLINE', 'OFFLINE'] as const).map(m => (
                                      <label key={m} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input type="radio" checked={interviewForm.mode === m} onChange={() => setInterviewForm(f => ({ ...f, mode: m }))} />
                                        {m}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                {interviewForm.mode === 'ONLINE' ? (
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Meeting Link</label>
                                    <input type="url" value={interviewForm.meetingLink} onChange={e => setInterviewForm(f => ({ ...f, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Location</label>
                                    <input value={interviewForm.location} onChange={e => setInterviewForm(f => ({ ...f, location: e.target.value }))} placeholder="Room 204, Admin Block" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" />
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Instructions</label>
                                  <textarea rows={2} value={interviewForm.instructions} onChange={e => setInterviewForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Carry your resume, ID proof..." className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm resize-none" />
                                </div>
                              </div>
                              <div className="flex gap-3 mt-3">
                                <button onClick={() => handleScheduleInterview(app.id)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors">
                                  Schedule Interview
                                </button>
                                <button onClick={() => setShowInterviewForm(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Drives', value: stats.total, icon: 'work', color: 'indigo' },
              { label: 'Published', value: stats.published, icon: 'published_with_changes', color: 'emerald' },
              { label: 'Closed', value: stats.closed, icon: 'check_circle', color: 'blue' },
              { label: 'Drafts', value: stats.draft, icon: 'edit_note', color: 'amber' },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <span className={`material-symbols-outlined text-[28px] text-${card.color}-600 dark:text-${card.color}-400`}>{card.icon}</span>
                <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Drive status breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Drive Status Breakdown</h3>
            {drives.length === 0 ? (
              <p className="text-slate-400 text-sm">No drives yet.</p>
            ) : (
              <div className="space-y-3">
                {(['PUBLISHED', 'DRAFT', 'CLOSED', 'CANCELLED'] as const).map(status => {
                  const count = drives.filter(d => d.status === status).length;
                  const pct = drives.length > 0 ? Math.round((count / drives.length) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-semibold text-slate-600 dark:text-slate-400">{status}</div>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${status === 'PUBLISHED' ? 'bg-emerald-500' : status === 'DRAFT' ? 'bg-amber-500' : status === 'CLOSED' ? 'bg-blue-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 w-8 text-right">{count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent drives list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Published Drives Overview</h3>
            {drives.filter(d => d.status === 'PUBLISHED').length === 0 ? (
              <p className="text-slate-400 text-sm">No published drives.</p>
            ) : (
              <div className="space-y-3">
                {drives.filter(d => d.status === 'PUBLISHED').map(drive => (
                  <div key={drive.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{drive.jobTitle}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{drive.company.name} · Deadline: {new Date(drive.applicationDeadline).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{drive._count?.applications ?? 0}</div>
                      <div className="text-xs text-slate-400">applicants</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecruitmentPanel;
