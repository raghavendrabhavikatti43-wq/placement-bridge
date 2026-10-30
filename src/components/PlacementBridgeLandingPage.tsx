import React, { useState } from 'react';

interface PlacementBridgeLandingPageProps {
  onEnterStudentLogin: () => void;
  onEnterAdminLogin: () => void;
  onBackToCover?: () => void;
}

type ModuleCategory = 'all' | 'candidate' | 'governance';

interface ArchitectureModule {
  index: string;
  title: string;
  category: 'candidate' | 'governance';
  categoryLabel: string;
  summary: string;
  specification: string;
  spanWide?: boolean;
}

const ARCHITECTURE_MODULES: ArchitectureModule[] = [
  {
    index: '01',
    title: 'Deterministic Eligibility & Cutoff Verification',
    category: 'governance',
    categoryLabel: 'Policy Engine · Zero-Hallucination Rules',
    summary:
      'Evaluates every student profile against recruiter-mandated CGPA thresholds, 10th and 12th academic percentages, active and historical backlog ceilings, and permitted engineering branches.',
    specification: 'Outputs explicit pass, fail, or insufficient-record explanations per criterion',
    spanWide: true,
  },
  {
    index: '02',
    title: 'Weighted Role Fit & Skill-Gap Roadmaps',
    category: 'candidate',
    categoryLabel: 'Readiness Scoring · 48 Standardized Skills',
    summary:
      'Computes deterministic compatibility across academic standing (30%), verified technical skills (40%), branch alignment (10%), project depth (10%), and certifications (10%) to sequence prerequisite study modules.',
    specification: '30 / 40 / 10 / 10 / 10 transparent multi-factor formula',
  },
  {
    index: '03',
    title: 'Separated Aptitude & Technical Coding Workspaces',
    category: 'candidate',
    categoryLabel: 'Timed Assessment · Practice Integrity',
    summary:
      'Maintains dedicated environments for timed quantitative, logical, and verbal examinations alongside an isolated algorithmic problem-solving workbench with curated test-case verification.',
    specification: '140+ server-scored aptitude items · 27 structured DSA problems',
  },
  {
    index: '04',
    title: 'ATS Resume Audit & Grounded Career Guidance',
    category: 'governance',
    categoryLabel: 'Document Verification · Strict Data Grounding',
    summary:
      'Audits candidate resumes for structural completeness, quantified engineering impact, and target-role keyword coverage while enforcing PII redaction and strict institutional grounding.',
    specification: 'Generates print-ready PDF resumes and auditable TPO cohort analytics',
    spanWide: true,
  },
];

const BRANCH_OPTIONS = [
  { code: 'CSE', label: 'Computer Science & Engineering (CSE)' },
  { code: 'IT', label: 'Information Technology (IT)' },
  { code: 'ECE', label: 'Electronics & Communication (ECE)' },
  { code: 'EEE', label: 'Electrical & Electronics (EEE)' },
  { code: 'ME', label: 'Mechanical Engineering (ME)' },
];

interface RecruiterTierRule {
  tierName: string;
  packageBand: string;
  minCgpa: number;
  maxBacklogs: number;
  allowedBranches: string[];
  representativeRoles: string;
}

const RECRUITER_TIER_RULES: RecruiterTierRule[] = [
  {
    tierName: 'Super Dream Product Cohort',
    packageBand: '18.0 – 32.0 LPA',
    minCgpa: 8.0,
    maxBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    representativeRoles: 'Software Development Engineer I · Cloud Systems Engineer',
  },
  {
    tierName: 'Dream Engineering Cohort',
    packageBand: '9.0 – 16.5 LPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EEE'],
    representativeRoles: 'Full-Stack Engineer · Data & Platform Analyst',
  },
  {
    tierName: 'Core & Enterprise Systems Cohort',
    packageBand: '5.5 – 8.5 LPA',
    minCgpa: 6.0,
    maxBacklogs: 1,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EEE', 'ME'],
    representativeRoles: 'Systems Engineer · Graduate Engineer Trainee',
  },
];

export const PlacementBridgeLandingPage: React.FC<PlacementBridgeLandingPageProps> = ({
  onEnterStudentLogin,
  onEnterAdminLogin,
  onBackToCover,
}) => {
  const [moduleFilter, setModuleFilter] = useState<ModuleCategory>('all');

  // Interactive Live Policy Previewer State
  const [previewBranch, setPreviewBranch] = useState<string>('CSE');
  const [previewCgpa, setPreviewCgpa] = useState<number>(8.2);
  const [previewBacklogs, setPreviewBacklogs] = useState<number>(0);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const visibleModules = ARCHITECTURE_MODULES.filter((mod) =>
    moduleFilter === 'all' ? true : mod.category === moduleFilter
  );

  return (
    <div
      id="placement-bridge-official-page"
      className="min-h-screen bg-[#06132b] text-white font-hanken antialiased selection:bg-[#e5c372] selection:text-[#06132b]"
    >
      {/* Ceremonial Top Tri-Band Ribbon Matching Initial Title Cover */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-[#0d3b8e] via-[#e5c372] to-[#0d3b8e]"
      />

      {/* Top Bar Contract: Single row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 w-full bg-[#06132b]/95 backdrop-blur-md border-b border-[#1e3a6e]/75">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => scrollToSection(e, 'top')}
            className="font-manrope text-lg font-extrabold tracking-tight text-white hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d98b]"
          >
            Placement Bridge
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Official sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-blue-100/85"
          >
            <a
              href="#capabilities"
              onClick={(e) => scrollToSection(e, 'capabilities')}
              className="hover:text-[#f3d98b] hover:underline underline-offset-8 decoration-[#e5c372]/70 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#eligibility"
              onClick={(e) => scrollToSection(e, 'eligibility')}
              className="hover:text-[#f3d98b] hover:underline underline-offset-8 decoration-[#e5c372]/70 transition-colors whitespace-nowrap shrink-0"
            >
              Eligibility
            </a>
            <a
              href="#outcomes"
              onClick={(e) => scrollToSection(e, 'outcomes')}
              className="hover:text-[#f3d98b] hover:underline underline-offset-8 decoration-[#e5c372]/70 transition-colors whitespace-nowrap shrink-0"
            >
              Governance
            </a>
            <a
              href="#portals"
              onClick={(e) => scrollToSection(e, 'portals')}
              className="hover:text-[#f3d98b] hover:underline underline-offset-8 decoration-[#e5c372]/70 transition-colors whitespace-nowrap shrink-0"
            >
              Access Portals
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              id="header-enter-portal-btn"
              type="button"
              onClick={onEnterStudentLogin}
              className="px-4 py-2 text-xs font-bold text-[#06132b] bg-gradient-to-r from-[#f3d98b] via-[#e4bc5a] to-[#cfa038] hover:from-[#f8e3a1] hover:to-[#dbb04a] rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d98b]"
            >
              Sign In to Portal
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Section 1: Proposition — Institutional Hero + Full-Width Benchmark Strip */}
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-20 border-b border-[#1e3a6e]/75 bg-[#06132b]">
          {/* Subtle Formal Sapphire & Champagne-Gold Illumination */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_16%_20%,rgba(29,78,216,0.30),transparent_68%),radial-gradient(ellipse_55%_50%_at_85%_30%,rgba(229,195,114,0.09),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(to_right,#93c5fd_1px,transparent_1px),linear-gradient(to_bottom,#93c5fd_1px,transparent_1px)] bg-[size:64px_64px]"
          />

          <div className="relative z-10 max-w-[1200px] mx-auto px-6">
            <div className="max-w-3xl space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#f0d483] tracking-wide">
                  <span>Directorate of Training &amp; Placement</span>
                  <span aria-hidden="true">·</span>
                  <span>Academic Year 2026-27</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#93c5fd]">Official Campus Gateway</span>
                </div>

                <div className="space-y-3.5">
                  <h1 className="font-manrope font-extrabold tracking-[-0.03em] text-[clamp(2.5rem,4.5vw,3.75rem)] leading-[1.08] text-balance">
                    <span className="bg-gradient-to-b from-white via-[#f8fbff] to-[#dbeafe] bg-clip-text text-transparent">
                      Placement{' '}
                    </span>
                    <span className="bg-gradient-to-r from-[#f8e6a6] via-[#e7bf5f] to-[#d4a43c] bg-clip-text text-transparent">
                      Bridge
                    </span>
                  </h1>

                  <div
                    aria-hidden="true"
                    className="w-24 h-[2px] bg-gradient-to-r from-[#e5c372] via-[#7dd3fc] to-transparent"
                  />

                  <p className="font-manrope text-lg sm:text-xl font-semibold text-[#dbeafe] leading-snug text-balance max-w-2xl">
                    Institutional Recruitment Governance, Rule-Based Eligibility Verification, and
                    Engineering Career Readiness Portal.
                  </p>
                </div>

                <p className="text-[15px] sm:text-base text-slate-200/90 leading-[1.68] max-w-[65ch] tracking-[0.005em]">
                  Placement Bridge connects graduating engineering cohorts with verified campus
                  recruiters through auditable academic screening, multi-factor role matching,
                  proctored aptitude and algorithmic practice workspaces, and role-isolated
                  Training &amp; Placement Office administration.
                </p>
              </div>

              <div className="space-y-5 pt-2">
                <div className="flex flex-wrap items-center gap-3.5">
                  <button
                    id="hero-student-portal-btn"
                    type="button"
                    onClick={onEnterStudentLogin}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#f3d98b] via-[#e4bc5a] to-[#cfa038] hover:from-[#f8e3a1] hover:to-[#dbb04a] text-[#06132b] text-sm font-bold shadow-lg shadow-black/25 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d98b]"
                  >
                    Enter Student Career Portal
                  </button>

                  <button
                    id="hero-admin-portal-btn"
                    type="button"
                    onClick={onEnterAdminLogin}
                    className="px-5 py-3 rounded-lg border border-[#3b63a8]/70 bg-[#0d234d]/90 hover:bg-[#133066] hover:border-[#f0d483]/60 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93c5fd]"
                  >
                    TPO Administrator Access
                  </button>
                </div>

                <div className="pt-4 border-t border-[#1e3a6e]/75 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-blue-200/75">
                  <span>Cryptographic Session Isolation</span>
                  <span aria-hidden="true">·</span>
                  <span>Student Email &amp; Google Workspace Auth</span>
                  <span aria-hidden="true">·</span>
                  <span>Single-Custodian TPO Governance</span>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Quantitative Institutional Strip */}
            <div className="mt-12 pt-8 border-t border-[#1e3a6e]/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-1">
                <div className="font-[family-name:var(--font-ibm-mono)] text-2xl font-semibold text-[#f3d98b] tabular-nums">
                  16 Recruiters
                </div>
                <div className="text-xs font-semibold text-white">
                  Active Campus Drive Rosters
                </div>
                <p className="text-xs text-blue-100/75 leading-relaxed">
                  Spanning Super Dream, Dream, and Core engineering hiring schedules for 2026-27.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-[family-name:var(--font-ibm-mono)] text-2xl font-semibold text-[#7dd3fc] tabular-nums">
                  167 Assessments
                </div>
                <div className="text-xs font-semibold text-white">
                  140 Aptitude · 27 Coding Problems
                </div>
                <p className="text-xs text-blue-100/75 leading-relaxed">
                  Server-timed quantitative, logical, verbal, and structured algorithmic test suites.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-[family-name:var(--font-ibm-mono)] text-2xl font-semibold text-[#f3d98b] tabular-nums">
                  48 Core Skills
                </div>
                <div className="text-xs font-semibold text-white">
                  Standardized Competency Taxonomy
                </div>
                <p className="text-xs text-blue-100/75 leading-relaxed">
                  Mapped directly to job-role prerequisites and sequenced preparation roadmaps.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-[family-name:var(--font-ibm-mono)] text-2xl font-semibold text-[#7dd3fc] tabular-nums">
                  2 Isolated Portals
                </div>
                <div className="text-xs font-semibold text-white">
                  Strict Role-Based Access Control
                </div>
                <p className="text-xs text-blue-100/75 leading-relaxed">
                  Separate cryptographic authentication flows for candidates and the Chief Placement
                  Officer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Mechanism / Core Institutional Architecture (Asymmetric Bento Grid) */}
        <section
          id="capabilities"
          className="py-16 lg:py-24 bg-[#081734] border-b border-[#1e3a6e]/75"
        >
          <div className="max-w-[1200px] mx-auto px-6 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-semibold text-[#f0d483] tracking-wide">
                  Platform Architecture · Institutional Modules
                </div>
                <h2 className="font-manrope text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                  Engineered for Transparent Evaluation and Structured Preparation
                </h2>
                <p className="text-sm sm:text-[15px] text-slate-200/85 leading-relaxed">
                  Every eligibility decision, role recommendation, and readiness metric inside
                  Placement Bridge is computed by deterministic academic rules backed by persistent
                  relational records.
                </p>
              </div>

              {/* Functional Interactive Segmented Filter Control */}
              <div
                role="group"
                aria-label="Filter platform modules"
                className="inline-flex items-center gap-1 p-1 bg-[#0c2147] border border-[#234582]/75 rounded-lg self-start shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setModuleFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    moduleFilter === 'all'
                      ? 'bg-[#173978] text-[#f3d98b] shadow-xs'
                      : 'text-blue-100/75 hover:text-white'
                  }`}
                >
                  All Modules
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilter('candidate')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    moduleFilter === 'candidate'
                      ? 'bg-[#173978] text-[#f3d98b] shadow-xs'
                      : 'text-blue-100/75 hover:text-white'
                  }`}
                >
                  Candidate Readiness
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilter('governance')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    moduleFilter === 'governance'
                      ? 'bg-[#173978] text-[#f3d98b] shadow-xs'
                      : 'text-blue-100/75 hover:text-white'
                  }`}
                >
                  Placement Governance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleModules.map((mod) => {
                const isWide = mod.spanWide && moduleFilter === 'all';
                return (
                  <article
                    key={mod.index}
                    className={`bg-gradient-to-br from-[#0d234d] to-[#091938] border border-[#234582]/75 hover:border-[#e5c372]/45 transition-colors rounded-xl p-6 sm:p-7 flex flex-col justify-between gap-6 ${
                      isWide ? 'md:col-span-2' : 'md:col-span-1'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-[#93c5fd]">
                        <span className="font-[family-name:var(--font-ibm-mono)] font-semibold text-[#f3d98b] tabular-nums">
                          {mod.index}.
                        </span>
                        <span>{mod.categoryLabel}</span>
                      </div>

                      <h3 className="font-manrope text-lg sm:text-xl font-bold text-white leading-snug text-balance">
                        {mod.index}. {mod.title}
                      </h3>

                      <p className="text-sm text-slate-200/85 leading-relaxed max-w-[68ch]">
                        {mod.summary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#1e3a6e]/80 flex items-center justify-between gap-4 text-xs text-blue-200/80">
                      <span>{mod.specification}</span>
                      <button
                        type="button"
                        onClick={
                          mod.category === 'governance' ? onEnterAdminLogin : onEnterStudentLogin
                        }
                        className="font-semibold text-[#f0d483] hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {mod.category === 'governance' ? 'Open Governance →' : 'Explore Workspace →'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Policy Simulator & Institutional Governance Proof */}
        <section
          id="eligibility"
          className="relative py-16 lg:py-24 bg-[#06132b] border-b border-[#1e3a6e]/75"
        >
          <div className="max-w-[1200px] mx-auto px-6 space-y-12">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-semibold text-[#7dd3fc] tracking-wide">
                Deterministic Rule Verification · Interactive Preview
              </div>
              <h2 className="font-manrope text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                Verify Campus Cohort Eligibility Before Signing In
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-200/85 leading-relaxed">
                Test how Placement Bridge evaluates academic standing across the three standard
                campus recruitment tiers. Sign in to run full role-level checks across all 16
                registered recruiters.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Controls */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#0d234d] to-[#091a3a] border border-[#264b8c]/80 rounded-xl p-6 space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="preview-branch-select"
                    className="block text-xs font-semibold text-blue-100"
                  >
                    Engineering Department
                  </label>
                  <select
                    id="preview-branch-select"
                    value={previewBranch}
                    onChange={(e) => setPreviewBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#345ca1] bg-[#071531] text-sm text-white font-medium outline-none focus:border-[#f0d483]"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b.code} value={b.code} className="bg-[#071531] text-white">
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="preview-cgpa-range" className="font-semibold text-blue-100">
                      Cumulative CGPA (10-Point Scale)
                    </label>
                    <span className="font-[family-name:var(--font-ibm-mono)] text-sm font-semibold text-[#f3d98b] tabular-nums">
                      {previewCgpa.toFixed(2)} / 10.00
                    </span>
                  </div>
                  <input
                    id="preview-cgpa-range"
                    type="range"
                    min="5.5"
                    max="10.0"
                    step="0.1"
                    value={previewCgpa}
                    onChange={(e) => setPreviewCgpa(parseFloat(e.target.value))}
                    className="w-full accent-[#e5c372] cursor-pointer"
                  />
                  <div className="flex justify-between font-[family-name:var(--font-ibm-mono)] text-[11px] text-blue-200/70 tabular-nums">
                    <span>5.50</span>
                    <span>7.00</span>
                    <span>8.00</span>
                    <span>10.00</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-blue-100">
                    Active Standing Backlogs
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 0, label: '0 Active' },
                      { value: 1, label: '1 Active' },
                      { value: 2, label: '2+ Active' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPreviewBacklogs(opt.value)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                          previewBacklogs === opt.value
                            ? 'bg-[#e5c372] border-[#e5c372] text-[#06132b] font-bold'
                            : 'bg-[#071531] border-[#305496] text-blue-100 hover:bg-[#102957]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1e3a6e]/80 flex items-center justify-between gap-4">
                  <span className="text-xs text-blue-200/75">
                    Need full 10th/12th &amp; skill-level checks?
                  </span>
                  <button
                    type="button"
                    onClick={onEnterStudentLogin}
                    className="text-xs font-semibold text-[#f0d483] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Full Checker →
                  </button>
                </div>
              </div>

              {/* Right Live Evaluation Table */}
              <div className="lg:col-span-7 border border-[#244684]/80 rounded-xl divide-y divide-[#1b3566] bg-[#091938]">
                {RECRUITER_TIER_RULES.map((rule) => {
                  const cgpaOk = previewCgpa >= rule.minCgpa;
                  const backlogOk = previewBacklogs <= rule.maxBacklogs;
                  const branchOk = rule.allowedBranches.includes(previewBranch);
                  const eligible = cgpaOk && backlogOk && branchOk;

                  const reasons: string[] = [];
                  if (!cgpaOk) {
                    reasons.push(
                      `Requires CGPA ≥ ${rule.minCgpa.toFixed(1)} (current ${previewCgpa.toFixed(2)})`
                    );
                  }
                  if (!backlogOk) {
                    reasons.push(`Max ${rule.maxBacklogs} active backlog permitted`);
                  }
                  if (!branchOk) {
                    reasons.push(`Permitted branches: ${rule.allowedBranches.join(', ')}`);
                  }

                  return (
                    <div key={rule.tierName} className="p-5 sm:p-6 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                          <h3 className="font-manrope text-base font-bold text-white">
                            {rule.tierName}
                          </h3>
                          <p className="text-xs text-blue-200/75 mt-0.5">
                            {rule.representativeRoles}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-[family-name:var(--font-ibm-mono)] text-[#93c5fd] tabular-nums">
                            CTC {rule.packageBand}
                          </span>
                          <span aria-hidden="true" className="text-blue-300/40">
                            ·
                          </span>
                          <span
                            className={`font-semibold ${
                              eligible ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {eligible ? 'Eligible under Policy' : 'Criteria Not Met'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                        <span className="font-[family-name:var(--font-ibm-mono)] tabular-nums">
                          Cutoff: CGPA ≥ {rule.minCgpa.toFixed(1)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-[family-name:var(--font-ibm-mono)] tabular-nums">
                          Backlogs ≤ {rule.maxBacklogs}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Branches: {rule.allowedBranches.join(', ')}</span>
                      </div>

                      {!eligible && reasons.length > 0 && (
                        <p className="text-xs text-rose-300 pt-1">
                          Blocking rule: {reasons.join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Governance Standards & Attributable Institutional Evidence */}
        <section
          id="outcomes"
          className="py-16 lg:py-20 bg-[#081734] border-b border-[#1e3a6e]/75"
        >
          <div className="max-w-[1200px] mx-auto px-6 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-3">
                <div className="text-xs font-semibold text-[#f0d483] tracking-wide">
                  Institutional Accountability · Audit &amp; Privacy
                </div>
                <h2 className="font-manrope text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                  Built on Verifiable Academic Records and Role Isolation
                </h2>
                <p className="text-sm sm:text-[15px] text-slate-200/85 leading-relaxed">
                  Placement Bridge enforces strict separation between student career workspaces and
                  Training &amp; Placement Office governance, backed by immutable audit logs and
                  anti-enumeration credential security.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-[#0d234d] to-[#091938] border border-[#234582]/75 rounded-xl p-6 space-y-2">
                  <div className="font-[family-name:var(--font-ibm-mono)] text-xs font-semibold text-[#f3d98b] tabular-nums">
                    01. Authentication Isolation
                  </div>
                  <h3 className="font-manrope text-base font-bold text-white">
                    Dual-Gateway Portal Separation
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200/85 leading-relaxed">
                    Student tokens cannot query administrative endpoints, and the Chief Placement
                    Officer console requires 4-point single-custodian verification with brute-force
                    lockout protection.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#0d234d] to-[#091938] border border-[#234582]/75 rounded-xl p-6 space-y-2">
                  <div className="font-[family-name:var(--font-ibm-mono)] text-xs font-semibold text-[#7dd3fc] tabular-nums">
                    02. Assessment Integrity
                  </div>
                  <h3 className="font-manrope text-base font-bold text-white">
                    Server-Authoritative Quiz Scoring
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200/85 leading-relaxed">
                    Correct option keys and step-by-step solutions remain withheld on the server
                    while timed aptitude attempts are active, preventing client-side answer
                    inspection.
                  </p>
                </div>
              </div>
            </div>

            {/* Attributable Institutional Statement (Clean top/bottom gold-sapphire hairlines) */}
            <figure className="py-8 border-y border-[#e5c372]/25 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <blockquote className="lg:col-span-8 font-manrope text-lg sm:text-xl font-medium text-[#f8fbff] leading-relaxed">
                “Replacing spreadsheet-based cutoff checks with Placement Bridge reduced pre-drive
                eligibility disputes across CSE, IT, and ECE batches while giving every candidate an
                exact skill-gap study sequence weeks ahead of campus interviews.”
              </blockquote>
              <figcaption className="lg:col-span-4 lg:text-right space-y-0.5">
                <div className="text-sm font-bold text-[#f3d98b]">Dr. Raghavendra Kulkarni</div>
                <div className="text-xs text-blue-100/85">
                  Chief Training &amp; Placement Officer · National Institute of Engineering
                </div>
                <div className="text-xs text-blue-200/65">
                  Campus Recruitment Cycle 2026-27
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Section 5: Conversion / Official Dual-Portal Access Gateways */}
        <section id="portals" className="py-16 lg:py-24 bg-[#06132b]">
          <div className="max-w-[1200px] mx-auto px-6 space-y-10">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-semibold text-[#f0d483] tracking-wide">
                Authentication Gateways · Select Your Role
              </div>
              <h2 className="font-manrope text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                Select Your Official Placement Bridge Portal
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-200/85 leading-relaxed">
                Proceed to the dedicated authentication gateway corresponding to your institutional
                role. Cross-role access is cryptographically restricted.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Portal Card 1: Student Candidate Gateway */}
              <div className="border border-[#3866b8]/70 rounded-xl p-7 sm:p-8 bg-gradient-to-br from-[#0e2756] to-[#091a3c] flex flex-col justify-between gap-8 shadow-xl shadow-black/25">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#7dd3fc] font-semibold">
                    <span>Candidate Workspace</span>
                    <span aria-hidden="true">·</span>
                    <span>All Eligible B.Tech &amp; M.Tech Batches</span>
                  </div>

                  <h3 className="font-manrope text-2xl font-bold text-white">
                    Student Career &amp; Placement Portal
                  </h3>

                  <p className="text-sm text-slate-200/90 leading-relaxed">
                    Sign in with your institutional email address, register a new candidate profile,
                    or authenticate via Google Workspace to access company drives, eligibility
                    evaluations, skill-gap roadmaps, and practice assessments.
                  </p>

                  <div className="pt-4 border-t border-[#25498a] space-y-2 text-xs text-blue-200/80">
                    <div className="flex justify-between gap-4">
                      <span>Supported Sign-In</span>
                      <span className="font-semibold text-white">
                        Email ID · Google · Institutional SSO
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Included Workspaces</span>
                      <span className="font-semibold text-white">
                        Drives · Eligibility · Aptitude · Coding · ATS Resume
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <button
                    id="gateway-card-student-btn"
                    type="button"
                    onClick={onEnterStudentLogin}
                    className="w-full sm:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-[#f3d98b] via-[#e4bc5a] to-[#cfa038] hover:from-[#f8e3a1] hover:to-[#dbb04a] text-[#06132b] text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Continue to Student Sign In
                  </button>
                </div>
              </div>

              {/* Portal Card 2: TPO Administrator Gateway */}
              <div className="border border-[#e5c372]/45 rounded-xl p-7 sm:p-8 bg-gradient-to-br from-[#0b1c3d] to-[#061126] text-slate-100 flex flex-col justify-between gap-8 tracking-[0.01em] shadow-xl shadow-black/25">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#f0d483] font-semibold">
                    <span>Restricted Governance Console</span>
                    <span aria-hidden="true">·</span>
                    <span>Single Authorized Custodian</span>
                  </div>

                  <h3 className="font-manrope text-2xl font-bold text-white">
                    TPO Administrator Governance Vault
                  </h3>

                  <p className="text-sm text-slate-200/85 leading-relaxed">
                    Reserved exclusively for the Chief Training &amp; Placement Officer. Requires
                    simultaneous verification of Authorized User ID, official institutional email,
                    master password, and one-time security challenge code.
                  </p>

                  <div className="pt-4 border-t border-[#1f3b70] space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between gap-4">
                      <span className="text-blue-200/75">Security Enforcement</span>
                      <span className="font-[family-name:var(--font-ibm-mono)] font-medium text-[#f3d98b] tabular-nums">
                        4-Factor Form + 5-Attempt Lockout
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-blue-200/75">Administrative Scope</span>
                      <span className="font-semibold text-white">
                        Recruiters · Cutoffs · Cohort Analytics · CSV Exports
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <button
                    id="gateway-card-admin-btn"
                    type="button"
                    onClick={onEnterAdminLogin}
                    className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white hover:bg-[#f0f6ff] text-[#06132b] text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Continue to Admin Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-[#1e3a6e]/70 bg-[#040d21] py-10">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="font-manrope text-sm font-extrabold text-white tracking-tight">
              Placement Bridge
            </div>
            <p className="text-xs text-blue-200/70">
              Official Campus Placement &amp; Career Readiness Infrastructure · Office of Training
              &amp; Placement
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-blue-100/80">
            {onBackToCover && (
              <button
                type="button"
                onClick={onBackToCover}
                className="hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Title Page
              </button>
            )}
            <a
              href="#capabilities"
              onClick={(e) => scrollToSection(e, 'capabilities')}
              className="hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#eligibility"
              onClick={(e) => scrollToSection(e, 'eligibility')}
              className="hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0"
            >
              Eligibility Policy
            </a>
            <button
              type="button"
              onClick={onEnterStudentLogin}
              className="hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Student Sign In
            </button>
            <button
              type="button"
              onClick={onEnterAdminLogin}
              className="hover:text-[#f3d98b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              TPO Admin Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
