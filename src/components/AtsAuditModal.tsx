import React, { useState, useEffect, useRef } from 'react';
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
  extractedText?: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number;
}

interface AttachedResumeFile {
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  isImage: boolean;
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
  const [resumeDraft, setResumeDraft] = useState(profile.resumeSummary || '');
  const [showEditor, setShowEditor] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [audit, setAudit] = useState<AtsAuditResult>(DEFAULT_AUDIT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resume file attachment state
  const [attachedFile, setAttachedFile] = useState<AttachedResumeFile | null>(null);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile.resumeSummary) {
      setResumeDraft(profile.resumeSummary);
    }
  }, [profile.resumeSummary]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processSelectedFile = async (file: File) => {
    const isImg = file.type.startsWith('image/');
    let preview: string | undefined = undefined;
    if (isImg) {
      preview = URL.createObjectURL(file);
    }

    setAttachedFile({
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      previewUrl: preview,
      isImage: isImg,
    });

    setIsScanningFile(true);
    setErrorMsg(null);
    setScannedFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetCompany', targetCompany);
      formData.append('targetRole', profile.targetRole);

      const response = await fetch('/api/ai/ats-audit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to scan attached resume.');

      if (data.extractedText && data.extractedText.trim()) {
        setResumeDraft(data.extractedText.trim());
      }
      setAudit(data);
      setShowEditor(true);
      setScannedFeedback(
        `Resume parsed successfully (${formatFileSize(file.size)}). Scanned technical competencies and updated ATS scores.`
      );
    } catch (err) {
      // If server OCR/parse endpoint encountered an issue, fallback to client-side text read if plain text
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          setResumeDraft(text);
          setShowEditor(true);
          setScannedFeedback(`Loaded ${text.length} characters from ${file.name}.`);
        } catch {
          setErrorMsg('Could not read the attached text file.');
        }
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Error scanning attached resume.');
      }
    } finally {
      setIsScanningFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // reset input value so re-uploading the same file works
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemoveAttachedFile = () => {
    if (attachedFile?.previewUrl) {
      URL.revokeObjectURL(attachedFile.previewUrl);
    }
    setAttachedFile(null);
    setScannedFeedback(null);
  };

  const handleRunAiAudit = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      let response: Response;
      if (attachedFile?.file) {
        const formData = new FormData();
        formData.append('file', attachedFile.file);
        formData.append('targetCompany', targetCompany);
        formData.append('targetRole', profile.targetRole);
        formData.append('resumeText', resumeDraft);
        response = await fetch('/api/ai/ats-audit', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/ai/ats-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText: resumeDraft,
            targetCompany,
            targetRole: profile.targetRole,
            profile,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Resume audit failed.');
      if (data.extractedText && data.extractedText.trim() && !resumeDraft) {
        setResumeDraft(data.extractedText.trim());
      }
      setAudit(data);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="ats-audit-modal-content"
        className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl p-space-lg shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col gap-space-md border border-surface-container-high"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-space-sm border-b border-surface-container-low">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-label-sm text-secondary font-bold">
                AI Resume Scanner
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-semibold">
                Multimodal ATS
              </span>
            </div>
            <h3 className="font-headline-lg text-on-surface font-extrabold tracking-tight">
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

        {/* Target Recruiter Select */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-surface-container-low p-3 rounded-xl border border-surface-container">
          <div className="flex items-center gap-2">
            <label className="font-bold text-on-surface">Benchmark Against:</label>
            <select
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-on-surface font-bold outline-none focus:border-secondary"
            >
              <option value="Microsoft">Microsoft (Day-0 SDE)</option>
              <option value="Oracle Server Tech">Oracle Server Tech (MTS)</option>
              <option value="Deloitte USI">Deloitte USI (Analyst)</option>
              <option value="Goldman Sachs">Goldman Sachs (Engg)</option>
              <option value="TCS Digital">TCS Digital (Innovator)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-outline text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-emerald-500">verified</span>
            <span>Verified 2026 Campus Scoring Models</span>
          </div>
        </div>

        {/* BLOCK 1: Attach Your Resume (File / Document / Image) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                attach_file
              </span>
              <h4 className="font-headline-sm text-on-surface font-bold text-sm">
                Attach Your Resume
              </h4>
            </div>
            <span className="text-[11px] text-outline">
              PDF, Word (.docx), TXT, or Image scan (.png, .jpg)
            </span>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!attachedFile ? (
            /* Upload Drop Area */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                isDragOver
                  ? 'border-secondary bg-secondary/10 scale-[1.01]'
                  : 'border-surface-container-high hover:border-secondary bg-surface-container-low/70 hover:bg-surface-container-low'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center text-secondary shadow-xs">
                <span className="material-symbols-outlined text-[26px]">upload_file</span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">
                  Drag &amp; drop your resume document or image here, or{' '}
                  <span className="text-secondary hover:underline">browse files</span>
                </p>
                <p className="text-[11px] text-outline mt-0.5">
                  Accepts PDF documents, Word (.docx), Plain text, or clear photo/scanned image (Max 10 MB)
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-mono font-semibold text-on-surface-variant">
                  PDF
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-mono font-semibold text-on-surface-variant">
                  DOCX
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-mono font-semibold text-on-surface-variant">
                  PNG / JPG
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-mono font-semibold text-on-surface-variant">
                  TXT
                </span>
              </div>
            </div>
          ) : (
            /* Attached File Card */
            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                {attachedFile.isImage && attachedFile.previewUrl ? (
                  <img
                    src={attachedFile.previewUrl}
                    alt="Resume preview"
                    className="w-12 h-12 rounded-xl object-cover border border-surface-container shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-[24px]">
                      {attachedFile.name.endsWith('.pdf')
                        ? 'picture_as_pdf'
                        : attachedFile.name.endsWith('.docx') || attachedFile.name.endsWith('.doc')
                        ? 'description'
                        : 'draft'}
                    </span>
                  </div>
                )}
                <div className="overflow-hidden text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface truncate block">
                      {attachedFile.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                      Attached
                    </span>
                  </div>
                  <span className="text-[11px] text-outline block mt-0.5">
                    {formatFileSize(attachedFile.size)} · {attachedFile.isImage ? 'Image Scan' : 'Document'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-surface-container-high text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAttachedFile}
                  className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container transition-colors"
                  title="Remove file"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanningFile && (
            <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center gap-2.5 text-xs text-secondary font-medium animate-pulse">
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
              <span>Scanning document and extracting text with AI OCR engine...</span>
            </div>
          )}

          {/* Scanned Feedback Banner */}
          {scannedFeedback && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
              <span>{scannedFeedback}</span>
            </div>
          )}
        </div>

        {/* BLOCK 2: Resume Text & Editable Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-outline text-[16px]">edit_note</span>
              <label className="font-semibold text-on-surface">
                Resume Content Text
              </label>
              {attachedFile && (
                <span className="text-[11px] text-secondary font-medium">
                  (Extracted from {attachedFile.name})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowEditor((prev) => !prev)}
              className="text-secondary font-bold hover:underline"
            >
              {showEditor ? 'Hide Text' : 'View / Edit Text'}
            </button>
          </div>

          {showEditor && (
            <div className="space-y-1">
              <textarea
                rows={5}
                value={resumeDraft}
                onChange={(e) => setResumeDraft(e.target.value)}
                placeholder="Paste or edit your resume summary, skills, and project bullet points here..."
                className="w-full p-3 rounded-xl border border-surface-container-high bg-surface-container-low text-xs text-on-surface font-mono outline-none focus:border-secondary resize-y leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-outline px-1">
                <span>{resumeDraft.length} characters</span>
                <span>Plaintext view used for ATS keyword &amp; verb matching</span>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {analyzing ? (
          <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-[40px] text-secondary animate-spin">
              progress_activity
            </span>
            <p className="font-headline-sm text-on-surface font-bold">
              Auditing resume against {targetCompany} ATS benchmarks...
            </p>
            <p className="text-xs text-outline">
              Evaluating keyword density, technical terms, action verbs, and parseability.
            </p>
          </div>
        ) : (
          <>
            {/* Score Banner */}
            <div className="bg-surface-container-low p-space-md rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 tabular-nums border border-surface-container">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center bg-surface-container-lowest rounded-2xl border border-surface-container shrink-0 shadow-xs">
                  <span className="font-headline-lg text-secondary font-extrabold text-2xl">
                    {audit.overallScore}
                  </span>
                  <span className="absolute bottom-1 text-[9px] text-outline font-bold">/ 100</span>
                </div>
                <div>
                  <h4 className="font-headline-sm text-on-surface font-bold">
                    {audit.headlineVerdict}
                  </h4>
                  <p className="font-body-sm text-on-surface-variant text-xs mt-0.5">
                    {audit.summaryNote}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRunAiAudit}
                disabled={analyzing}
                className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Scan with AI</span>
              </button>
            </div>

            {/* Granular Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
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

              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
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
                  Quantified engineering metrics
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
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
              <h5 className="font-label-lg text-on-surface font-bold text-xs">
                Recommended Resume Optimizations for {targetCompany}
              </h5>
              {audit.optimizations.map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-surface-container bg-surface-container-lowest flex items-start gap-2.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
                    add_task
                  </span>
                  <div className="text-xs">
                    <span className="font-bold text-on-surface block">{opt.title}</span>
                    <span className="text-on-surface-variant text-[11px] mt-0.5 block leading-relaxed">
                      {opt.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-space-sm border-t border-surface-container-low">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
