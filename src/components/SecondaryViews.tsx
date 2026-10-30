import React, { useState } from 'react';
import {
  ApplicationRecord,
  ApplicationStatus,
  CompanyDrive,
  NavigationPath,
  PortalSettings,
  ResourceItem,
  StudentProfile,
  StudyPlanModule,
} from '../types';
import { RESOURCE_ITEMS } from '../data/placementData';
import { ThemeModeSelector } from '../context/ThemeContext';

interface SecondaryViewsProps {
  currentPath: NavigationPath;
  profile: StudentProfile;
  companies: CompanyDrive[];
  applications: ApplicationRecord[];
  studyModules: StudyPlanModule[];
  settings: PortalSettings;
  onToggleStudyModule: (id: string) => void;
  onAddStudyModule: (mod: StudyPlanModule) => void;
  onUpdateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  onUpdateApplicationNotes: (id: string, notes: string) => void;
  onUpdateSettings: (next: PortalSettings) => void;
  onResetDemoState: () => void;
  onNavigate: (path: NavigationPath) => void;
}

export const SecondaryViews: React.FC<SecondaryViewsProps> = ({
  currentPath,
  profile,
  applications,
  studyModules,
  settings,
  onToggleStudyModule,
  onAddStudyModule,
  onUpdateApplicationStatus,
  onUpdateApplicationNotes,
  onUpdateSettings,
  onResetDemoState,
  onNavigate,
}) => {
  // Study Plan local state
  const [newModTitle, setNewModTitle] = useState('');
  const [newModWeek, setNewModWeek] = useState<1 | 2 | 3>(1);
  const [newModDuration, setNewModDuration] = useState('2.0 hrs');

  // Applications local state
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // Resources local state
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceCat, setResourceCat] = useState<string>('All');
  const [activeResource, setActiveResource] = useState<ResourceItem | null>(RESOURCE_ITEMS[0]);

  // Settings local state
  const [confirmReset, setConfirmReset] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 1. STUDY PLAN VIEW
  if (currentPath === 'study-plan') {
    const completedTotal = studyModules.filter((m) => m.completed).length;
    const pctTotal = Math.round((completedTotal / Math.max(1, studyModules.length)) * 100);

    const handleCreateModule = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newModTitle.trim()) return;
      onAddStudyModule({
        id: `sp-${Date.now()}`,
        week: newModWeek,
        dayRange: 'Custom Slot',
        title: newModTitle.trim(),
        category: 'Targeted Sprint',
        duration: newModDuration,
        completed: false,
      });
      setNewModTitle('');
    };

    return (
      <div id="study-plan-view" className="space-y-space-md animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-outline block mb-1">
              Preparation Hub · Personalized Calendar Roadmap
            </span>
            <h1 className="font-headline-xl text-on-surface font-extrabold">
              3-Week Targeted Study Plan
            </h1>
            <p className="font-body-md text-on-surface-variant mt-1">
              Calibrated to close your Trees, Graphs &amp; Dynamic Programming gaps ahead of Day-0 assessments.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 tabular-nums">
            <div className="text-right">
              <span className="text-xs text-outline block">Overall Completion</span>
              <span className="font-headline-sm text-secondary font-extrabold">
                {completedTotal} / {studyModules.length} ({pctTotal}%)
              </span>
            </div>
            <button
              onClick={() => onNavigate('ai-assistant')}
              className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
            >
              Recalibrate with AI
            </button>
          </div>
        </div>

        {/* Add Custom Study Milestone */}
        <form
          onSubmit={handleCreateModule}
          className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center text-xs"
        >
          <input
            type="text"
            placeholder="Add study milestone (e.g., Revise Segment Trees & Fenwick Trees)..."
            value={newModTitle}
            onChange={(e) => setNewModTitle(e.target.value)}
            className="md:col-span-6 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
          />
          <select
            value={newModWeek}
            onChange={(e) => setNewModWeek(Number(e.target.value) as 1 | 2 | 3)}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-semibold outline-none"
          >
            <option value={1}>Week 1</option>
            <option value={2}>Week 2</option>
            <option value={3}>Week 3</option>
          </select>
          <select
            value={newModDuration}
            onChange={(e) => setNewModDuration(e.target.value)}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-semibold outline-none"
          >
            <option value="1.5 hrs">1.5 hrs</option>
            <option value="2.0 hrs">2.0 hrs</option>
            <option value="3.0 hrs">3.0 hrs</option>
          </select>
          <button
            type="submit"
            className="md:col-span-2 py-2 px-3 rounded-xl bg-surface-container-highest text-primary font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap"
          >
            Add Milestone
          </button>
        </form>

        {/* 3 Week Interactive Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm">
          {([1, 2, 3] as const).map((wk) => {
            const wkMods = studyModules.filter((m) => m.week === wk);
            const wkDone = wkMods.filter((m) => m.completed).length;
            const wkPct = Math.round((wkDone / Math.max(1, wkMods.length)) * 100);
            const wkTitles: Record<1 | 2 | 3, string> = {
              1: 'Week 1: Trees, Graphs & OA Speed',
              2: 'Week 2: Dynamic Programming Mastery',
              3: 'Week 3: Systems, SQL & Mock Panels',
            };

            return (
              <div
                key={wk}
                className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3"
              >
                <div className="pb-2 border-b border-surface-container-low space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-on-surface text-sm">{wkTitles[wk]}</span>
                    <span className="font-mono text-xs font-bold text-secondary tabular-nums">
                      {wkPct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-full rounded-full transition-all"
                      style={{ width: `${wkPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {wkMods.map((mod) => (
                    <div
                      key={mod.id}
                      onClick={() => onToggleStudyModule(mod.id)}
                      className="p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low cursor-pointer transition-colors flex items-start gap-2.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={mod.completed}
                        onChange={() => {}}
                        className="mt-0.5 w-4 h-4 rounded text-secondary cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] text-outline mb-0.5">
                          <span>{mod.dayRange} · {mod.category}</span>
                          <span className="tabular-nums">{mod.duration}</span>
                        </div>
                        <span
                          className={`font-semibold block ${
                            mod.completed ? 'line-through text-outline' : 'text-on-surface'
                          }`}
                        >
                          {mod.title}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. PROGRESS & ANALYTICS VIEW
  if (currentPath === 'progress-analytics') {
    const mockHistory = [
      { exam: 'Mock Gate #1', date: 'Sep 18', score: 58, percentile: 64 },
      { exam: 'Mock Gate #2', date: 'Sep 26', score: 63, percentile: 70 },
      { exam: 'Mock Gate #3', date: 'Oct 04', score: 67, percentile: 75 },
      { exam: 'Mock Gate #4', date: 'Oct 12', score: 71, percentile: 79 },
      { exam: 'Mock Gate #5', date: 'Oct 20', score: 75, percentile: 82 },
      { exam: 'Mock Gate #6', date: 'Oct 27', score: 78, percentile: 86 },
    ];

    const domainMatrix = [
      { domain: 'Quantitative & Speed Math', solved: 112, accuracy: 86, avgTime: '52s', status: 'Exceeds Day-0 Cutoff' },
      { domain: 'Logical & Analytical Reasoning', solved: 84, accuracy: 82, avgTime: '61s', status: 'Exceeds Day-0 Cutoff' },
      { domain: 'Arrays, Hashing & Two Pointers', solved: 96, accuracy: 79, avgTime: '14m', status: 'Ready' },
      { domain: 'DBMS, SQL & Indexing', solved: 48, accuracy: 68, avgTime: '95s', status: 'Moderate Deficit' },
      { domain: 'Trees, Graphs & Topological Sort', solved: 34, accuracy: 52, avgTime: '26m', status: 'Active Sprint' },
      { domain: 'Dynamic Programming (1D/2D)', solved: 19, accuracy: 41, avgTime: '34m', status: 'Critical Focus' },
    ];

    return (
      <div id="progress-analytics-view" className="space-y-space-md animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-outline block mb-1">
              Career Tracking · Longitudinal Performance Telemetry
            </span>
            <h1 className="font-headline-xl text-on-surface font-extrabold">
              Progress &amp; Readiness Analytics
            </h1>
            <p className="font-body-md text-on-surface-variant mt-1">
              Six-week mock assessment trajectory, sectional accuracy, and coding problem velocity.
            </p>
          </div>
          <button
            onClick={() => onNavigate('practice-hub')}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
          >
            Take New Diagnostic Drill
          </button>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm tabular-nums">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
            <span className="text-xs text-outline font-semibold block mb-1">Problems Solved</span>
            <span className="font-headline-xl text-on-surface font-extrabold">
              {profile.leetcodeSolved}
            </span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">+24 in last 14 days</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
            <span className="text-xs text-outline font-semibold block mb-1">Mock Score Gain</span>
            <span className="font-headline-xl text-secondary font-extrabold">+20 pts</span>
            <span className="text-xs text-on-surface-variant block mt-1">From 58% to 78% over 6 tests</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
            <span className="text-xs text-outline font-semibold block mb-1">Batch Standing</span>
            <span className="font-headline-xl text-on-surface font-extrabold">86th %ile</span>
            <span className="text-xs text-on-surface-variant block mt-1">Top 70 of 480 CSE candidates</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
            <span className="text-xs text-outline font-semibold block mb-1">Avg Coding Speed</span>
            <span className="font-headline-xl text-on-surface font-extrabold">18.4 min</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">-4.2 min faster vs Sep</span>
          </div>
        </div>

        {/* Trajectory Bar Chart + Domain Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
          <div className="lg:col-span-5 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col justify-between space-y-4">
            <div>
              <h2 className="font-headline-sm text-on-surface font-bold pb-2 border-b border-surface-container-low">
                Mock Assessment Score Trajectory
              </h2>
              <p className="text-xs text-outline mt-1">
                Composite OA percentage across bi-weekly institutional proctored mocks
              </p>
            </div>

            <div className="grid grid-cols-6 gap-2.5 items-end h-48 pt-6 tabular-nums">
              {mockHistory.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-secondary">
                    {item.score}%
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      idx === mockHistory.length - 1 ? 'bg-secondary' : 'bg-surface-container-highest'
                    }`}
                    style={{ height: `${item.score}%` }}
                  />
                  <span className="text-[10px] text-outline font-medium">{item.date}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-on-surface-variant pt-2 border-t border-surface-container-low">
              Target Day-0 Benchmark: <strong className="text-on-surface">85%+ Composite</strong> (7 points remaining)
            </div>
          </div>

          <div className="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low overflow-hidden">
            <h2 className="font-headline-sm text-on-surface font-bold pb-3 border-b border-surface-container-low">
              Domain Accuracy &amp; Velocity Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-surface-container-low text-outline">
                    <th className="py-2.5 pr-3 font-semibold">Competency Domain</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Attempted</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Accuracy</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Avg Pace</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Diagnostic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {domainMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-low/50">
                      <td className="py-3 pr-3 font-semibold text-on-surface">{row.domain}</td>
                      <td className="py-3 px-2 text-right font-mono">{row.solved}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-secondary">
                        {row.accuracy}%
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-outline">{row.avgTime}</td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={
                            row.accuracy >= 75
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : row.accuracy >= 60
                              ? 'text-on-surface-variant font-medium'
                              : 'text-error font-semibold'
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. APPLICATIONS TRACKER VIEW
  if (currentPath === 'applications') {
    const statuses: ('All' | ApplicationStatus)[] = [
      'All',
      'Applied',
      'OA Scheduled',
      'Shortlisted',
      'Tech Round',
      'Offer',
    ];

    const filteredApps =
      statusFilter === 'All'
        ? applications
        : applications.filter((a) => a.status === statusFilter);

    return (
      <div id="applications-view" className="space-y-space-md animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-outline block mb-1">
              Career Tracking · Live Recruitment Pipeline
            </span>
            <h1 className="font-headline-xl text-on-surface font-extrabold">
              Application Tracker ({applications.length})
            </h1>
            <p className="font-body-md text-on-surface-variant mt-1">
              Update recruitment stages, track online assessment slots, and keep company-specific preparation notes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('companies')}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
          >
            Browse Eligible Drives
          </button>
        </div>

        {/* Stage Filter Tabs */}
        <div className="bg-surface-container-lowest p-2 rounded-2xl border border-surface-container-low flex items-center gap-1.5 overflow-x-auto">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-secondary text-on-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Applications List */}
        <div className="space-y-3">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-outline">
                    <span className="font-bold text-secondary">{app.status}</span>
                    <span aria-hidden="true">·</span>
                    <span>{app.date}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-on-surface">{app.packageLpa}</span>
                  </div>
                  <h3 className="font-headline-md text-on-surface font-bold mt-0.5">
                    {app.company} — {app.role}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{app.round}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Stage for ${app.company}`}
                    value={app.status}
                    onChange={(e) =>
                      onUpdateApplicationStatus(app.id, e.target.value as ApplicationStatus)
                    }
                    className="px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs font-bold text-on-surface outline-none focus:border-secondary"
                  >
                    <option value="Applied">Applied</option>
                    <option value="OA Scheduled">OA Scheduled</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Tech Round">Tech Round</option>
                    <option value="Offer">Offer</option>
                  </select>

                  <button
                    onClick={() => onNavigate('interview-prep')}
                    className="px-3.5 py-2 rounded-xl bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap shrink-0"
                  >
                    Rehearse Round
                  </button>
                </div>
              </div>

              {/* Personal Prep Notes */}
              <div className="pt-2 border-t border-surface-container-low text-xs">
                {editingNoteId === app.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                    />
                    <button
                      onClick={() => {
                        onUpdateApplicationNotes(app.id, noteDraft);
                        setEditingNoteId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-on-surface-variant">
                    <span>
                      <strong className="text-on-surface">Prep Note:</strong> {app.notes}
                    </span>
                    <button
                      onClick={() => {
                        setEditingNoteId(app.id);
                        setNoteDraft(app.notes);
                      }}
                      className="text-secondary font-semibold hover:underline shrink-0"
                    >
                      Edit Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredApps.length === 0 && (
            <div className="p-10 text-center bg-surface-container-lowest rounded-2xl border border-surface-container-low space-y-2">
              <p className="font-headline-sm text-on-surface font-bold">
                No applications in &ldquo;{statusFilter}&rdquo; stage
              </p>
              <p className="text-xs text-outline">
                Select another stage filter or apply to an eligible campus recruiter.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. RESOURCES VAULT VIEW
  if (currentPath === 'resources') {
    const resourceCategories = [
      'All',
      'DSA & Algorithms',
      'Core CS (DBMS/OS/CN)',
      'Behavioral & Resume',
    ];

    const filteredResources = RESOURCE_ITEMS.filter((item) => {
      if (resourceCat !== 'All' && item.category !== resourceCat) return false;
      if (
        resourceSearch.trim() &&
        !item.title.toLowerCase().includes(resourceSearch.toLowerCase()) &&
        !item.summary.toLowerCase().includes(resourceSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const handleDownloadResource = (resItem: ResourceItem) => {
      const blob = new Blob([`${resItem.title}\n\n${resItem.content}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resItem.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div id="resources-view" className="space-y-space-md animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-outline block mb-1">
              Career Tracking · Verified Revision Sheets
            </span>
            <h1 className="font-headline-xl text-on-surface font-extrabold">
              Placement Preparation Resource Vault
            </h1>
            <p className="font-body-md text-on-surface-variant mt-1">
              High-density revision handbooks for Day-0 algorithms, SQL internals, OS concurrency, and STAR interviews.
            </p>
          </div>
          <input
            type="text"
            placeholder="Filter study guides..."
            value={resourceSearch}
            onChange={(e) => setResourceSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs text-on-surface outline-none focus:border-secondary w-full md:w-64"
          />
        </div>

        <div className="bg-surface-container-lowest p-2 rounded-2xl border border-surface-container-low flex items-center gap-1.5 overflow-x-auto">
          {resourceCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setResourceCat(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                resourceCat === cat
                  ? 'bg-secondary text-on-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm items-start">
          <div className="lg:col-span-5 space-y-2.5">
            {filteredResources.map((item) => {
              const selected = activeResource?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveResource(item)}
                  className={`w-full text-left p-space-md rounded-2xl border transition-all space-y-1.5 ${
                    selected
                      ? 'bg-surface-container-lowest border-secondary shadow-xs'
                      : 'bg-surface-container-lowest/70 border-surface-container-low hover:bg-surface-container-lowest'
                  }`}
                >
                  <div className="text-xs text-outline flex items-center gap-2">
                    <span className="text-secondary font-semibold">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.readTime}</span>
                  </div>
                  <h3 className="font-headline-sm text-on-surface font-bold">{item.title}</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{item.summary}</p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low space-y-4">
            {activeResource ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-container-low">
                  <div>
                    <span className="text-xs text-outline">
                      {activeResource.category} · {activeResource.updatedAt}
                    </span>
                    <h2 className="font-headline-md text-on-surface font-bold mt-0.5">
                      {activeResource.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleDownloadResource(activeResource)}
                    className="px-3.5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download Notes</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-surface-container-low font-mono text-xs text-on-surface whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {activeResource.content}
                </pre>
              </>
            ) : (
              <p className="text-xs text-outline">Select a study handbook on the left to read.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. SETTINGS VIEW
  return (
    <div id="settings-view" className="space-y-space-md animate-in fade-in duration-200 max-w-3xl">
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
        <span className="font-label-sm text-outline block mb-1">
          Portal Configuration
        </span>
        <h1 className="font-headline-xl text-on-surface font-extrabold">
          Career Portal Preferences
        </h1>
        <p className="font-body-md text-on-surface-variant mt-1">
          Configure minimum CTC filters, daily preparation targets, and TPO visibility controls.
        </p>
      </div>

      {settingsSaved && (
        <div className="p-3 rounded-xl bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          Portal preferences saved.
        </div>
      )}

      <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-headline-sm text-on-surface font-bold block">
            Appearance &amp; Display Mode
          </span>
          <p className="text-xs text-on-surface-variant">
            Switch between Light Mode and Dark Mode for comfortable reading and extended practice sessions.
          </p>
        </div>
        <ThemeModeSelector />
      </div>

      <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low space-y-5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-on-surface mb-1">
              Target Minimum CTC Threshold (LPA)
            </label>
            <input
              type="number"
              step="0.5"
              min="3"
              max="60"
              value={settings.minTargetCtc}
              onChange={(e) =>
                onUpdateSettings({ ...settings, minTargetCtc: parseFloat(e.target.value) || 6 })
              }
              className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono font-bold outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">
              Daily Preparation Commitment (Hours)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="10"
              value={settings.dailyGoalHours}
              onChange={(e) =>
                onUpdateSettings({ ...settings, dailyGoalHours: parseFloat(e.target.value) || 2 })
              }
              className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono font-bold outline-none focus:border-secondary"
            />
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-surface-container-low">
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low cursor-pointer">
            <div>
              <span className="font-bold text-on-surface block">Instant Campus Drive Alerts</span>
              <span className="text-outline">Notify when TPO schedules eligible Day-0 or Day-1 companies</span>
            </div>
            <input
              type="checkbox"
              checked={settings.driveAlerts}
              onChange={(e) => onUpdateSettings({ ...settings, driveAlerts: e.target.checked })}
              className="w-4 h-4 rounded text-secondary"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low cursor-pointer">
            <div>
              <span className="font-bold text-on-surface block">Daily Sprint &amp; Mock Reminders</span>
              <span className="text-outline">Remind at 6:00 PM if daily coding target is incomplete</span>
            </div>
            <input
              type="checkbox"
              checked={settings.mockReminders}
              onChange={(e) => onUpdateSettings({ ...settings, mockReminders: e.target.checked })}
              className="w-4 h-4 rounded text-secondary"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low cursor-pointer">
            <div>
              <span className="font-bold text-on-surface block">Share Verified Resume with TPO</span>
              <span className="text-outline">Allow automated shortlist submission for eligible drives</span>
            </div>
            <input
              type="checkbox"
              checked={settings.tpoProfileVisible}
              onChange={(e) =>
                onUpdateSettings({ ...settings, tpoProfileVisible: e.target.checked })
              }
              className="w-4 h-4 rounded text-secondary"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-container-low">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-xl border border-error text-error font-bold hover:bg-error-container/30 transition-colors"
            >
              Reset Portal Demo Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-error font-semibold">Restore default profile &amp; drives?</span>
              <button
                type="button"
                onClick={() => {
                  onResetDemoState();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-error text-on-error font-bold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-semibold"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSettingsSaved(true);
              setTimeout(() => setSettingsSaved(false), 2000);
            }}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-bold hover:bg-secondary-container transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
