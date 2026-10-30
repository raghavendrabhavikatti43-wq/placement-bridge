import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';

interface AtsAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
}

interface AtsAuditResult {
  overallScore: number;
  headlineVerdict: string;
  summaryNote: string;
  keywordDensity: number;
  actionVerbs: number;
  formatting: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  optimizations: { title: string; detail: string }[];
}

const DEFAULT_AUDIT: AtsAuditResult = {
  overallScore: 84,
  headlineVerdict: 'Strong ATS Parsing Quotient',
  summaryNote:
    'Your resume satisfies 18 of 20 technical parsing checkpoints for Day-0 SDE campus drives.',
  keywordDensity: 88,
  actionVerbs: 80,
  formatting: 92,
  matchedKeywords: ['Java', 'Python', 'SQL', 'PostgreSQL', 'Redis', 'REST APIs'],
  missingKeywords: ['System Design', 'CI/CD', 'Unit Testing'],
  optimizations: [
    {
      title: 'Include "Distributed Systems" & "Concurrency" in project bullets',
      detail:
        'Microsoft and Oracle automated screeners prioritize explicit concurrency and fault-tolerance keywords in candidate project descriptions.',
    },
    {
      title: 'Quantify test coverage and p99 latency metrics',
      detail:
        'Adding unit/integration test metrics alongside throughput figures strengthens Round-1 shortlisting.',
    },
  ],
};

export const AtsAuditModal: React.FC<AtsAuditModalProps> = ({ isOpen, onClose, profile }) => {
  const [targetCompany, setTargetCompany] = useState('Microsoft');
  const [resumeDraft, setResumeDraft] = useState(profile.resumeSummary);
  const [showEditor, setShowEditor] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [audit, setAudit] = useState<AtsAuditResult>(DEFAULT_AUDIT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setResumeDraft(profile.resumeSummary);
  }, [profile.resumeSummary]);

  if (!isOpen) return null;

  const handleRunAiAudit = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/ai/ats-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeDraft,
          targetCompany,
          targetRole: profile.targetRole,
          profile,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Resume audit failed.');
      setAudit(data);
      setShowEditor(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete AI ATS scan.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      id="ats-audit-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="ats-audit-modal-content"
        className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl p-space-lg shadow-xl relative max-h-[90vh] overflow-y-auto flex flex-col gap-space-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-space-sm border-b border-surface-container-low">
          <div>
            <span className="font-label-sm text-secondary font-bold block">
              AI Resume Scanner
            </span>
            <h3 className="font-headline-lg text-on-surface font-bold">
              ATS Resume Compatibility Audit
            </h3>
            <p className="font-body-sm text-on-surface-variant">
              Candidate: {profile.name} · Target Role: {profile.targetRole}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Target Recruiter & Resume Input Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-outline">Benchmark Against:</label>
            <select
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-low text-on-surface font-bold outline-none focus:border-secondary"
            >
              <option value="Microsoft">Microsoft (Day-0 SDE)</option>
              <option value="Oracle Server Tech">Oracle Server Tech (MTS)</option>
              <option value="Deloitte USI">Deloitte USI (Analyst)</option>
              <option value="Goldman Sachs">Goldman Sachs (Engg)</option>
              <option value="TCS Digital">TCS Digital (Innovator)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            className="text-secondary font-bold hover:underline"
          >
            {showEditor ? 'Hide Resume Text' : 'Edit / Paste Resume Text'}
          </button>
        </div>

        {showEditor && (
          <div className="space-y-2">
            <textarea
              rows={5}
              value={resumeDraft}
              onChange={(e) => setResumeDraft(e.target.value)}
              placeholder="Paste your resume summary, skills, and project bullet points..."
              className="w-full p-3 rounded-xl border border-surface-container-high bg-surface-container-low text-xs text-on-surface font-mono outline-none focus:border-secondary resize-y"
            />
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
            {errorMsg}
          </div>
        )}

        {analyzing ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-[40px] text-secondary animate-spin">
              progress_activity
            </span>
            <p className="font-headline-sm text-on-surface">
              Evaluating resume bullets &amp; keywords against {targetCompany} criteria...
            </p>
          </div>
        ) : (
          <>
            {/* Score Banner */}
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 tabular-nums">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center bg-surface-container-lowest rounded-2xl border border-surface-container shrink-0">
                  <span className="font-headline-lg text-secondary font-extrabold">
                    {audit.overallScore}
                  </span>
                  <span className="absolute bottom-1 text-[9px] text-outline font-bold">/ 100</span>
                </div>
                <div>
                  <h4 className="font-headline-sm text-on-surface font-bold">
                    {audit.headlineVerdict}
                  </h4>
                  <p className="font-body-sm text-on-surface-variant">{audit.summaryNote}</p>
                </div>
              </div>
              <button
                onClick={handleRunAiAudit}
                className="px-3.5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Scan with AI</span>
              </button>
            </div>

            {/* Granular Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center justify-between text-xs text-outline font-semibold mb-1">
                  <span>Keyword Density</span>
                  <span className="text-secondary font-bold">{audit.keywordDensity}%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full"
                    style={{ width: `${audit.keywordDensity}%` }}
                  />
                </div>
                <span className="text-[11px] text-on-surface-variant mt-1.5 block truncate">
                  Matched: {audit.matchedKeywords.slice(0, 4).join(', ')}
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center justify-between text-xs text-outline font-semibold mb-1">
                  <span>Impact &amp; Verbs</span>
                  <span className="text-secondary font-bold">{audit.actionVerbs}%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full"
                    style={{ width: `${audit.actionVerbs}%` }}
                  />
                </div>
                <span className="text-[11px] text-on-surface-variant mt-1.5 block">
                  Quantified engineering outcomes
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center justify-between text-xs text-outline font-semibold mb-1">
                  <span>ATS Parseability</span>
                  <span className="text-secondary font-bold">{audit.formatting}%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full"
                    style={{ width: `${audit.formatting}%` }}
                  />
                </div>
                <span className="text-[11px] text-on-surface-variant mt-1.5 block truncate">
                  Missing: {audit.missingKeywords.slice(0, 3).join(', ') || 'None'}
                </span>
              </div>
            </div>

            {/* Improvement Recommendations */}
            <div className="space-y-2">
              <h5 className="font-label-lg text-on-surface font-bold">
                Recommended Resume Optimizations for {targetCompany}
              </h5>
              {audit.optimizations.map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-surface-container bg-surface-container-lowest flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                    add_task
                  </span>
                  <div className="text-xs">
                    <span className="font-bold text-on-surface block">{opt.title}</span>
                    <span className="text-on-surface-variant">{opt.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-space-sm border-t border-surface-container-low">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
