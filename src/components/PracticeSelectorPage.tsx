import React from 'react';
import { NavigationPath } from '../types';
import { APTITUDE_QUESTIONS, CODING_PROBLEMS } from '../data/placementData';

interface PracticeSelectorPageProps {
  aptitudeAttemptedCount: number;
  aptitudeCorrectCount: number;
  codingSolvedCount: number;
  onNavigate: (path: NavigationPath) => void;
}

export const PracticeSelectorPage: React.FC<PracticeSelectorPageProps> = ({
  aptitudeAttemptedCount,
  aptitudeCorrectCount,
  codingSolvedCount,
  onNavigate,
}) => {
  const aptitudeAccuracy =
    aptitudeAttemptedCount > 0
      ? Math.round((aptitudeCorrectCount / aptitudeAttemptedCount) * 100)
      : null;

  return (
    <div id="practice-selector-page" className="space-y-space-md animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Preparation Hub · Dedicated Assessment Tracks
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Choose Your Practice Mode
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Select either Quantitative &amp; Logical Aptitude or Technical Code Solving to enter a focused, distraction-free practice environment with question-by-question navigation.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 tabular-nums text-xs text-outline">
          <div className="text-right">
            <span className="block">Aptitude Progress</span>
            <strong className="font-headline-sm text-on-surface font-extrabold">
              {aptitudeAttemptedCount} / {APTITUDE_QUESTIONS.length}
            </strong>
          </div>
          <span aria-hidden="true" className="text-surface-container-high">|</span>
          <div className="text-right">
            <span className="block">Coding Solved</span>
            <strong className="font-headline-sm text-secondary font-extrabold">
              {codingSolvedCount} / {CODING_PROBLEMS.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Two Primary Practice Track Choice Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md items-stretch">
        {/* Option 1: Aptitude Practice */}
        <div
          id="choose-aptitude-track-card"
          onClick={() => onNavigate('aptitude-practice')}
          className="bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low hover:border-secondary transition-colors cursor-pointer flex flex-col justify-between gap-6 group"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[26px]">calculate</span>
              </div>
              <span className="font-mono text-xs text-outline tabular-nums">
                01 · Screening Round Track
              </span>
            </div>

            <div>
              <h2 className="font-headline-lg text-on-surface font-extrabold group-hover:text-secondary transition-colors">
                Aptitude &amp; Logical Reasoning Practice
              </h2>
              <p className="font-body-md text-on-surface-variant mt-1.5 leading-relaxed">
                Practice pure quantitative aptitude, speed math, logical puzzles, data interpretation, and verbal reasoning with instant answer verification and step-by-step derivations.
              </p>
            </div>

            <div className="pt-3 border-t border-surface-container-low space-y-2 text-xs text-on-surface-variant">
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Question Bank</span>
                <span className="font-semibold text-on-surface">
                  {APTITUDE_QUESTIONS.length} Curated Aptitude Questions · 5 Domains
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Navigation Controls</span>
                <span className="font-semibold text-on-surface">
                  Previous / Next Question + Q1–Q{APTITUDE_QUESTIONS.length} Palette
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Your Session Status</span>
                <span className="font-mono font-bold text-secondary">
                  {aptitudeAttemptedCount} Attempted
                  {aptitudeAccuracy !== null ? ` · ${aptitudeAccuracy}% Accuracy` : ''}
                </span>
              </div>
            </div>

            <div className="text-xs text-outline">
              <strong className="text-on-surface">Topics Included:</strong> Quantitative · Logical Reasoning · Speed Math · Data Interpretation · Verbal Ability
            </div>
          </div>

          <button
            id="open-aptitude-page-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('aptitude-practice');
            }}
            className="w-full py-3 px-4 rounded-xl bg-secondary text-on-secondary font-label-lg font-bold hover:bg-secondary-container transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>Enter Aptitude Practice Page</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        {/* Option 2: Technical Code Solving */}
        <div
          id="choose-coding-track-card"
          onClick={() => onNavigate('coding-practice')}
          className="bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low hover:border-secondary transition-colors cursor-pointer flex flex-col justify-between gap-6 group"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[26px]">code_blocks</span>
              </div>
              <span className="font-mono text-xs text-outline tabular-nums">
                02 · Technical OA &amp; DSA Track
              </span>
            </div>

            <div>
              <h2 className="font-headline-lg text-on-surface font-extrabold group-hover:text-secondary transition-colors">
                Technical Code Solving Practice
              </h2>
              <p className="font-body-md text-on-surface-variant mt-1.5 leading-relaxed">
                Dedicated coding-only workspace featuring algorithmic challenges in Java 21, Python 3, and C++ 20 with Previous/Next question stepping, public test runners, and complexity analysis.
              </p>
            </div>

            <div className="pt-3 border-t border-surface-container-low space-y-2 text-xs text-on-surface-variant">
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Coding Problem Set</span>
                <span className="font-semibold text-on-surface">
                  {CODING_PROBLEMS.length} Day-0 &amp; Tier-1 Coding Problems (Easy–Hard)
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Navigation Controls</span>
                <span className="font-semibold text-on-surface">
                  Previous / Next Question + Q1–Q{CODING_PROBLEMS.length} Coding Palette
                </span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-outline">Your Session Status</span>
                <span className="font-mono font-bold text-secondary">
                  {codingSolvedCount} / {CODING_PROBLEMS.length} Problems Solved
                </span>
              </div>
            </div>

            <div className="text-xs text-outline">
              <strong className="text-on-surface">Topics Included:</strong> Arrays · Sliding Window · Intervals · Monotonic Stack · Binary Trees · Dynamic Programming · Graphs
            </div>
          </div>

          <button
            id="open-coding-page-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('coding-practice');
            }}
            className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-label-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>Enter Technical Code Solving Page</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Focused Mode Guarantee Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-on-surface-variant">
        <div>
          <strong className="text-on-surface font-bold block mb-0.5">
            Strict Single-Domain Focus
          </strong>
          <span>
            Each practice option opens its own dedicated page—when solving Technical Coding problems, only coding challenges and compiler tools are shown; when practicing Aptitude, only aptitude questions are displayed.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('eligibility-checker')}
          className="px-3.5 py-2 rounded-xl border border-surface-container-high text-on-surface font-bold hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0"
        >
          Open Eligibility Checker →
        </button>
      </div>
    </div>
  );
};
