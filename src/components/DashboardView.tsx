import React, { useState } from 'react';
import { CompanyDrive, DailyTask, NavigationPath, SkillGapItem, StudentProfile } from '../types';

interface DashboardViewProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
  skillGaps: SkillGapItem[];
  tasks: DailyTask[];
  onToggleTask: (id: string) => void;
  onOpenAddGoal: () => void;
  onOpenAtsAudit: () => void;
  onNavigate: (path: NavigationPath) => void;
  onSelectCompany: (company: CompanyDrive) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  companies,
  skillGaps,
  tasks,
  onToggleTask,
  onOpenAddGoal,
  onOpenAtsAudit,
  onNavigate,
  onSelectCompany,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'high-match' | 'eligible'>('all');

  const filteredCompanies = companies.filter((c) => {
    if (activeTab === 'high-match') return c.matchScore >= 84;
    if (activeTab === 'eligible') return c.isEligible;
    return true;
  });

  const completedTasksCount = tasks.filter((t) => t.completed).length;

  return (
    <div id="dashboard-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
        <div>
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
            Academic Year 2026-27 • Tier-1 Drive • Updated 14 mins ago
          </span>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-extrabold tracking-tight">
            Good Morning, {profile.name.split(' ')[0]} 👋
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Targeting {profile.targetRole} • 3 priority drives scheduled in the next 14 days
          </p>
        </div>

        <div className="flex items-center gap-space-sm">
          <button
            id="ats-resume-audit-btn"
            onClick={onOpenAtsAudit}
            className="flex items-center gap-1.5 px-space-md py-2.5 rounded-xl border border-secondary text-secondary font-label-lg text-label-lg hover:bg-secondary/5 transition-colors whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            <span>ATS Resume Audit</span>
          </button>
          <button
            id="resume-daily-sprint-btn"
            onClick={() => onNavigate('practice-hub')}
            className="flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-secondary text-on-secondary font-label-lg text-label-lg hover:bg-secondary-container transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
            <span>Start Practice</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-sm">
        {/* Card 1: Profile Diagnostic */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="font-label-md text-label-md uppercase font-bold tracking-wider">
              Profile Diagnostic
            </span>
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
                {profile.profileCompletion}%
              </span>
              <span className="font-label-sm text-label-sm text-outline">/ 100%</span>
            </div>
            {/* 5-segment mini bar */}
            <div className="grid grid-cols-5 gap-1.5 my-2.5">
              <div className="h-1.5 rounded-full bg-secondary"></div>
              <div className="h-1.5 rounded-full bg-secondary"></div>
              <div className="h-1.5 rounded-full bg-secondary"></div>
              <div className="h-1.5 rounded-full bg-secondary"></div>
              <div className="h-1.5 rounded-full bg-surface-container"></div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Add 1 certificate to reach 85% benchmark
            </p>
          </div>
        </div>

        {/* Card 2: Readiness Index */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="font-label-md text-label-md uppercase font-bold tracking-wider">
              Readiness Index
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface-container text-secondary">
              +4% wk
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
                {profile.readinessScore}%
              </div>
              <span className="font-body-sm text-body-sm text-outline">
                Benchmark: Tier-1 SDE
              </span>
              <p className="font-body-sm text-body-sm text-secondary font-semibold mt-1">
                Target percentile: 88th (Above avg)
              </p>
            </div>
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-secondary stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray="72, 100"
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-bold text-on-surface">72</span>
            </div>
          </div>
        </div>

        {/* Card 3: Hiring Matches */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="font-label-md text-label-md uppercase font-bold tracking-wider">
              Hiring Matches
            </span>
            <span className="material-symbols-outlined text-[20px]">apartment</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
                12
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                Active Openings
              </span>
            </div>
            <div className="flex items-center gap-2 my-2 text-xs">
              <span className="text-secondary font-bold">9 Fully Eligible</span>
              <span className="text-outline">•</span>
              <span className="text-outline">3 Borderline</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Highest match: <strong className="text-on-surface">88% Microsoft</strong>
            </p>
          </div>
        </div>

        {/* Card 4: Deficit Alerts */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="font-label-md text-label-md uppercase font-bold tracking-wider">
              Deficit Alerts
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">
              Action Req.
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-xl text-headline-xl text-error font-extrabold">
                4
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                Critical Gaps
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-outline my-1.5">
              Blocking tier-1 shortlist probability
            </p>
            <button
              onClick={() => onNavigate('skill-gap')}
              className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1 font-bold"
            >
              <span>Top: Dynamic Programming</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Split Section: Readiness Breakdown & Recommended Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        {/* Left 5-col: Readiness Breakdown */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low mb-space-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                Readiness Breakdown
              </h2>
              <span className="text-xs text-outline font-semibold">Tier-1 Target: 85%</span>
            </div>

            {/* Radial Gauge Preview */}
            <div className="flex items-center justify-center my-3">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-container stroke-current"
                    strokeWidth="3.2"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-secondary stroke-current"
                    strokeWidth="3.2"
                    strokeDasharray="72, 100"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center flex flex-col items-center">
                  <span className="font-display-lg text-[32px] text-on-surface font-extrabold leading-none">
                    72%
                  </span>
                  <span className="font-label-sm text-label-sm text-outline mt-1 font-semibold">
                    Overall Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-score progress bars */}
            <div className="space-y-3 font-body-sm text-body-sm">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-on-surface">Aptitude & Logical Reasoning</span>
                  <span className="text-secondary font-bold">80% • Advanced</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-on-surface">Technical Core (DBMS, OS, CN)</span>
                  <span className="text-on-surface-variant font-bold">65% • Intermediate</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-on-surface">Coding & Problem Solving</span>
                  <span className="text-error font-bold">58% • Action Required</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '58%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-on-surface">Communication & Behavioral</span>
                  <span className="text-secondary font-bold">75% • Proficient</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-on-surface">Interview Readiness Simulation</span>
                  <span className="text-on-surface-variant font-bold">60% • Moderate</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <button
            id="view-detailed-breakdown-btn"
            onClick={() => onNavigate('skill-gap')}
            className="w-full mt-4 py-2.5 rounded-xl border border-surface-container-high hover:bg-surface-container-low text-secondary font-label-md text-label-md font-bold text-center transition-colors flex items-center justify-center gap-1"
          >
            <span>View Detailed Progress & Breakdown</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        {/* Right 7-col: Top Recommended Companies */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-space-xs border-b border-surface-container-low mb-space-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Top Recommended Companies
                </h2>
                <p className="font-body-sm text-body-sm text-outline">
                  Curated for your CSE credentials and skills
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'all'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  All ({companies.length})
                </button>
                <button
                  onClick={() => setActiveTab('high-match')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'high-match'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  High Match
                </button>
                <button
                  onClick={() => setActiveTab('eligible')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'eligible'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  Eligible Only
                </button>
              </div>
            </div>

            {/* List of Companies */}
            <div className="space-y-3">
              {filteredCompanies.slice(0, 3).map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => onSelectCompany(comp)}
                  className="p-3.5 rounded-xl border border-surface-container-low bg-surface-container-low/40 hover:bg-surface-container-low hover:border-secondary/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary border border-surface-container shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[24px]">
                        {comp.logoIcon}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-secondary transition-colors">
                          {comp.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container text-on-surface">
                          {comp.category}
                        </span>
                        {comp.isEligible ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-highest text-primary">
                            Eligible
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-error-container text-on-error-container">
                            Shortfall
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {comp.role} • {comp.location}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {comp.matchedSkills.slice(0, 3).map((sk) => (
                          <span
                            key={sk}
                            className="px-1.5 py-0.5 rounded bg-surface-container text-[11px] text-on-surface-variant font-medium"
                          >
                            {sk}
                          </span>
                        ))}
                        {comp.gapSkills.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-error-container/40 text-error text-[11px] font-medium flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Gap: {comp.gapSkills[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <div>
                      <span className="font-headline-md text-headline-md text-secondary font-bold block">
                        {comp.packageLpa}
                      </span>
                      <span className="text-[11px] text-outline">
                        {comp.daysRemaining} days left
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-surface-container-highest font-mono text-xs font-bold text-primary mt-1">
                      {comp.matchScore}% Match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('companies')}
            className="w-full mt-3 py-2 text-center text-xs text-secondary font-bold hover:underline"
          >
            View All {companies.length} Campus Opportunities →
          </button>
        </div>
      </div>

      {/* High-Priority Skill Gaps (3 Cards) */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low mb-space-sm">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
              High-Priority Skill Gaps
            </h3>
            <p className="font-body-sm text-body-sm text-outline">
              Closing these 3 areas directly unlocks your top tier-1 company shortlists
            </p>
          </div>
          <button
            onClick={() => onNavigate('skill-gap')}
            className="text-xs text-secondary font-bold hover:underline"
          >
            View Matrix Analysis →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
          {skillGaps.map((gap) => (
            <div
              key={gap.id}
              className="p-space-sm rounded-xl border border-surface-container bg-surface-container-low/50 hover:bg-surface-container-low transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      gap.priority === 'High'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {gap.priorityTag}
                  </span>
                  <span className="text-[11px] text-outline font-medium">
                    {gap.moduleCategory}
                  </span>
                </div>

                <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {gap.title}
                </h4>
                <p className="text-xs text-on-surface-variant my-1 line-clamp-1">
                  {gap.subtitle}
                </p>

                {/* Progress compare bar */}
                <div className="my-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface font-medium">{gap.currentLabel}</span>
                    <span className="text-outline">{gap.targetLabel}</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-secondary h-full rounded-full"
                      style={{ width: `${gap.currentProficiency}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-[11px] text-outline mb-3">
                  Affects: <span className="text-on-surface">{gap.impactedCompanies.join(', ')}</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('ai-assistant')}
                className="w-full py-2 rounded-lg bg-surface-container-highest text-primary font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">{gap.actionIcon}</span>
                <span>{gap.actionLabel}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row (3 Cards: Daily Tasks, Deadlines, Prep Hours) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm">
        {/* Card 1: Today's Preparation Tasks */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low mb-space-sm">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Today&apos;s Preparation Tasks
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface-container text-secondary">
                  {completedTasksCount} / {tasks.length} Done
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onToggleTask(t.id)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => {}}
                    className="mt-1 w-4 h-4 rounded text-secondary focus:ring-secondary cursor-pointer"
                  />
                  <div className="flex-1">
                    <span
                      className={`text-xs font-semibold block transition-colors ${
                        t.completed
                          ? 'line-through text-outline'
                          : 'text-on-surface group-hover:text-secondary'
                      }`}
                    >
                      {t.title}
                    </span>
                    <span className="text-[11px] text-outline">{t.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            id="add-custom-task-goal-btn"
            onClick={onOpenAddGoal}
            className="w-full mt-3 py-2 rounded-lg border border-dashed border-outline-variant text-xs text-secondary font-bold hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Custom Goal</span>
          </button>
        </div>

        {/* Card 2: Registration Deadlines */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low mb-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Registration Deadlines
            </h3>
            <span className="text-xs text-outline font-semibold">TPO Portal Live</span>
          </div>

          <div className="space-y-3 font-body-sm text-body-sm">
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
              <div>
                <span className="font-bold text-xs text-on-surface block">Microsoft SDE-1</span>
                <span className="text-[11px] text-outline">Application portal closes</span>
              </div>
              <span className="font-mono text-xs font-bold text-error bg-error-container/60 px-2 py-0.5 rounded">
                04d : 12h
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
              <div>
                <span className="font-bold text-xs text-on-surface block">Accenture Adv. Tech</span>
                <span className="text-[11px] text-outline">Cognitive test slotting</span>
              </div>
              <span className="font-mono text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
                08d : 05h
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
              <div>
                <span className="font-bold text-xs text-on-surface block">Capgemini Sr. Analyst</span>
                <span className="text-[11px] text-outline">Resume verification cutoff</span>
              </div>
              <span className="font-mono text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                12d : 18h
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
              <div>
                <span className="font-bold text-xs text-on-surface block">Wipro Turbo Drive</span>
                <span className="text-[11px] text-outline">Coding challenge opening</span>
              </div>
              <span className="font-mono text-xs font-bold text-outline bg-surface-container px-2 py-0.5 rounded">
                15d : 02h
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Weekly Prep Activity */}
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low mb-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Weekly Prep Activity
              </h3>
              <span className="text-xs text-secondary font-bold">14.5 / 20 hrs</span>
            </div>

            <p className="text-xs text-on-surface-variant mb-3">
              Daily goal: 2.8 hrs • Current velocity: <strong className="text-on-surface">2.07 hrs/day</strong>
            </p>

            {/* Micro Bar Chart */}
            <div className="grid grid-cols-7 gap-2 items-end h-24 pt-4">
              {[
                { day: 'M', h: '60%', active: false },
                { day: 'T', h: '85%', active: false },
                { day: 'W', h: '90%', active: false },
                { day: 'T', h: '70%', active: false },
                { day: 'F', h: '100%', active: true },
                { day: 'S', h: '45%', active: false },
                { day: 'Su', h: '30%', active: false },
              ].map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      bar.active ? 'bg-secondary' : 'bg-surface-container-high hover:bg-secondary/60'
                    }`}
                    style={{ height: bar.h }}
                  ></div>
                  <span className="text-[10px] font-bold text-outline">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 p-2 bg-surface-container-low rounded-lg text-[11px] text-on-surface-variant flex items-center justify-between">
            <span>Streak: <strong>12 Consecutive Days</strong></span>
            <span className="text-secondary font-bold">🔥 On Track</span>
          </div>
        </div>
      </div>
    </div>
  );
};
