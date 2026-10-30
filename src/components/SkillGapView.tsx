import React, { useState } from 'react';
import { NavigationPath, SkillGapItem, StudentProfile } from '../types';

interface SkillGapViewProps {
  profile: StudentProfile;
  skillGaps: SkillGapItem[];
  onOpenCohortModal: () => void;
  onNavigate: (path: NavigationPath) => void;
}

export const SkillGapView: React.FC<SkillGapViewProps> = ({
  profile,
  skillGaps,
  onOpenCohortModal,
  onNavigate,
}) => {
  const [recalibrating, setRecalibrating] = useState(false);
  const [recalibratedNotice, setRecalibratedNotice] = useState(false);

  const handleRecalibrate = () => {
    setRecalibrating(true);
    setTimeout(() => {
      setRecalibrating(false);
      setRecalibratedNotice(true);
      setTimeout(() => setRecalibratedNotice(false), 3000);
    }, 900);
  };

  const handleExport = () => {
    const report = `Placement Readiness Audit for ${profile.name}\nReadiness Score: ${profile.readinessScore}%\nTarget Role: ${profile.targetRole}\nActive Deficits: 3`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(' ', '_')}_Readiness_Audit.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="skill-gap-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
            Placement Readiness Engine / Live Calibrated
          </span>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-extrabold tracking-tight">
            Skill Gap Analysis & Recommendations
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Comparative diagnostic against Tier-1 SDE benchmarks and scheduled drive requirements.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRecalibrate}
            disabled={recalibrating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-secondary text-secondary font-label-md text-xs font-bold hover:bg-secondary/5 transition-colors disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                recalibrating ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span>{recalibrating ? 'Recalibrating...' : 'Recalibrate Skills'}</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-label-md text-xs font-bold hover:bg-secondary-container transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export Readiness Audit</span>
          </button>
        </div>
      </div>

      {recalibratedNotice && (
        <div className="p-3 bg-secondary-fixed text-on-secondary-fixed rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          Live benchmarks synchronized with 38 scheduled campus recruiters and latest coding mock tests.
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
          <span className="text-xs font-semibold text-outline uppercase block mb-1">
            Verified Inventory
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
              14
            </span>
            <span className="text-xs text-on-surface-variant font-medium">Skills Assessed</span>
          </div>
          <span className="text-[11px] text-secondary font-semibold mt-1 block">
            4 Core Domains Covered
          </span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-outline uppercase block mb-1">
              Compatibility Score
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
                78.4%
              </span>
              <span className="text-[11px] text-secondary font-bold">+6.2%</span>
            </div>
            <span className="text-[11px] text-outline mt-1 block">vs last month</span>
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
                strokeDasharray="78, 100"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold text-on-surface">78%</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
          <span className="text-xs font-semibold text-outline uppercase block mb-1">
            Active Gaps
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-headline-xl text-headline-xl text-error font-extrabold">
              3
            </span>
            <span className="text-xs text-on-surface-variant font-medium">Domains</span>
          </div>
          <span className="text-[11px] text-error font-semibold mt-1 block">
            Impacts 4 target drives
          </span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low">
          <span className="text-xs font-semibold text-outline uppercase block mb-1">
            Pace to Target
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold">
              3
            </span>
            <span className="text-xs text-on-surface-variant font-medium">Weeks</span>
          </div>
          <span className="text-[11px] text-secondary font-semibold mt-1 block">
            To reach 85%+ readiness
          </span>
        </div>
      </div>

      {/* Main Grid: Benchmark Proficiency Matrix (Left 8-col) + Sprint Pathway (Right 4-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        {/* Left 8-col */}
        <div className="lg:col-span-8 space-y-space-sm">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low space-y-4">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Benchmark Proficiency Matrix
                </h2>
                <p className="font-body-sm text-body-sm text-outline">
                  Normalized against Tier-1 Product Companies (Microsoft, Google, Amazon criteria)
                </p>
              </div>
              <span className="text-xs font-bold text-secondary bg-surface-container px-2.5 py-1 rounded-full">
                SDE-1 Standards
              </span>
            </div>

            {/* Gap Card 1: DSA */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-error-container text-on-error-container">
                    -40% Deficit
                  </span>
                  <span className="text-xs font-semibold text-error">High Priority Gap</span>
                  <span className="text-xs text-outline">• Code Sprint #4</span>
                </div>
                <span className="text-xs text-outline">Benchmark target: 80%</span>
              </div>

              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Data Structures &amp; Algorithms (DSA)
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Arrays, Linked Lists, Binary Trees &amp; Recursion
                </p>
              </div>

              {/* Comparative Meter */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-on-surface">Current: Basic (40%)</span>
                  <span className="text-secondary">Target Benchmark: 80%</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-3 rounded-full overflow-hidden flex border border-surface-container">
                  <div className="bg-error h-full rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>

              {/* Sub-breakdown tags */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-outline">Sub-topics:</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface text-[11px] font-medium border border-surface-container">
                  Arrays (75%)
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-error text-[11px] font-medium border border-surface-container">
                  Trees &amp; Graphs (30%)
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-error text-[11px] font-medium border border-surface-container">
                  Dynamic Prog. (25%)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-container">
                <span className="text-xs text-outline">
                  Impacts: <strong className="text-on-surface">Microsoft, Amazon, TCS Digital</strong>
                </span>
                <button
                  onClick={() => onNavigate('coding-practice')}
                  className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary font-label-md text-xs font-bold hover:bg-secondary-container transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <span>Start Technical Coding Sprint</span>
                </button>
              </div>
            </div>

            {/* Gap Card 2: SQL */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-on-surface font-mono">
                    -20% Deficit
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant">Medium Priority</span>
                  <span className="text-xs text-outline">• Database Module</span>
                </div>
                <span className="text-xs text-outline">Benchmark target: 85%</span>
              </div>

              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Advanced SQL &amp; Database Management
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Indexing, CTEs, Window Functions, Query Execution Plans
                </p>
              </div>

              {/* Comparative Meter */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-on-surface">Current: Intermediate (65%)</span>
                  <span className="text-secondary">Target Benchmark: 85%</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-3 rounded-full overflow-hidden flex border border-surface-container">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>

              {/* Sub-breakdown tags */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-outline">Sub-topics:</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface text-[11px] font-medium border border-surface-container">
                  Normalization (90%)
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface text-[11px] font-medium border border-surface-container">
                  Indexing &amp; B-Trees (60%)
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-error text-[11px] font-medium border border-surface-container">
                  Window Functions (45%)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-container">
                <span className="text-xs text-outline">
                  Impacts: <strong className="text-on-surface">Deloitte USI, Oracle, Accenture</strong>
                </span>
                <button
                  onClick={() => onNavigate('practice-hub')}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-label-md text-xs font-bold hover:bg-surface-container-high transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">terminal</span>
                  <span>Start SQL Hands-on Lab</span>
                </button>
              </div>
            </div>

            {/* Subgrid: Strong Pillars (System Design & Speed Math) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-on-surface">System Design &amp; OOP</span>
                  <span className="text-secondary font-bold">80% vs 75% Target</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden my-2">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '80%' }}></div>
                </div>
                <span className="text-[11px] text-on-surface-variant block">
                  ✓ Benchmark Exceeded. Prime leverage for Technical Round 2.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-on-surface">Quantitative &amp; Speed Math</span>
                  <span className="text-secondary font-bold">82% vs 80% Target</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden my-2">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '82%' }}></div>
                </div>
                <span className="text-[11px] text-on-surface-variant block">
                  ✓ Assessment Ready. Cleared for screening round direct bypass.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4-col: Integrated Sprint Pathway & Insets */}
        <div className="lg:col-span-4 space-y-space-sm">
          {/* Sprint Stepper */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low space-y-4">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Sprint Pathway #4
                </h3>
                <span className="text-xs text-outline font-medium">Target: Close DSA Gap</span>
              </div>
              <span className="text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded-full">
                65% Done
              </span>
            </div>

            {/* Stepper items */}
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
              {/* Step 1 */}
              <div className="relative pl-7">
                <span className="absolute left-1.5 top-0.5 w-3.5 h-3.5 rounded-full bg-secondary ring-4 ring-surface-container-lowest"></span>
                <div>
                  <span className="text-xs font-bold text-on-surface block">
                    1. Trees &amp; Graph Traversal
                  </span>
                  <span className="text-[11px] text-outline">
                    Progress: 14/20 Solved (70%) • 3 Days Left
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative pl-7">
                <span className="absolute left-1.5 top-0.5 w-3.5 h-3.5 rounded-full bg-surface-container ring-4 ring-surface-container-lowest"></span>
                <div>
                  <span className="text-xs font-bold text-on-surface block">
                    2. TCS &amp; Microsoft Mock Exam
                  </span>
                  <span className="text-[11px] text-outline">
                    Scheduled Thursday 6:00 PM • 90 mins
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative pl-7">
                <span className="absolute left-1.5 top-0.5 w-3.5 h-3.5 rounded-full bg-surface-container ring-4 ring-surface-container-lowest"></span>
                <div>
                  <span className="text-xs font-bold text-outline block">
                    3. AI Behavioral &amp; Tech Interview
                  </span>
                  <span className="text-[11px] text-outline">
                    Locked until Mock Exam completion
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('ai-assistant')}
              className="w-full py-2.5 rounded-xl bg-secondary text-on-secondary font-label-md text-xs font-bold hover:bg-secondary-container transition-colors shadow-xs"
            >
              Resume Daily Practice Set
            </button>
          </div>

          {/* Quick Tips Inset */}
          <div className="bg-surface-container-low p-space-md rounded-2xl border border-surface-container-high space-y-2">
            <div className="flex items-center gap-2 text-secondary">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Adaptive Recalibration Active
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your problem-solving velocity in Two-Pointers increased by 18% this week. Focus your
              next sprint on Binary Tree traversals to raise your readiness index to 80%+.
            </p>
          </div>

          {/* Cohort Card */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">Campus Batch Cohort</span>
              <span className="text-xs text-secondary font-bold">Top 18.4%</span>
            </div>
            <p className="text-xs text-outline">
              You are outperforming 81% of candidates in the 2026-27 Computer Engineering cohort.
            </p>
            <button
              onClick={onOpenCohortModal}
              className="w-full py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Compare with Cohort →
            </button>
          </div>
        </div>
      </div>

      {/* Why These Companies Match You (Algorithmically Ranked) */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xs border border-surface-container-low space-y-3">
        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
              Why These Companies Match You
            </h3>
            <p className="font-body-sm text-body-sm text-outline">
              Algorithmic scoring breakdown based on CGPA, verified skills, and past hiring patterns
            </p>
          </div>
          <button
            onClick={() => onNavigate('companies')}
            className="text-xs text-secondary font-bold hover:underline"
          >
            Explore All Drives →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-body-sm text-body-sm">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-on-surface text-sm">Accenture</span>
              <span className="font-mono text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
                91% Match
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              100% academic criteria met. 5/5 tech stack competencies verified. Quantitative score qualifies for direct interview bypass.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-on-surface text-sm">Deloitte USI</span>
              <span className="font-mono text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
                84% Match
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              CGPA 8.10 comfortably exceeds 7.00 threshold. SQL &amp; Python credentials verified. Minor gap in cloud basics.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-on-surface text-sm">Microsoft</span>
              <span className="font-mono text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
                82% Match
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Meets Day-0 CGPA gate (8.00). System Design strengths verified. Dynamic Programming is the primary obstacle to Round 3.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
