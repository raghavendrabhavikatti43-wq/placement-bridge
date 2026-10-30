import React, { useState, useEffect } from 'react';
import { CompanyDrive, NavigationPath, StudentProfile } from '../types';

interface EligibilityCheckerPageProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
  appliedCompanyIds: string[];
  focusedCompanyId: string | null;
  onSelectFocusedCompany: (companyId: string) => void;
  onApplyCompany: (company: CompanyDrive) => void;
  onUpdateProfile: (updated: StudentProfile) => void;
  onNavigate: (path: NavigationPath) => void;
}

export const EligibilityCheckerPage: React.FC<EligibilityCheckerPageProps> = ({
  profile,
  companies,
  appliedCompanyIds,
  focusedCompanyId,
  onSelectFocusedCompany,
  onApplyCompany,
  onUpdateProfile,
  onNavigate,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    focusedCompanyId || companies[0]?.id || 'microsoft'
  );
  const [simCgpa, setSimCgpa] = useState<number>(profile.cgpa);
  const [simBacklogs, setSimBacklogs] = useState<number>(profile.activeBacklogs);
  const [simBranch, setSimBranch] = useState<string>('CSE');
  const [addedSkills, setAddedSkills] = useState<string[]>([]);
  const [committedNotice, setCommittedNotice] = useState(false);

  useEffect(() => {
    if (focusedCompanyId) {
      setSelectedId(focusedCompanyId);
    }
  }, [focusedCompanyId]);

  const activeCompany =
    companies.find((c) => c.id === selectedId) || companies[0];

  const bonusSkillOptions = [
    'Advanced DSA (Trees & Graphs)',
    'Dynamic Programming',
    'Cloud Basics',
    'SQL Window Functions & Query Plans',
    'Competitive Math',
  ];

  const toggleSkill = (sk: string) => {
    setAddedSkills((prev) =>
      prev.includes(sk) ? prev.filter((item) => item !== sk) : [...prev, sk]
    );
  };

  const evaluateCompany = (
    comp: CompanyDrive,
    cgpaVal: number,
    backlogsVal: number,
    branchVal: string
  ) => {
    const cgpaOk = cgpaVal >= comp.minCgpa;
    const backlogOk = backlogsVal <= comp.allowedBacklogs;
    const branchOk =
      comp.allowedBranches.some((b) => b.includes('All')) ||
      comp.allowedBranches.some((b) => b.includes(branchVal)) ||
      (branchVal === 'ECE' && comp.allowedBranches.includes('Circuital'));
    const closedGaps = comp.gapSkills.filter((g) => addedSkills.includes(g)).length;
    const boostedMatch = Math.min(99, comp.matchScore + closedGaps * 6);
    return {
      eligible: cgpaOk && backlogOk && branchOk,
      cgpaOk,
      backlogOk,
      branchOk,
      boostedMatch,
    };
  };

  const currentEligibleCount = companies.filter((c) => c.isEligible).length;
  const simulatedResults = companies.map((c) => ({
    company: c,
    evalResult: evaluateCompany(c, simCgpa, simBacklogs, simBranch),
  }));
  const simEligibleCount = simulatedResults.filter((r) => r.evalResult.eligible).length;
  const deltaCount = simEligibleCount - currentEligibleCount;

  const activeEval = evaluateCompany(activeCompany, simCgpa, simBacklogs, simBranch);
  const isAlreadyApplied = appliedCompanyIds.includes(activeCompany.id);

  const handleSaveToProfile = () => {
    onUpdateProfile({
      ...profile,
      cgpa: simCgpa,
      activeBacklogs: simBacklogs,
      skills: Array.from(new Set([...profile.skills, ...addedSkills])),
    });
    setCommittedNotice(true);
    setTimeout(() => setCommittedNotice(false), 2500);
  };

  return (
    <div id="eligibility-checker-page" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Page Header */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Placement Engine · Dedicated Criteria Verification &amp; What-If Simulator
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Campus Eligibility Checker
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Verify institutional CGPA, backlog, and branch gates for any recruiter, simulate academic updates, and jump to Practice Hub when ready to prepare.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('practice-hub')}
            className="px-3.5 py-2 rounded-xl border border-secondary text-secondary text-xs font-bold hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0"
          >
            Go to Practice Mode Selection →
          </button>
          <button
            type="button"
            onClick={handleSaveToProfile}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
          >
            Apply Simulated Credentials
          </button>
        </div>
      </div>

      {committedNotice && (
        <div className="p-3 rounded-xl bg-secondary-fixed text-on-secondary-fixed text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Simulated CGPA, backlogs, and upskilled competencies saved to your live student profile.</span>
        </div>
      )}

      {/* Section 1: Dedicated Company Gate Inspector */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-low">
          <div>
            <h2 className="font-headline-md text-on-surface font-bold">
              Direct Recruiter Gate Verification
            </h2>
            <p className="text-xs text-outline">
              Select a target campus drive to inspect every eligibility rule against your parameters
            </p>
          </div>

          <div className="w-full sm:w-80">
            <select
              aria-label="Select Company Drive to Check Eligibility"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                onSelectFocusedCompany(e.target.value);
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs font-bold text-on-surface outline-none focus:border-secondary"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.role} ({c.packageLpa})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 tabular-nums text-xs">
          <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
            <span className="text-outline block">1. Academic CGPA Gate</span>
            <span className="font-mono text-sm font-extrabold text-on-surface block">
              Yours: {simCgpa.toFixed(2)} · Req: {activeCompany.minCgpa.toFixed(2)}
            </span>
            <span className={activeEval.cgpaOk ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-error font-bold'}>
              {activeEval.cgpaOk ? 'Passed CGPA Cutoff' : 'Below Cutoff'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
            <span className="text-outline block">2. Active Backlogs Gate</span>
            <span className="font-mono text-sm font-extrabold text-on-surface block">
              Yours: {simBacklogs} · Max Allowed: {activeCompany.allowedBacklogs}
            </span>
            <span className={activeEval.backlogOk ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-error font-bold'}>
              {activeEval.backlogOk ? 'Cleared Backlog Gate' : 'Exceeds Limit'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
            <span className="text-outline block">3. Engineering Branch</span>
            <span className="font-mono text-sm font-extrabold text-on-surface block truncate">
              {simBranch} ({activeCompany.allowedBranches.join(', ')})
            </span>
            <span className={activeEval.branchOk ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-error font-bold'}>
              {activeEval.branchOk ? 'Eligible Department' : 'Branch Not Listed'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
            <span className="text-outline block">4. Overall Verdict &amp; Fit</span>
            <span className="font-mono text-sm font-extrabold text-secondary block">
              {activeEval.boostedMatch}% Composite Match
            </span>
            <span className={activeEval.eligible ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-error font-bold'}>
              {activeEval.eligible ? 'Eligible for Drive' : 'Currently Blocked'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-container-low text-xs">
          <div className="text-on-surface-variant">
            <strong className="text-on-surface">Preparation Focus for {activeCompany.name}:</strong>{' '}
            {activeCompany.gapSkills.length > 0
              ? activeCompany.gapSkills.join(' · ')
              : activeCompany.matchedSkills.slice(0, 3).join(' · ')}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('practice-hub')}
              className="px-3.5 py-2 rounded-xl bg-surface-container-highest text-primary font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap"
            >
              Practice Questions for {activeCompany.name}
            </button>

            {isAlreadyApplied ? (
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="px-3.5 py-2 rounded-xl border border-surface-container-high text-on-surface font-bold hover:bg-surface-container-low transition-colors whitespace-nowrap"
              >
                Applied · View Tracker
              </button>
            ) : activeEval.eligible ? (
              <button
                type="button"
                onClick={() => onApplyCompany(activeCompany)}
                className="px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-bold hover:bg-secondary-container transition-colors whitespace-nowrap"
              >
                Apply to {activeCompany.name}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Section 2: Split What-If Simulator Controls (4-col) + All Companies Eligibility Matrix (8-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm items-start">
        {/* Left 4-col Controls */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
            <h2 className="font-headline-sm text-on-surface font-bold">
              What-If Simulation Controls
            </h2>
            <button
              type="button"
              onClick={() => {
                setSimCgpa(profile.cgpa);
                setSimBacklogs(profile.activeBacklogs);
                setSimBranch('CSE');
                setAddedSkills([]);
              }}
              className="text-xs font-semibold text-secondary hover:underline"
            >
              Reset
            </button>
          </div>

          {/* CGPA Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-on-surface">Simulated CGPA</label>
              <span className="font-mono font-bold text-secondary tabular-nums text-sm">
                {simCgpa.toFixed(2)} / 10.00
              </span>
            </div>
            <input
              type="range"
              min="6.0"
              max="10.0"
              step="0.05"
              value={simCgpa}
              onChange={(e) => setSimCgpa(parseFloat(e.target.value))}
              className="w-full accent-secondary cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-outline tabular-nums">
              <span>6.00</span>
              <span>Live Profile: {profile.cgpa.toFixed(2)}</span>
              <span>10.00</span>
            </div>
          </div>

          {/* Active Backlogs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-on-surface">
              Simulated Active Backlogs
            </label>
            <div className="grid grid-cols-4 gap-1.5 tabular-nums">
              {[0, 1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSimBacklogs(num)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    simBacklogs === num
                      ? 'bg-secondary text-on-secondary border-secondary'
                      : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-on-surface">
              Engineering Branch
            </label>
            <select
              value={simBranch}
              onChange={(e) => setSimBranch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs font-bold text-on-surface outline-none focus:border-secondary"
            >
              <option value="CSE">Computer Science (CSE)</option>
              <option value="IT">Information Technology (IT)</option>
              <option value="ECE">Electronics &amp; Comm. (ECE)</option>
              <option value="EE">Electrical Engineering (EE)</option>
              <option value="ME">Mechanical Engineering (ME)</option>
            </select>
          </div>

          {/* Upskill Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-surface-container-low">
            <span className="block text-xs font-semibold text-on-surface">
              Simulate Closing Skill Deficits
            </span>
            <div className="space-y-1.5">
              {bonusSkillOptions.map((sk) => {
                const checked = addedSkills.includes(sk);
                return (
                  <label
                    key={sk}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low/60 hover:bg-surface-container-low cursor-pointer text-xs text-on-surface"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSkill(sk)}
                      className="w-4 h-4 rounded text-secondary focus:ring-secondary"
                    />
                    <span>{sk}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 8-col Live Simulation Output */}
        <div className="lg:col-span-8 space-y-space-sm">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
            <div>
              <span className="text-xs text-outline font-semibold block">Baseline Eligible</span>
              <span className="font-headline-xl text-on-surface font-extrabold">
                {currentEligibleCount} / {companies.length}
              </span>
            </div>
            <div>
              <span className="text-xs text-outline font-semibold block">Simulated Eligible</span>
              <span className="font-headline-xl text-secondary font-extrabold">
                {simEligibleCount} / {companies.length}
              </span>
            </div>
            <div>
              <span className="text-xs text-outline font-semibold block">Net Gate Impact</span>
              <span
                className={`font-headline-xl font-extrabold ${
                  deltaCount > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : deltaCount < 0
                    ? 'text-error'
                    : 'text-on-surface'
                }`}
              >
                {deltaCount > 0
                  ? `+${deltaCount} Unlocked`
                  : deltaCount < 0
                  ? `${deltaCount} Locked`
                  : 'No Gate Change'}
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-low overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-surface-container-low bg-surface-container-low/50 text-outline">
                    <th className="py-3 px-4 font-semibold">Recruiter &amp; Role</th>
                    <th className="py-3 px-3 font-semibold text-right">Min CGPA</th>
                    <th className="py-3 px-3 font-semibold text-right">Max Backlogs</th>
                    <th className="py-3 px-3 font-semibold text-right">Match Fit</th>
                    <th className="py-3 px-4 font-semibold text-right">Simulated Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {simulatedResults.map(({ company, evalResult }) => {
                    const isFocusedRow = company.id === activeCompany.id;
                    return (
                      <tr
                        key={company.id}
                        onClick={() => {
                          setSelectedId(company.id);
                          onSelectFocusedCompany(company.id);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isFocusedRow
                            ? 'bg-surface-container-low'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-on-surface block text-sm">
                            {company.name}
                          </span>
                          <span className="text-outline">
                            {company.role} · {company.packageLpa}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono">
                          <span className={evalResult.cgpaOk ? 'text-on-surface' : 'text-error font-bold'}>
                            {company.minCgpa.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono">
                          <span
                            className={evalResult.backlogOk ? 'text-on-surface' : 'text-error font-bold'}
                          >
                            {company.allowedBacklogs}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-secondary">
                          {evalResult.boostedMatch}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {evalResult.eligible ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">
                                check_circle
                              </span>
                              Eligible
                            </span>
                          ) : (
                            <span className="text-error font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">cancel</span>
                              Blocked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
