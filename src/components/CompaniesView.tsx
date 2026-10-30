import React, { useState } from 'react';
import { CompanyDrive, NavigationPath, StudentProfile } from '../types';

interface CompaniesViewProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
  appliedCompanyIds: string[];
  onCheckCompanyEligibility: (companyId: string) => void;
  onApplyCompany: (company: CompanyDrive) => void;
  onNavigate: (path: NavigationPath) => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  profile,
  companies,
  appliedCompanyIds,
  onCheckCompanyEligibility,
  onApplyCompany,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [minCgpaFilter, setMinCgpaFilter] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredCompanies = companies.filter((comp) => {
    if (onlyEligible && !comp.isEligible) return false;
    if (minCgpaFilter && comp.minCgpa > minCgpaFilter) return false;
    if (roleFilter !== 'all') {
      if (
        roleFilter === 'sde' &&
        !comp.role.toLowerCase().includes('engineer') &&
        !comp.role.toLowerCase().includes('developer') &&
        !comp.role.toLowerCase().includes('technical')
      ) {
        return false;
      }
      if (roleFilter === 'analyst' && !comp.role.toLowerCase().includes('analyst')) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = comp.name.toLowerCase().includes(q);
      const matchRole = comp.role.toLowerCase().includes(q);
      const matchSkills = comp.matchedSkills.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchRole && !matchSkills) return false;
    }
    return true;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setOnlyEligible(false);
    setMinCgpaFilter(null);
    setRoleFilter('all');
  };

  return (
    <div id="companies-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Official Campus Recruitment Cycle · 2026-27
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Explore Placement Opportunities
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Browse visiting campus recruiters, compensation bands, and hiring funnels, or jump to the dedicated Eligibility Checker page to verify criteria.
          </p>
        </div>

        {/* Summary Metrics & Dedicated Eligibility Page Button */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 tabular-nums">
          <div className="bg-surface-container-low px-3.5 py-2 rounded-xl text-center">
            <span className="font-headline-md text-secondary font-bold block leading-none">
              {companies.filter((c) => c.isEligible).length} / {companies.length}
            </span>
            <span className="text-[11px] text-outline font-semibold">Eligible Drives</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('eligibility-checker')}
            className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
          >
            Open Eligibility Checker Page →
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface-container-lowest p-space-sm rounded-2xl border border-surface-container-low flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search company name, role, skills, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface text-sm placeholder:text-outline outline-none focus:border-secondary transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-on-surface px-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary cursor-pointer"
            />
            <span>Only Show Eligible ({companies.filter((c) => c.isEligible).length})</span>
          </label>

          <span className="text-xs text-outline font-semibold tabular-nums whitespace-nowrap">
            Showing {filteredCompanies.length} of {companies.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-surface-container-low text-xs">
          <span className="text-outline font-medium">Filter Roles:</span>
          <button
            onClick={() => setRoleFilter(roleFilter === 'sde' ? 'all' : 'sde')}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold whitespace-nowrap ${
              roleFilter === 'sde'
                ? 'bg-secondary text-on-secondary'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            Software &amp; Systems (SDE/MTS)
          </button>
          <button
            onClick={() => setRoleFilter(roleFilter === 'analyst' ? 'all' : 'analyst')}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold whitespace-nowrap ${
              roleFilter === 'analyst'
                ? 'bg-secondary text-on-secondary'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            Analyst &amp; Consulting
          </button>
          <button
            onClick={() => setMinCgpaFilter(minCgpaFilter === 7.5 ? null : 7.5)}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold whitespace-nowrap ${
              minCgpaFilter === 7.5
                ? 'bg-secondary text-on-secondary'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            Min CGPA ≤ 7.50
          </button>
          {(searchQuery || onlyEligible || minCgpaFilter !== null || roleFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-2 py-1 text-xs text-error font-semibold hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Company Cards List */}
      <div className="space-y-space-sm">
        {filteredCompanies.map((comp) => {
          const hasApplied = appliedCompanyIds.includes(comp.id);
          return (
            <div
              key={comp.id}
              className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low hover:border-secondary/30 transition-colors space-y-3"
            >
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-secondary border border-surface-container shrink-0">
                    <span className="material-symbols-outlined text-[26px]">{comp.logoIcon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-headline-md text-on-surface font-bold">{comp.name}</h3>
                      <span className="text-xs text-outline">· {comp.category} ·</span>
                      {comp.isEligible ? (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          Eligible
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-error inline-flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[15px]">cancel</span>
                          Criteria Shortfall
                        </span>
                      )}
                    </div>
                    <p className="font-body-md text-on-surface font-semibold mt-0.5">{comp.role}</p>
                    <span className="text-xs text-outline tabular-nums">
                      {comp.location} · Drive Date: {comp.driveDate} ({comp.daysRemaining} days left)
                    </span>
                  </div>
                </div>

                {/* CTC & Match Score */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 tabular-nums">
                  <span className="font-headline-lg text-secondary font-extrabold">
                    {comp.packageLpa}
                  </span>
                  <span className="font-mono text-xs font-bold text-on-surface mt-0.5">
                    {comp.matchScore}% Match
                  </span>
                </div>
              </div>

              {/* Criteria & Skills Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-surface-container-low">
                <div className="space-y-1 text-xs tabular-nums">
                  <span className="font-semibold text-outline block text-[11px]">
                    Institutional Gates
                  </span>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        profile.cgpa >= comp.minCgpa ? 'text-secondary' : 'text-error'
                      }`}
                    >
                      {profile.cgpa >= comp.minCgpa ? 'check' : 'close'}
                    </span>
                    <span>
                      Min CGPA: <strong>{comp.minCgpa.toFixed(2)}</strong> (Yours: {profile.cgpa.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        profile.activeBacklogs <= comp.allowedBacklogs ? 'text-secondary' : 'text-error'
                      }`}
                    >
                      {profile.activeBacklogs <= comp.allowedBacklogs ? 'check' : 'close'}
                    </span>
                    <span>
                      Backlogs Allowed: Max {comp.allowedBacklogs} (Yours: {profile.activeBacklogs})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-[16px]">
                      check
                    </span>
                    <span>Branches: {comp.allowedBranches.join(', ')}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-outline block text-[11px]">
                    Skill Alignment &amp; Gaps
                  </span>
                  <p className="text-on-surface-variant leading-relaxed">
                    <strong className="text-on-surface">Matched:</strong>{' '}
                    {comp.matchedSkills.join(' · ')}
                  </p>
                  {comp.gapSkills.length > 0 && (
                    <p className="text-error font-medium">
                      <strong>Focus Gap:</strong> {comp.gapSkills.join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Hiring Funnel & Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-container-low">
                <div className="flex items-center gap-2 text-xs text-outline overflow-x-auto">
                  <span className="font-bold text-on-surface">Funnel:</span>
                  {comp.hiringFunnel.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className="whitespace-nowrap">{step}</span>
                      {idx < comp.hiringFunnel.length - 1 && <span>→</span>}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onCheckCompanyEligibility(comp.id)}
                    className="px-3 py-1.5 rounded-lg border border-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors whitespace-nowrap"
                  >
                    {comp.isEligible ? 'Check Eligibility Page' : 'View Criteria Gap'}
                  </button>

                  {hasApplied ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('applications')}
                      className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap"
                    >
                      Applied · Track
                    </button>
                  ) : comp.isEligible ? (
                    <button
                      type="button"
                      onClick={() => onApplyCompany(comp)}
                      className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap"
                    >
                      Apply to Drive
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCheckCompanyEligibility(comp.id)}
                      className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors whitespace-nowrap"
                    >
                      Simulate Waiver
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredCompanies.length === 0 && (
          <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-surface-container-low">
            <span className="material-symbols-outlined text-[36px] text-outline mb-2">
              filter_alt_off
            </span>
            <h4 className="font-headline-sm text-on-surface font-bold">No Companies Found</h4>
            <p className="text-xs text-outline mt-1 mb-4">
              Try adjusting your search query or reset the filters.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
