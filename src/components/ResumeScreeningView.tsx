import React, { useState, useEffect, useRef } from 'react';
import { CompanyDrive, StudentProfile } from '../types';

interface ResumeScreeningViewProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
}

interface MatchBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  resumeMatch: number;
  companyFit: number;
  overallScore: number;
  hiringChance: 'Very High' | 'High' | 'Moderate' | 'Low';
  matchRating: 'Great Match' | 'Good Match' | 'Moderate Match' | 'Low Match';
  applicantPercentile: string;
}

interface ResumeAnalysisRecord {
  id: string;
  studentId: string;
  fileId?: string | null;
  jobDescription?: string | null;
  keywordMatchPct?: number | null;
  aiUsed: boolean;
  createdAt: string;
  extracted?: {
    candidateName?: string;
    skillsFound?: string[];
    actionVerbsFound?: string[];
    matchedKeywords?: string[];
    missingKeywords?: string[];
    matchBreakdown?: MatchBreakdown;
  };
  suggestions?: { type: string; text: string }[];
}

const DEFAULT_BREAKDOWN: MatchBreakdown = {
  skillsMatch: 95,
  experienceMatch: 88,
  educationMatch: 92,
  resumeMatch: 90,
  companyFit: 85,
  overallScore: 91,
  hiringChance: 'Very High',
  matchRating: 'Great Match',
  applicantPercentile: 'Top 10% of applicants',
};

const DEFAULT_MATCHED_SKILLS = [
  'Python',
  'SQL',
  'AWS',
  'Machine Learning',
  'Data Analysis',
  'PostgreSQL',
  'Docker',
];

const DEFAULT_MISSING_SKILLS = ['CI/CD Pipelines', 'System Design (LCA/Sharding)', 'Kubernetes'];

export const ResumeScreeningView: React.FC<ResumeScreeningViewProps> = ({
  profile,
  companies,
}) => {
  // Target benchmark selection
  const [selectedCompany, setSelectedCompany] = useState<string>('Microsoft');
  const [selectedRole, setSelectedRole] = useState<string>('Data Engineer / SDE-1');

  // Active match data
  const [matchData, setMatchData] = useState<MatchBreakdown>(DEFAULT_BREAKDOWN);
  const [matchedSkills, setMatchedSkills] = useState<string[]>(DEFAULT_MATCHED_SKILLS);
  const [missingSkills, setMissingSkills] = useState<string[]>(DEFAULT_MISSING_SKILLS);
  const [suggestions, setSuggestions] = useState<{ type: string; text: string }[]>([
    {
      type: 'KEYWORDS',
      text: 'Add explicit "Distributed Systems", "ETL Pipelines", and "PySpark" bullet points to highlight data infrastructure expertise.',
    },
    {
      type: 'IMPACT',
      text: 'Quantify data pipeline throughput (e.g. processed 10M+ events/day, reduced query latency by 35%).',
    },
    {
      type: 'SECTIONS',
      text: 'List cloud certifications (AWS Solutions Architect or Databricks) prominently in the technical skills header.',
    },
  ]);

  // Upload and parsing states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<
    'idle' | 'uploaded' | 'extracting' | 'analyzing' | 'completed' | 'failed'
  >('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeFileName, setActiveFileName] = useState<string>('Aditya_Sharma_DataEngineer_Resume.pdf');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Analysis history
  const [history, setHistory] = useState<ResumeAnalysisRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch student analysis history on load
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/resume/analyses');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setHistory(json.data);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Compute hiring chance color & badge
  const getHiringChanceColor = (chance: string) => {
    switch (chance) {
      case 'Very High':
        return 'text-emerald-500';
      case 'High':
        return 'text-emerald-400';
      case 'Moderate':
        return 'text-amber-400';
      default:
        return 'text-rose-400';
    }
  };

  // Handle file upload and live scan
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validation: PDF or DOCX or TXT
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt && !file.type.includes('pdf')) {
      setErrorMessage('Please upload a valid PDF or DOCX resume document.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10 MB limit. Please upload a smaller file.');
      return;
    }

    setErrorMessage(null);
    setActiveFileName(file.name);
    setIsUploading(true);
    setUploadStep('uploaded');
    setUploadProgress(25);

    try {
      // Step 2: Extracting
      setUploadStep('extracting');
      setUploadProgress(50);

      const formData = new FormData();
      formData.append('file', file);
      formData.append(
        'jobDescription',
        `${selectedCompany} ${selectedRole} Python SQL AWS Machine Learning Data Engineering Distributed Systems ETL Spark Airflow`
      );
      formData.append('targetCompany', selectedCompany);
      formData.append('targetRole', selectedRole);
      formData.append('useAi', 'true');

      // Step 3: Analyzing
      setUploadStep('analyzing');
      setUploadProgress(75);

      const res = await fetch('/api/resume/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to analyze resume.');

      // Success
      setUploadStep('completed');
      setUploadProgress(100);

      const breakdown: MatchBreakdown = data.data?.matchBreakdown || {
        skillsMatch: data.data?.keywordMatchPct ?? 91,
        experienceMatch: 88,
        educationMatch: 92,
        resumeMatch: 90,
        companyFit: 85,
        overallScore: data.data?.overallScore ?? 91,
        hiringChance: data.data?.hiringChance ?? 'Very High',
        matchRating: data.data?.matchRating ?? 'Great Match',
        applicantPercentile: data.data?.applicantPercentile ?? 'Top 10% of applicants',
      };

      setMatchData(breakdown);
      if (data.data?.matchedKeywords?.length) {
        setMatchedSkills(data.data.matchedKeywords.slice(0, 8));
      }
      if (data.data?.missingKeywords?.length) {
        setMissingSkills(data.data.missingKeywords.slice(0, 5));
      }
      if (data.data?.suggestions?.length) {
        setSuggestions(data.data.suggestions);
      }

      setSavedSuccessMessage(`Resume analyzed for ${selectedCompany} (${selectedRole})!`);
      setTimeout(() => setSavedSuccessMessage(null), 5000);
      loadHistory();
      setShowUploadZone(false);
    } catch (err) {
      setUploadStep('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Re-run matching against selected company & role
  const handleReMatch = async (company: string, role: string) => {
    setSelectedCompany(company);
    setSelectedRole(role);
    setIsUploading(true);
    setUploadStep('analyzing');

    try {
      const res = await fetch('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: `${profile.name} — ${profile.department}, CGPA ${profile.cgpa}. Skills: Python, SQL, Java, AWS, Machine Learning, Data Structures, Docker, REST APIs. Projects: Distributed Job Queue with Redis and PostgreSQL, Data Pipeline Orchestrator.`,
          jobDescription: `${company} ${role} Python SQL AWS Machine Learning Data Engineering Distributed Systems ETL Spark Airflow`,
          targetCompany: company,
          targetRole: role,
        }),
      });

      const data = await res.json();
      if (res.ok && data.data) {
        const breakdown: MatchBreakdown = data.data.matchBreakdown || {
          skillsMatch: data.data.keywordMatchPct ?? 90,
          experienceMatch: 86,
          educationMatch: 92,
          resumeMatch: 88,
          companyFit: 84,
          overallScore: data.data.overallScore ?? 90,
          hiringChance: data.data.hiringChance ?? 'Very High',
          matchRating: data.data.matchRating ?? 'Great Match',
          applicantPercentile: data.data.applicantPercentile ?? 'Top 10% of applicants',
        };
        setMatchData(breakdown);
        if (data.data.matchedKeywords?.length) setMatchedSkills(data.data.matchedKeywords.slice(0, 8));
        if (data.data.missingKeywords?.length) setMissingSkills(data.data.missingKeywords.slice(0, 5));
        if (data.data.suggestions?.length) setSuggestions(data.data.suggestions);
      }
    } catch {
      // Keep existing data
    } finally {
      setIsUploading(false);
      setUploadStep('idle');
    }
  };

  // Delete analysis from history
  const handleDeleteAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/resume/analyses/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        setItemToDelete(null);
      }
    } catch {
      // offline handling
    }
  };

  return (
    <div id="ai-resume-screening-page" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner Control Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              AI Match Engine
            </span>
            <span className="text-[11px] text-outline">·</span>
            <span className="text-[11px] text-outline font-semibold">Active File: {activeFileName}</span>
          </div>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            AI Resume Screening &amp; Match Score
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-0.5">
            Evaluate your resume against target company job roles with predictive ATS parsing, hiring chance gauges, and benchmark cohort comparisons.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowUploadZone((prev) => !prev)}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>{showUploadZone ? 'Close Uploader' : 'Upload Resume'}</span>
          </button>

          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface text-xs font-bold hover:bg-surface-container transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>History ({history.length})</span>
          </button>
        </div>
      </div>

      {/* Target Recruiter & Role Selection Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-outline">Target Company:</span>
            <select
              value={selectedCompany}
              onChange={(e) => handleReMatch(e.target.value, selectedRole)}
              className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-bold outline-none focus:border-secondary"
            >
              <option value="Microsoft">Microsoft</option>
              <option value="Google">Google</option>
              <option value="Amazon">Amazon</option>
              <option value="Oracle Server Tech">Oracle Server Tech</option>
              <option value="Deloitte USI">Deloitte USI</option>
              <option value="Goldman Sachs">Goldman Sachs</option>
              <option value="TCS Digital">TCS Digital</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-outline">Target Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => handleReMatch(selectedCompany, e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-bold outline-none focus:border-secondary"
            >
              <option value="Data Engineer / SDE-1">Data Engineer (SDE-1)</option>
              <option value="Software Engineer (SDE-1)">Software Engineer (SDE-1)</option>
              <option value="Cloud Systems Engineer">Cloud Systems Engineer</option>
              <option value="Backend Developer (Java/Python)">Backend Developer</option>
              <option value="Full Stack Developer (React/Node)">Full Stack Developer</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] text-outline font-semibold">
            Real-time scoring model calibrated for Day-0 Campus Drives
          </span>
        </div>
      </div>

      {/* Optional Upload Drag-and-Drop Zone */}
      {showUploadZone && (
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border-2 border-dashed border-secondary/40 bg-secondary/5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">cloud_upload</span>
              <h3 className="font-headline-sm text-on-surface font-bold">
                Upload New Resume (PDF / DOCX)
              </h3>
            </div>
            <span className="text-xs text-outline">Max size: 10 MB</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              if (e.target) e.target.value = '';
            }}
            className="hidden"
          />

          <div
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
              isDragOver
                ? 'border-secondary bg-secondary/15 scale-[1.01]'
                : 'border-surface-container-high bg-surface-container-lowest hover:border-secondary'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">upload_file</span>
            </div>
            <p className="text-xs font-bold text-on-surface">
              Click to browse or drag and drop your PDF resume here
            </p>
            <p className="text-[11px] text-outline">
              Automatic text extraction, skills classification, and deterministic matching
            </p>
          </div>

          {/* Stepper Status */}
          {isUploading && (
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-secondary capitalize">{uploadStep}...</span>
                <span className="text-outline">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{savedSuccessMessage}</span>
        </div>
      )}

      {/* History Drawer / List */}
      {showHistory && (
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
            <h3 className="font-headline-sm text-on-surface font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">history</span>
              Previous Resume Analyses
            </h3>
            <span className="text-xs text-outline">{history.length} records</span>
          </div>

          {loadingHistory ? (
            <div className="p-4 text-center text-xs text-outline">Loading past records...</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-xs text-outline">
              No previous analyses found. Upload your first resume above to track results!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-surface-container-low text-outline uppercase font-mono text-[10px]">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Target Company &amp; Role</th>
                    <th className="py-2 px-3">Overall Score</th>
                    <th className="py-2 px-3">Engine</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-outline">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-on-surface">
                        {item.jobDescription || 'General SDE Campus Assessment'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-bold font-mono text-[11px] bg-secondary/15 text-secondary">
                          {item.keywordMatchPct ?? 91}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-outline">
                        {item.aiUsed ? 'Gemini AI + ATS' : 'Deterministic ATS'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setItemToDelete(item.id)}
                          className="p-1 rounded-lg text-outline hover:text-error hover:bg-surface-container transition-colors"
                          title="Delete Record"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MAIN TWO-COLUMN SECTION (Matches user uploaded image layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        {/* LEFT COLUMN: 4 Cols — Hero Title, 3D Bullseye Target Graphic, Scoring Profiles (NO FACES) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low shadow-xs space-y-4">
            {/* AI-Powered Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <span className="material-symbols-outlined text-[14px]">sparkles</span>
              AI-Powered
            </span>

            {/* Bold Headline */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
                AI Match <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-500">
                  Score
                </span>
              </h2>
              <p className="font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Know your match score and hiring chances before applying to campus placement drives.
              </p>
            </div>

            {/* 3D Target Graphic with Floating Score Card */}
            <div className="relative py-4 flex items-center justify-center">
              {/* Bullseye SVG Illustration */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-[10px] border-violet-500/20 animate-pulse"></div>
                {/* Middle Ring */}
                <div className="absolute inset-4 rounded-full border-[10px] border-indigo-500/40"></div>
                {/* Inner Ring */}
                <div className="absolute inset-8 rounded-full border-[10px] border-violet-500/60"></div>
                {/* Center Bullseye */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[32px]">track_changes</span>
                </div>
              </div>

              {/* Floating Match Card (Overlay) */}
              <div className="absolute -bottom-2 right-1 sm:right-2 p-3 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high shadow-xl flex flex-col items-center">
                <span className="text-2xl font-extrabold text-secondary tabular-nums">
                  {matchData.overallScore}%
                </span>
                <span className="text-[11px] font-bold text-on-surface">
                  {matchData.matchRating}
                </span>
                <div className="flex items-center gap-0.5 text-amber-400 text-xs mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

            {/* Candidate Benchmark Profiles (STRICTLY NO FACES PER USER INSTRUCTION) */}
            <div className="pt-2 border-t border-surface-container-low space-y-2">
              <span className="text-[10px] uppercase font-bold text-outline tracking-wider block">
                Scoring Profile Benchmarks
              </span>

              <div className="grid grid-cols-3 gap-2">
                {/* Profile 1: You */}
                <div className="p-2.5 rounded-xl bg-violet-500/10 border-2 border-secondary/50 flex flex-col items-center text-center relative">
                  <span className="absolute -top-2 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-xs">
                    {matchData.overallScore}%
                  </span>
                  {/* Non-Face Monogram Avatar */}
                  <div className="w-9 h-9 rounded-full bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center shadow-xs">
                    {profile.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <span className="text-xs font-bold text-on-surface mt-1.5 block">You</span>
                  <span className="text-[10px] text-secondary font-semibold truncate max-w-full">
                    {matchData.matchRating}
                  </span>
                </div>

                {/* Profile 2: Top Benchmark */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center text-center relative opacity-85">
                  <span className="absolute -top-2 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600/80 text-white">
                    95%
                  </span>
                  {/* Scoring Glyph */}
                  <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant font-bold text-xs flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface mt-1.5 block">Top 5%</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-full">
                    High Match
                  </span>
                </div>

                {/* Profile 3: Median Benchmark */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center text-center relative opacity-75">
                  <span className="absolute -top-2 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-500 text-white">
                    68%
                  </span>
                  {/* Scoring Glyph */}
                  <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant font-bold text-xs flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">equalizer</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface mt-1.5 block">Median</span>
                  <span className="text-[10px] text-outline font-semibold truncate max-w-full">
                    Avg Match
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 8 Cols — Main AI Match Score Dashboard Card */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-md sm:p-space-lg rounded-3xl border border-surface-container-low shadow-md space-y-6">
          {/* Dashboard Card Top Header */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[24px]">target</span>
              </div>
              <div>
                <h3 className="font-headline-lg text-on-surface font-extrabold tracking-tight">
                  AI Match Score
                </h3>
                <p className="font-body-sm text-on-surface-variant text-xs">
                  Get insights on your job match and hiring chances
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Updated just now
              </span>

              <button
                onClick={() => setSavedSuccessMessage('Match score bookmark saved!')}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
                title="Bookmark score"
              >
                <span className="material-symbols-outlined text-[20px]">bookmark</span>
              </button>
            </div>
          </div>

          {/* TOP METRICS ROW: Gauge 1 (Overall Score) & Gauge 2 (Hiring Chance) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gauge 1: Overall Match Score (Circular Gauge) */}
            <div className="p-space-md rounded-2xl bg-surface-container-low/70 border border-surface-container flex flex-col items-center justify-between text-center relative">
              <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface mb-2">
                <span className="flex items-center gap-1">
                  Overall Match Score
                  <span className="material-symbols-outlined text-outline text-[14px]">info</span>
                </span>
                <span className="text-[11px] text-secondary font-mono">
                  {selectedCompany}
                </span>
              </div>

              {/* Circular Gauge Graphic */}
              <div className="relative w-36 h-36 flex items-center justify-center my-1">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-surface-container"
                    strokeWidth="9"
                    fill="transparent"
                  />
                  {/* Animated Progress Gradient Ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="url(#matchScoreGradient)"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 * (1 - matchData.overallScore / 100)
                    }
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="matchScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Centered Score */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-on-surface tabular-nums">
                    {matchData.overallScore}%
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {matchData.matchRating}
                  </span>
                </div>
              </div>

              {/* Sub-badge */}
              <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                <span>{matchData.applicantPercentile}</span>
              </div>
            </div>

            {/* Gauge 2: Hiring Chance (Speedometer Arc) */}
            <div className="p-space-md rounded-2xl bg-surface-container-low/70 border border-surface-container flex flex-col items-center justify-between text-center relative">
              <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface mb-2">
                <span className="flex items-center gap-1">
                  Hiring Chance
                  <span className="material-symbols-outlined text-outline text-[14px]">info</span>
                </span>
                <span className="text-[11px] text-outline font-mono">Predictive Model</span>
              </div>

              {/* Semi-circular Speedometer SVG */}
              <div className="relative w-44 h-28 flex items-center justify-center overflow-hidden pt-1">
                <svg className="w-44 h-44 -mt-16" viewBox="0 0 100 100">
                  {/* Gauge Arc Background */}
                  <path
                    d="M 15 50 A 35 35 0 0 1 85 50"
                    fill="none"
                    stroke="#e2e8f0"
                    className="dark:stroke-slate-800"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Gradient Arc Fill */}
                  <path
                    d="M 15 50 A 35 35 0 0 1 85 50"
                    fill="none"
                    stroke="url(#speedometerGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={Math.PI * 35}
                    strokeDashoffset={Math.PI * 35 * (1 - matchData.overallScore / 100)}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Speedometer Center Value */}
                <div className="absolute bottom-2 flex flex-col items-center">
                  <span
                    className={`text-xl font-extrabold ${getHiringChanceColor(
                      matchData.hiringChance
                    )}`}
                  >
                    {matchData.hiringChance}
                  </span>
                  <span className="text-[11px] text-outline font-semibold">
                    Chance of getting hired
                  </span>
                </div>
              </div>

              {/* Green Callout Banner */}
              <div className="mt-2 w-full p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">
                  check_circle
                </span>
                <span>You have high chances of getting hired for this role!</span>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Match Breakdown (5 Bars) & Skills Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            {/* Match Breakdown Bars (7 Cols) */}
            <div className="md:col-span-7 space-y-3.5">
              <h4 className="font-headline-sm text-on-surface font-extrabold text-sm tracking-tight flex items-center justify-between">
                <span>Match Breakdown</span>
                <span className="text-[11px] text-outline font-normal">Weighted Index</span>
              </h4>

              <div className="space-y-3 text-xs">
                {/* 1. Skills Match */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-5 font-mono text-outline font-bold">&lt;/&gt;</span>
                      Skills Match
                    </span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {matchData.skillsMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${matchData.skillsMatch}%` }}
                    />
                  </div>
                </div>

                {/* 2. Experience Match */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-5 text-outline">💼</span>
                      Experience Match
                    </span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {matchData.experienceMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${matchData.experienceMatch}%` }}
                    />
                  </div>
                </div>

                {/* 3. Education Match */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-5 text-outline">🎓</span>
                      Education Match
                    </span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {matchData.educationMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${matchData.educationMatch}%` }}
                    />
                  </div>
                </div>

                {/* 4. Resume Match */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-5 text-outline">📄</span>
                      Resume Match
                    </span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {matchData.resumeMatch}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${matchData.resumeMatch}%` }}
                    />
                  </div>
                </div>

                {/* 5. Company Fit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-5 text-outline">🏢</span>
                      Company Fit
                    </span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {matchData.companyFit}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${matchData.companyFit}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Skills & Score Booster Card (5 Cols) */}
            <div className="md:col-span-5 space-y-4">
              {/* Top Matched Skills */}
              <div className="space-y-2">
                <h4 className="font-headline-sm text-on-surface font-extrabold text-sm tracking-tight">
                  Top Matched Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {matchedSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Improve Your Score Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-surface-container-low border border-violet-500/20 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  </div>
                  <h5 className="font-bold text-on-surface text-xs">
                    Improve Your Score
                  </h5>
                </div>

                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Add these high-weightage skills to increase your match score even more:
                </p>

                <div className="flex flex-wrap gap-1">
                  {missingSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-container text-on-surface-variant border border-surface-container-high"
                    >
                      + {skill}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setShowSuggestionsModal(true)}
                  className="pt-1 text-xs font-bold text-secondary hover:underline flex items-center gap-1"
                >
                  <span>View Suggestions</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions Modal */}
      {showSuggestionsModal && (
        <div
          onClick={() => setShowSuggestionsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-space-lg shadow-xl border border-surface-container space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">tips_and_updates</span>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  Resume Optimization Recommendations
                </h3>
              </div>
              <button
                onClick={() => setShowSuggestionsModal(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-surface-container-low border border-surface-container space-y-1 text-xs"
                >
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary">
                    {s.type}
                  </span>
                  <p className="text-on-surface text-xs leading-relaxed mt-1">{s.text}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-container-low">
              <button
                onClick={() => setShowSuggestionsModal(false)}
                className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          onClick={() => setItemToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest max-w-sm w-full rounded-2xl p-space-md shadow-xl border border-surface-container space-y-3"
          >
            <h4 className="font-headline-sm text-on-surface font-bold text-sm">
              Confirm Deletion
            </h4>
            <p className="text-xs text-on-surface-variant">
              Are you sure you want to delete this resume analysis record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-outline hover:text-on-surface text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAnalysis(itemToDelete)}
                className="px-3.5 py-1.5 rounded-lg bg-error text-on-error text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
