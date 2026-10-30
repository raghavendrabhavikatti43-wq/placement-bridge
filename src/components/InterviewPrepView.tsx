import React, { useState } from 'react';
import { StudentProfile } from '../types';
import { INTERVIEW_ARCHIVES } from '../data/placementData';

interface InterviewPrepViewProps {
  profile: StudentProfile;
}

interface EvaluationFeedback {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  refinedSampleAnswer: string;
}

export const InterviewPrepView: React.FC<InterviewPrepViewProps> = ({ profile }) => {
  const [company, setCompany] = useState('Microsoft');
  const [roundType, setRoundType] = useState('Technical DSA & Core CS');
  const [currentQuestion, setCurrentQuestion] = useState(
    'Design an LRU Cache supporting O(1) get and put operations, and explain how you would make it thread-safe under high read concurrency.'
  );
  const [interviewerFocus, setInterviewerFocus] = useState(
    'HashMap + Doubly Linked List invariants, edge cases on capacity = 1, and ReadWriteLock vs ConcurrentHashMap trade-offs.'
  );
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<EvaluationFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateQuestion = async () => {
    setLoadingQuestion(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/ai/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          company,
          roundType,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate question.');
      setCurrentQuestion(data.question);
      setInterviewerFocus(data.interviewerFocus);
      setCandidateAnswer('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate interview question.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  const handleEvaluateAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateAnswer.trim()) return;
    setEvaluating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          company,
          roundType,
          question: currentQuestion,
          answer: candidateAnswer,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed.');
      setFeedback(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to evaluate answer.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div id="interview-prep-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Preparation Hub · Technical &amp; Behavioral Panel Simulator
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Interview Preparation &amp; Campus Archives
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Rehearse live technical and STAR behavioral rounds with AI panel grading, backed by verified senior transcripts.
          </p>
        </div>

        <button
          onClick={handleGenerateQuestion}
          disabled={loadingQuestion}
          className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {loadingQuestion ? 'Generating Prompt...' : 'Generate New Panel Question'}
        </button>
      </div>

      {/* Main Split: Live Simulator (7-col) + Campus Archives (5-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm items-start">
        {/* Left 7-col: AI Mock Interview Simulator */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-surface-container-low">
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">
                Target Recruiter
              </label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface text-xs font-bold outline-none focus:border-secondary"
              >
                <option value="Microsoft">Microsoft (Day-0 SDE)</option>
                <option value="Oracle Server Tech">Oracle Server Tech (MTS)</option>
                <option value="Deloitte USI">Deloitte USI (Tech Analyst)</option>
                <option value="Goldman Sachs">Goldman Sachs (Quant / Engg)</option>
                <option value="TCS Digital">TCS Digital (Innovator)</option>
                <option value="Accenture">Accenture (Adv. App Engg)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-outline mb-1">
                Interview Round Format
              </label>
              <select
                value={roundType}
                onChange={(e) => setRoundType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface text-xs font-bold outline-none focus:border-secondary"
              >
                <option value="Technical DSA & Core CS">Technical DSA &amp; Core CS</option>
                <option value="Low-Level & System Design">Low-Level &amp; System Design</option>
                <option value="Resume Project Deep-Dive">Resume Project Deep-Dive</option>
                <option value="HR Behavioral (STAR Method)">HR Behavioral (STAR Method)</option>
              </select>
            </div>
          </div>

          {/* Active Prompt */}
          <div className="p-4 rounded-xl bg-surface-container-low space-y-2">
            <div className="text-xs text-outline flex items-center gap-2">
              <span className="font-bold text-secondary">{company}</span>
              <span aria-hidden="true">·</span>
              <span>{roundType}</span>
            </div>
            <p className="font-headline-sm text-on-surface font-bold leading-snug">
              {currentQuestion}
            </p>
            <p className="text-xs text-on-surface-variant">
              <strong className="text-on-surface">Panelist Evaluation Rubric:</strong>{' '}
              {interviewerFocus}
            </p>
          </div>

          <form onSubmit={handleEvaluateAnswer} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Your Verbal / Technical Walkthrough
              </label>
              <textarea
                rows={6}
                value={candidateAnswer}
                onChange={(e) => setCandidateAnswer(e.target.value)}
                placeholder="Type how you would explain your approach, data structures, time/space trade-offs, or STAR story..."
                className="w-full p-3.5 rounded-xl border border-surface-container-high bg-surface-container-low/50 text-on-surface text-sm outline-none focus:border-secondary resize-y"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setCandidateAnswer(
                    'I would combine a HashMap mapping keys to Doubly Linked List nodes so both get(key) and put(key, val) run in O(1) time. On every access, we detach the node and move it to the head; when capacity overflows, we evict tail.prev. For concurrency, instead of a coarse global synchronized lock, we can shard the cache into 16 segments each guarded by a ReentrantLock.'
                  )
                }
                className="text-xs text-secondary font-semibold hover:underline"
              >
                Insert Sample Response
              </button>

              <button
                type="submit"
                disabled={evaluating || !candidateAnswer.trim()}
                className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {evaluating ? 'Scoring Response...' : 'Evaluate My Answer'}
              </button>
            </div>
          </form>

          {feedback && (
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <div>
                  <span className="text-xs text-outline block">Panelist Readiness Score</span>
                  <h4 className="font-headline-sm text-on-surface font-bold">
                    {feedback.verdict}
                  </h4>
                </div>
                <span className="font-headline-xl text-secondary font-extrabold tabular-nums">
                  {feedback.score}/100
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-emerald-800 block">Key Strengths</span>
                  <ul className="space-y-1 text-on-surface-variant list-disc pl-4">
                    {feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-error block">Areas to Tighten</span>
                  <ul className="space-y-1 text-on-surface-variant list-disc pl-4">
                    {feedback.improvements.map((imp, i) => (
                      <li key={i}>{imp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-container text-xs space-y-1">
                <span className="font-bold text-on-surface block">Model High-Bar Response</span>
                <p className="text-on-surface-variant leading-relaxed">
                  {feedback.refinedSampleAnswer}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right 5-col: Verified Senior Interview Archives */}
        <div className="lg:col-span-5 space-y-space-sm">
          {INTERVIEW_ARCHIVES.map((arch) => (
            <div
              key={arch.id}
              className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-outline">
                    <span className="font-bold text-secondary">{arch.verdict}</span>
                    <span aria-hidden="true">·</span>
                    <span>{arch.year}</span>
                    <span aria-hidden="true">·</span>
                    <span>{arch.difficulty}</span>
                  </div>
                  <h3 className="font-headline-sm text-on-surface font-bold mt-0.5">
                    {arch.company} — {arch.role}
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-on-surface tabular-nums">
                  {arch.packageLpa}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {arch.rounds.map((r, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-surface-container-low space-y-1">
                    <span className="font-bold text-on-surface block">{r.roundName}</span>
                    <span className="text-outline block text-[11px]">{r.focus}</span>
                    <ul className="list-disc pl-4 text-on-surface-variant space-y-0.5 pt-0.5">
                      {r.keyQuestions.map((kq, kIdx) => (
                        <li key={kIdx}>{kq}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="text-xs text-on-surface-variant pt-1 border-t border-surface-container-low">
                <strong className="text-on-surface">Senior Tip:</strong> {arch.advice}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
