import React from 'react';
import { CompanyDrive, StudentProfile } from '../types';

interface EligibilityModalProps {
  company: CompanyDrive | null;
  profile: StudentProfile;
  isOpen: boolean;
  isApplied: boolean;
  onClose: () => void;
  onApplyToCompany: (company: CompanyDrive) => void;
  onNavigateToApplications: () => void;
}

export const EligibilityModal: React.FC<EligibilityModalProps> = ({
  company,
  profile,
  isOpen,
  isApplied,
  onClose,
  onApplyToCompany,
  onNavigateToApplications,
}) => {
  if (!isOpen || !company) return null;

  const cgpaPassed = profile.cgpa >= company.minCgpa;
  const backlogPassed = profile.activeBacklogs <= company.allowedBacklogs;
  const isPassed = cgpaPassed && backlogPassed;

  return (
    <div
      id="eligibility-details-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl p-space-lg shadow-xl relative max-h-[90vh] overflow-y-auto flex flex-col gap-space-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-space-sm border-b border-surface-container-low">
          <div>
            <span className="font-label-sm text-secondary font-bold block">
              Criteria Verification Engine
            </span>
            <h3 className="font-headline-lg text-on-surface font-bold">{company.name}</h3>
            <p className="font-body-md text-on-surface-variant">{company.role}</p>
          </div>
          <button
            id="close-eligibility-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Eligibility Score Summary Strip */}
        <div
          className={`p-space-md rounded-xl flex items-center justify-between gap-3 ${
            isPassed ? 'bg-surface-container-low' : 'bg-error-container/30'
          }`}
        >
          <div className="flex items-center gap-space-sm">
            <span
              className={`material-symbols-outlined text-[28px] ${
                isPassed ? 'text-secondary' : 'text-error'
              }`}
            >
              {isPassed ? 'verified' : 'error'}
            </span>
            <div>
              <h4 className="font-headline-sm text-on-surface font-bold">
                {isPassed ? 'Criteria Evaluation: Passed' : 'Criteria Evaluation: Shortfall'}
              </h4>
              <span className="font-body-sm text-on-surface-variant">
                {isPassed
                  ? 'You satisfy all institutional recruitment requirements.'
                  : !cgpaPassed
                  ? `Academic CGPA shortfall (${profile.cgpa.toFixed(2)} < ${company.minCgpa.toFixed(2)}). Review TPO waiver option.`
                  : `Backlog threshold exceeded (${profile.activeBacklogs} > ${company.allowedBacklogs}).`}
              </span>
            </div>
          </div>
          <span className="font-headline-md text-secondary font-bold shrink-0 tabular-nums">
            {company.packageLpa}
          </span>
        </div>

        {/* Granular Checklist */}
        <div className="flex flex-col gap-space-sm tabular-nums">
          <h4 className="font-label-lg text-on-surface font-semibold">
            Institutional Gate Analysis
          </h4>
          <div className="space-y-2 font-body-sm">
            {/* Item 1: CGPA */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    cgpaPassed ? 'text-secondary' : 'text-error'
                  }`}
                >
                  {cgpaPassed ? 'check_circle' : 'cancel'}
                </span>
                <span className="font-medium text-on-surface">Academic CGPA Requirement</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-on-surface-variant">
                  Required ≥ {company.minCgpa.toFixed(2)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-xs ${
                    cgpaPassed
                      ? 'bg-surface-container-highest text-primary'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  {cgpaPassed
                    ? `Passed (${profile.cgpa.toFixed(2)})`
                    : `Shortfall (${profile.cgpa.toFixed(2)})`}
                </span>
              </div>
            </div>

            {/* Item 2: Degree/Branch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">
                  check_circle
                </span>
                <span className="font-medium text-on-surface">Degree &amp; Major Filter</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-on-surface-variant">
                  {company.allowedBranches.join(' / ')}
                </span>
                <span className="px-2 py-0.5 rounded font-bold text-xs bg-surface-container-highest text-primary">
                  Passed ({profile.department})
                </span>
              </div>
            </div>

            {/* Item 3: Backlogs */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    backlogPassed ? 'text-secondary' : 'text-error'
                  }`}
                >
                  {backlogPassed ? 'check_circle' : 'cancel'}
                </span>
                <span className="font-medium text-on-surface">Active Backlogs Check</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-on-surface-variant">
                  Max {company.allowedBacklogs} allowed
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-xs ${
                    backlogPassed
                      ? 'bg-surface-container-highest text-primary'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  {backlogPassed
                    ? `Passed (${profile.activeBacklogs})`
                    : `Exceeded (${profile.activeBacklogs})`}
                </span>
              </div>
            </div>

            {/* Item 4: Technical Stack Match */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">
                  analytics
                </span>
                <span className="font-medium text-on-surface">Technical Stack Match</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-on-surface-variant">
                  {company.matchedSkills.length} competencies mapped
                </span>
                <span className="px-2 py-0.5 rounded font-bold text-xs bg-surface-container text-on-surface font-mono">
                  {company.matchScore}% Match
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Skill Gap Advisory Note */}
        <div className="p-space-sm bg-surface-container-low rounded-lg flex items-start gap-space-xs text-on-surface-variant font-body-sm">
          <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
            psychology
          </span>
          <div>
            <span className="font-semibold text-on-surface">Recommended Action:</span>
            <span>
              {' '}
              {company.gapSkills.length > 0
                ? `${company.gapSkills.join(', ')} is flagged for focused revision ahead of technical rounds.`
                : 'All core prerequisites cleared. Review past campus interview questions before the drive date.'}
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-space-sm pt-space-sm border-t border-surface-container-low mt-space-xs">
          <button
            onClick={onClose}
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface font-label-lg hover:bg-surface-container-high transition-colors"
          >
            Close
          </button>

          {isApplied ? (
            <button
              onClick={onNavigateToApplications}
              className="px-space-md py-2 rounded-lg bg-secondary text-on-secondary font-label-lg hover:bg-secondary-container transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Applied · View in Tracker</span>
            </button>
          ) : isPassed ? (
            <button
              onClick={() => {
                onApplyToCompany(company);
                onNavigateToApplications();
              }}
              className="px-space-md py-2 rounded-lg bg-secondary text-on-secondary font-label-lg hover:bg-secondary-container transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Submit Campus Application</span>
            </button>
          ) : (
            <button
              onClick={onNavigateToApplications}
              className="px-space-md py-2 rounded-lg bg-surface-container-highest text-primary font-label-lg hover:bg-surface-container-high transition-colors"
            >
              Open Application Tracker
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
