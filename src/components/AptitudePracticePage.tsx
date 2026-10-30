import React, { useState, useEffect } from 'react';
import { AptitudeQuestion, NavigationPath } from '../types';
import { APTITUDE_QUESTIONS } from '../data/placementData';

interface AptitudePracticePageProps {
  answers: Record<number, string>;
  onSelectAnswer: (questionId: number, optionKey: string) => void;
  onResetAnswers: () => void;
  onNavigate: (path: NavigationPath) => void;
}

export const AptitudePracticePage: React.FC<AptitudePracticePageProps> = ({
  answers,
  onSelectAnswer,
  onResetAnswers,
  onNavigate,
}) => {
  const categories = [
    'All',
    'Quantitative',
    'Logical Reasoning',
    'Speed Math',
    'Data Interpretation',
    'Verbal Ability',
  ] as const;

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(20 * 60);
  const [isPaused, setIsPaused] = useState(false);

  const filteredQuestions: AptitudeQuestion[] =
    selectedCategory === 'All'
      ? APTITUDE_QUESTIONS
      : APTITUDE_QUESTIONS.filter((q) => q.category === selectedCategory);

  const safeIndex = activeIndex < filteredQuestions.length ? activeIndex : 0;
  const currentQ = filteredQuestions[safeIndex] || APTITUDE_QUESTIONS[0];

  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [isPaused]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleBookmark = (id: number) => {
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const attemptedCount = Object.keys(answers).length;
  const correctCount = APTITUDE_QUESTIONS.filter(
    (q) => answers[q.id] && answers[q.id] === q.correctAnswer
  ).length;
  const accuracy =
    attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  const selectedAnswer = answers[currentQ.id] || null;
  const hasAnswered = Boolean(selectedAnswer);

  const handlePrevQuestion = () => {
    setActiveIndex(
      (prev) => (prev - 1 + filteredQuestions.length) % filteredQuestions.length
    );
  };

  const handleNextQuestion = () => {
    setActiveIndex((prev) => (prev + 1) % filteredQuestions.length);
  };

  return (
    <div id="aptitude-practice-page" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Header with Back to Practice Mode Chooser */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('practice-hub')}
            className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Practice Mode Selection</span>
          </button>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Aptitude &amp; Reasoning Practice
          </h1>
          <p className="font-body-sm text-on-surface-variant max-w-2xl">
            Dedicated screening drill for Quantitative Aptitude, Logical Reasoning, Speed Math, Data Interpretation, and Verbal Ability.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onResetAnswers();
              setTimerSeconds(20 * 60);
              setActiveIndex(0);
            }}
            className="px-3.5 py-2 rounded-xl border border-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0"
          >
            Reset Aptitude Session
          </button>
        </div>
      </div>

      {/* Aptitude Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm tabular-nums">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
          <span className="text-xs font-semibold text-outline block mb-1">Questions Attempted</span>
          <div className="font-headline-xl text-on-surface font-extrabold">
            {attemptedCount}{' '}
            <span className="text-sm font-medium text-outline">/ {APTITUDE_QUESTIONS.length}</span>
          </div>
          <span className="text-xs text-on-surface-variant mt-1 block">Pure aptitude bank</span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
          <span className="text-xs font-semibold text-outline block mb-1">Live Accuracy</span>
          <div className="font-headline-xl text-secondary font-extrabold">
            {attemptedCount > 0 ? `${accuracy}%` : '—'}
          </div>
          <span className="text-xs text-on-surface-variant mt-1 block">
            {correctCount} correct responses
          </span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
          <span className="text-xs font-semibold text-outline block mb-1">Session Timer</span>
          <div className="flex items-center justify-between">
            <span className="font-headline-xl text-on-surface font-extrabold font-mono">
              {formatTimer(timerSeconds)}
            </span>
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-bold text-secondary transition-colors whitespace-nowrap shrink-0"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <span className="text-xs text-outline mt-1 block">Target pace: 75 sec / question</span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low">
          <span className="text-xs font-semibold text-outline block mb-1">Bookmarked Items</span>
          <div className="font-headline-xl text-on-surface font-extrabold">{bookmarks.length}</div>
          <span className="text-xs text-on-surface-variant mt-1 block">Flagged for revision</span>
        </div>
      </div>

      {/* Aptitude Category Filter Bar */}
      <div className="bg-surface-container-lowest p-2 rounded-2xl border border-surface-container-low flex items-center gap-1.5 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setSelectedCategory(cat);
              setActiveIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-secondary text-on-secondary'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Question Workspace + Question Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        {/* Left 8-col: Active Aptitude Question Card */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-2xl border border-surface-container-low space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
            <div className="flex items-center gap-2 text-xs text-outline flex-wrap">
              <span className="font-bold text-on-surface tabular-nums">
                Question {safeIndex + 1} of {filteredQuestions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-secondary font-semibold">{currentQ.category}</span>
              <span aria-hidden="true">·</span>
              <span>{currentQ.patternBadge}</span>
            </div>

            <button
              type="button"
              onClick={() => toggleBookmark(currentQ.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                bookmarks.includes(currentQ.id)
                  ? 'bg-secondary-fixed text-on-secondary-fixed'
                  : 'text-outline hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {bookmarks.includes(currentQ.id) ? 'bookmark_added' : 'bookmark'}
              </span>
              <span>{bookmarks.includes(currentQ.id) ? 'Saved' : 'Bookmark'}</span>
            </button>
          </div>

          <p className="font-body-lg text-on-surface font-medium leading-relaxed">
            {currentQ.question}
          </p>

          <div className="space-y-2.5">
            {currentQ.options.map((opt) => {
              const isSelected = selectedAnswer === opt.key;
              const isCorrect = opt.key === currentQ.correctAnswer;

              let styleClass =
                'bg-surface-container-low/60 border-surface-container hover:bg-surface-container text-on-surface';
              if (hasAnswered) {
                if (isCorrect) {
                  styleClass =
                    'bg-emerald-500/15 border-emerald-600 text-emerald-950 dark:text-emerald-200 font-bold';
                } else if (isSelected && !isCorrect) {
                  styleClass = 'bg-error-container border-error text-on-error-container font-bold';
                }
              }

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSelectAnswer(currentQ.id, opt.key)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm text-left transition-colors ${styleClass}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-surface-container-lowest border border-surface-container-high flex items-center justify-center text-xs font-mono font-bold shrink-0">
                      {opt.key}
                    </span>
                    <span>{opt.text}</span>
                  </div>
                  {hasAnswered && isCorrect && (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Correct
                    </span>
                  )}
                  {hasAnswered && isSelected && !isCorrect && (
                    <span className="text-xs font-bold text-error flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      Incorrect
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {hasAnswered && (
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface-variant leading-relaxed space-y-1">
              <span className="font-bold text-on-surface block">Step-by-Step Derivation</span>
              <p>{currentQ.explanation}</p>
            </div>
          )}

          {/* Previous Question & Next Question Navigation Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
            <button
              id="aptitude-prev-question-btn"
              type="button"
              onClick={handlePrevQuestion}
              className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Previous Question</span>
            </button>

            <span className="text-xs text-outline font-mono tabular-nums hidden sm:inline">
              {safeIndex + 1} / {filteredQuestions.length}
            </span>

            <button
              id="aptitude-next-question-btn"
              type="button"
              onClick={handleNextQuestion}
              className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Next Question</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Right 4-col: Aptitude Question Navigator Grid */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-headline-sm text-on-surface font-bold pb-2 border-b border-surface-container-low">
              Aptitude Question Navigator
            </h3>

            <div className="grid grid-cols-5 gap-2 tabular-nums">
              {filteredQuestions.map((q, idx) => {
                const ans = answers[q.id];
                const isCurr = idx === safeIndex;
                let btnStyle = 'bg-surface-container-low text-on-surface hover:bg-surface-container';
                if (ans) {
                  btnStyle =
                    ans === q.correctAnswer
                      ? 'bg-emerald-600 text-white'
                      : 'bg-error text-on-error';
                }
                if (isCurr) {
                  btnStyle += ' ring-2 ring-secondary ring-offset-2';
                }
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`h-10 rounded-xl font-mono text-xs font-bold transition-all ${btnStyle}`}
                  >
                    Q{idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 space-y-1.5 text-xs text-outline">
              <div className="flex items-center justify-between">
                <span>Correctly Answered</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{correctCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Incorrect / Review</span>
                <span className="font-bold text-error tabular-nums">
                  {attemptedCount - correctCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unattempted</span>
                <span className="font-bold text-on-surface tabular-nums">
                  {APTITUDE_QUESTIONS.length - attemptedCount}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('ai-assistant')}
            className="w-full py-2.5 rounded-xl bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors"
          >
            Ask AI Mentor for Shortcut Formulas
          </button>
        </div>
      </div>
    </div>
  );
};
