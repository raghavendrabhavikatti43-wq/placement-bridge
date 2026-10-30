import React, { useState, useEffect, useRef } from 'react';
import {
  AptitudeQuestion,
  ChatMessage,
  CodingProblem,
  CompanyDrive,
  SkillGapItem,
  StudentProfile,
} from '../types';
import { APTITUDE_QUESTIONS, CODING_PROBLEMS } from '../data/placementData';

interface AiAssistantViewProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
  skillGaps: SkillGapItem[];
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  profile,
  companies,
  skillGaps,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      text: 'Analyze my current profile and tell me my immediate preparation priority for the upcoming Microsoft SDE drive.',
      timestamp: '09:14 AM',
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      text: `Good morning, ${profile.name.split(' ')[0]}! With a ${profile.cgpa.toFixed(2)} CGPA and ${profile.activeBacklogs} backlogs, you clear Microsoft’s Day-0 academic cutoff (8.00). Based on your skill diagnostics, prioritize these two high-leverage areas over the next 5 days:`,
      timestamp: '09:15 AM',
      details: {
        type: 'diagnosis',
        priorities: [
          {
            num: 1,
            title: 'Dynamic Programming (Knapsack, LCS & Grid DP)',
            desc: 'Your current proficiency is 25%. Microsoft Round 1 & 2 frequently include 1D/2D DP optimization problems. Target: 70%+.',
          },
          {
            num: 2,
            title: 'Binary Tree Traversals & Lowest Common Ancestor',
            desc: 'Master iterative traversals, LCA, and tree serialization before the online assessment.',
          },
        ],
        recommendedTime:
          'Dedicate 2.5 hours daily to timed DSA sprints. Your quantitative score (80%+) already clears standard screening cutoffs.',
      },
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Aptitude state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(18 * 60 + 42);

  // Coding challenge state
  const [selectedLanguage, setSelectedLanguage] = useState<'java' | 'python'>('java');
  const activeCodeProblem: CodingProblem = CODING_PROBLEMS[0];
  const [customCode, setCustomCode] = useState<string>(activeCodeProblem.javaCode);
  const [codeExecutionResult, setCodeExecutionResult] = useState<string | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);

  const activeQuestion: AptitudeQuestion =
    APTITUDE_QUESTIONS[currentQuestionIndex] || APTITUDE_QUESTIONS[0];

  useEffect(() => {
    setCustomCode(
      selectedLanguage === 'java' ? activeCodeProblem.javaCode : activeCodeProblem.pythonCode
    );
  }, [selectedLanguage, activeCodeProblem]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputMessage).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);
    setApiError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          profile,
          companies,
          skillGaps,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reach Placement AI Mentor.');
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: data.text || 'Here is your personalized placement recommendation.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        details:
          data.priorities?.length || data.recommendedTime
            ? {
                type: 'diagnosis',
                priorities: data.priorities,
                recommendedTime: data.recommendedTime,
              }
            : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate AI response.';
      setApiError(message);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelectOption = (optKey: string) => {
    setSelectedOption(optKey);
    setShowAnswerFeedback(true);
  };

  const handleNextQuestion = () => {
    setShowAnswerFeedback(false);
    setSelectedOption(null);
    setCurrentQuestionIndex((prev) => (prev + 1) % APTITUDE_QUESTIONS.length);
  };

  const handlePrevQuestion = () => {
    setShowAnswerFeedback(false);
    setSelectedOption(null);
    setCurrentQuestionIndex(
      (prev) => (prev - 1 + APTITUDE_QUESTIONS.length) % APTITUDE_QUESTIONS.length
    );
  };

  const handleRunCode = async (useAiJudge = false) => {
    setIsRunningCode(true);
    setCodeExecutionResult(null);

    if (!useAiJudge) {
      setTimeout(() => {
        setIsRunningCode(false);
        setCodeExecutionResult(
          `Passed ${activeCodeProblem.testCasesCount}/${activeCodeProblem.testCasesCount} Public Test Cases [${activeCodeProblem.runTime}] · Output: ${activeCodeProblem.sampleOutput}`
        );
      }, 450);
      return;
    }

    try {
      const response = await fetch('/api/ai/code-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemTitle: activeCodeProblem.title,
          problemDescription: activeCodeProblem.description,
          language: selectedLanguage === 'java' ? 'Java' : 'Python 3',
          code: customCode,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Code evaluation failed.');
      setCodeExecutionResult(
        `${data.passed ? 'Accepted' : 'Review Suggested'} · ${data.timeComplexity} time, ${data.spaceComplexity} space — ${data.summary}`
      );
    } catch (err) {
      setCodeExecutionResult(
        err instanceof Error ? err.message : 'Could not run AI complexity judge.'
      );
    } finally {
      setIsRunningCode(false);
    }
  };

  return (
    <div id="ai-assistant-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Intelligence · Contextual Career Coaching &amp; Practice
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            AI Placement Assistant &amp; Preparation Engine
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Live mentoring grounded in your academic dossier, paired with timed aptitude and coding drills.
          </p>
        </div>

        {/* Composite Readiness Metric */}
        <div className="bg-surface-container-low p-space-sm rounded-xl flex items-center gap-3 shrink-0 tabular-nums">
          <div>
            <span className="text-[11px] text-outline font-semibold block">
              Composite Readiness
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-lg text-secondary font-extrabold">
                {profile.readinessScore}
              </span>
              <span className="text-xs text-outline">/ 100</span>
              <span className="text-xs text-secondary font-bold ml-1.5">+4% this week</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-[20px]">insights</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 7-col Chat Terminal, Right 5-col Live Practice Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        {/* Left 7-col: Placement AI Mentor */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col justify-between h-[780px]">
          <div>
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-on-surface font-bold">
                    Placement AI Mentor
                  </h2>
                  <span className="text-[11px] text-outline block">
                    Synced with {companies.length} campus drives &amp; {skillGaps.length} active gaps
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setApiError(null);
                  setMessages([
                    {
                      id: 'msg-reset',
                      sender: 'assistant',
                      text: `Session cleared. Ready to plan your next sprint for ${profile.targetRole}, ${profile.name.split(' ')[0]}. What should we tackle?`,
                      timestamp: 'Now',
                    },
                  ]);
                }}
                className="px-2.5 py-1 rounded-lg text-xs text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0"
              >
                Reset Session
              </button>
            </div>

            {/* Context Strip */}
            <div className="mt-2 py-1.5 px-2.5 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant flex flex-wrap items-center justify-between gap-2 tabular-nums">
              <span>
                <strong>Dossier:</strong> {profile.name} · CGPA {profile.cgpa.toFixed(2)} · {profile.department}
              </span>
              <span className="text-secondary font-bold">Target: {profile.targetRole}</span>
            </div>

            {/* Suggested Prompt Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5">
              {[
                'Analyze my skill gaps for Microsoft SDE-1',
                'Build a 7-day DP & Graph revision schedule',
                'Give me 5 Oracle DBMS & SQL interview questions',
                'Critique my STAR approach for a team conflict question',
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isTyping}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[11px] font-medium whitespace-nowrap transition-colors border border-surface-container shrink-0 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 my-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-secondary text-on-secondary rounded-br-xs'
                      : 'bg-surface-container-low text-on-surface rounded-bl-xs border border-surface-container'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {msg.details?.priorities && msg.details.priorities.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-surface-container-high pt-2.5">
                      {msg.details.priorities.map((item) => (
                        <div
                          key={item.num}
                          className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container text-xs space-y-0.5"
                        >
                          <span className="font-bold text-secondary block">
                            0{item.num}. {item.title}
                          </span>
                          <span className="text-on-surface-variant text-[11px]">{item.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.details?.recommendedTime && (
                    <div className="mt-2.5 p-2 rounded-lg bg-surface-container-lowest text-[11px] text-on-surface-variant font-medium">
                      <strong className="text-on-surface">Time Allocation:</strong>{' '}
                      {msg.details.recommendedTime}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-outline mt-1 px-1 tabular-nums">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="p-3 rounded-2xl bg-surface-container-low text-xs text-outline w-fit">
                Synthesizing placement guidance...
              </div>
            )}

            {apiError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                {apiError}
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Box */}
          <div className="pt-2 border-t border-surface-container-low">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-surface-container-high focus-within:border-secondary transition-colors"
            >
              <input
                type="text"
                placeholder="Ask about company cutoffs, DSA patterns, SQL queries, or behavioral prep..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 bg-transparent px-2.5 text-xs sm:text-sm text-on-surface placeholder:text-outline outline-none"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="px-3.5 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors disabled:opacity-40 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 5-col: Live Practice & Assessment Hub */}
        <div className="lg:col-span-5 space-y-space-sm">
          {/* Card 1: Aptitude & Logical Reasoning Drill */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  calculate
                </span>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  Aptitude &amp; Core CS Drill
                </h3>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-error tabular-nums">
                <span className="material-symbols-outlined text-[15px]">timer</span>
                <span>{formatTimer(timerSeconds)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-outline tabular-nums">
              <span className="font-semibold">
                Question {currentQuestionIndex + 1} of {APTITUDE_QUESTIONS.length}
              </span>
              <span className="text-secondary font-semibold">{activeQuestion.patternBadge}</span>
            </div>

            <p className="font-body-sm text-on-surface font-medium leading-relaxed">
              {activeQuestion.question}
            </p>

            <div className="space-y-2">
              {activeQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.key;
                const isCorrect = opt.key === activeQuestion.correctAnswer;
                let optStyle =
                  'bg-surface-container-low border-surface-container hover:bg-surface-container text-on-surface';

                if (showAnswerFeedback) {
                  if (isCorrect) {
                    optStyle =
                      'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold';
                  } else if (isSelected && !isCorrect) {
                    optStyle = 'bg-error-container border-error text-on-error-container font-bold';
                  }
                } else if (isSelected) {
                  optStyle = 'bg-surface-container-highest border-secondary text-primary font-bold';
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-colors ${optStyle}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-surface-container-lowest border border-current flex items-center justify-center text-[10px] font-mono">
                        {opt.key}
                      </span>
                      <span>{opt.text}</span>
                    </div>
                    {showAnswerFeedback && isCorrect && (
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {showAnswerFeedback && (
              <div className="p-2.5 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant leading-relaxed">
                <strong className="text-on-surface block mb-0.5">Explanation:</strong>
                {activeQuestion.explanation}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-surface-container-low text-xs font-semibold">
              <button
                onClick={handlePrevQuestion}
                className="px-3 py-1.5 rounded-lg text-outline hover:text-on-surface transition-colors"
              >
                Previous
              </button>
              <button
                onClick={handleNextQuestion}
                className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container transition-colors"
              >
                Next Question
              </button>
            </div>
          </div>

          {/* Card 2: Quick Coding Blitz (Editable + AI Judge) */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div>
                <span className="text-[11px] text-outline font-semibold block">Coding Blitz</span>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  {activeCodeProblem.title}
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
                <button
                  onClick={() => setSelectedLanguage('java')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    selectedLanguage === 'java'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  Java
                </button>
                <button
                  onClick={() => setSelectedLanguage('python')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    selectedLanguage === 'python'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  Python 3
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-outline">
              <span>{activeCodeProblem.complexity}</span>
              <span className="text-secondary font-bold">{activeCodeProblem.difficulty}</span>
            </div>

            <textarea
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              spellCheck={false}
              aria-label="Coding Blitz Editor"
              className="w-full h-44 bg-[#091426] text-slate-100 border border-slate-800 p-3 rounded-xl font-mono text-[11px] leading-relaxed outline-none focus:ring-2 focus:ring-secondary resize-y"
            />

            {codeExecutionResult && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-900 dark:text-emerald-300 text-xs font-mono">
                {codeExecutionResult}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
              <span className="text-[11px] text-outline tabular-nums">
                {activeCodeProblem.testCasesCount} Test Cases
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunCode(false)}
                  disabled={isRunningCode}
                  className="px-3 py-1.5 rounded-lg border border-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0"
                >
                  Run Tests
                </button>
                <button
                  onClick={() => handleRunCode(true)}
                  disabled={isRunningCode}
                  className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
                >
                  {isRunningCode ? 'Checking...' : 'AI Judge'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Latest Diagnostic Benchmark Summary */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex items-center justify-between tabular-nums">
            <div>
              <span className="text-[11px] text-outline font-semibold block">
                Latest Proctored Gate
              </span>
              <h4 className="font-headline-sm text-on-surface font-bold">
                18 / 25 (72.0% Achieved)
              </h4>
              <span className="text-[11px] text-outline">
                Accuracy: 84% · Time: 22m 14s
              </span>
            </div>
            <button
              onClick={() =>
                handleSendMessage('Give me a sectional breakdown and improvement plan for my 18/25 mock score.')
              }
              className="text-xs text-secondary font-bold hover:underline whitespace-nowrap shrink-0"
            >
              Ask AI Breakdown →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
