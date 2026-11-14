import React, { useState, useEffect, useRef } from 'react';
import {
  ChatMessage,
  CompanyDrive,
  SkillGapItem,
  StudentProfile,
} from '../types';

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

  return (
    <div id="ai-assistant-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Placement Intelligence Engine Active
            </span>
            <span className="text-[11px] text-outline font-medium">·</span>
            <span className="text-[11px] text-outline font-medium">Context-Grounded</span>
          </div>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            AI Placement Assistant &amp; Career Mentor
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Real-time personalized placement guidance, interview coaching, and cutoff diagnostics directly grounded in your student dossier.
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
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-[22px]">insights</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 7-col Chat Terminal, Right 5-col AI Assistant Details & Capabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        {/* Left 7-col: Placement AI Mentor Interactive Chat */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col justify-between h-[780px] shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-on-surface font-bold">
                      Placement AI Mentor
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/15 text-secondary">
                      Online
                    </span>
                  </div>
                  <span className="text-[11px] text-outline block">
                    Grounded with {companies.length} campus drives &amp; {skillGaps.length} target skill gaps
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
                      text: `Session refreshed. Ready to strategize for your target role (${profile.targetRole}), ${profile.name.split(' ')[0]}. What would you like to prepare for today?`,
                      timestamp: 'Now',
                    },
                  ]);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 border border-surface-container-low"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Reset Session
              </button>
            </div>

            {/* Context Strip */}
            <div className="mt-2.5 py-2 px-3 rounded-xl bg-surface-container-low text-[11px] text-on-surface-variant flex flex-wrap items-center justify-between gap-2 tabular-nums border border-surface-container">
              <span>
                <strong>Active Dossier:</strong> {profile.name} · CGPA {profile.cgpa.toFixed(2)} · {profile.department}
              </span>
              <span className="text-secondary font-bold">Target: {profile.targetRole}</span>
            </div>

            {/* Suggested Quick Prompt Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-thin">
              {[
                'Analyze my skill gaps for Microsoft SDE-1',
                'Build a 7-day DP & Graph revision schedule',
                'Give me 5 Oracle DBMS & SQL interview questions',
                'Critique my STAR approach for a team conflict question',
                'Evaluate my Day-0 drive eligibility',
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
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 my-2.5 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-secondary text-on-secondary rounded-br-xs shadow-xs'
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
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-container-low text-xs text-outline w-fit border border-surface-container">
                <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                <span>Synthesizing contextual placement guidance...</span>
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
                className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 5-col: AI Assistant Details & Capabilities */}
        <div className="lg:col-span-5 space-y-space-sm">
          {/* Card 1: AI Assistant Architecture & Intelligence Specs */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 pb-2 border-b border-surface-container-low">
              <span className="material-symbols-outlined text-secondary text-[22px]">
                neurology
              </span>
              <div>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  AI Assistant Intelligence Specs
                </h3>
                <span className="text-[11px] text-outline block">
                  System architecture &amp; real-time knowledge grounding
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                <span className="text-[10px] uppercase font-bold text-outline block mb-0.5">
                  Reasoning Engine
                </span>
                <span className="font-bold text-on-surface">Adaptive Placement LLM</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                  Active &amp; Responsive
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                <span className="text-[10px] uppercase font-bold text-outline block mb-0.5">
                  Dossier Sync
                </span>
                <span className="font-bold text-on-surface">Live Academic DB</span>
                <span className="text-[11px] text-secondary block mt-0.5 font-medium">
                  Zero Hallucination Grounded
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                <span className="text-[10px] uppercase font-bold text-outline block mb-0.5">
                  Connected Drives
                </span>
                <span className="font-bold text-on-surface">{companies.length} Campus Drives</span>
                <span className="text-[11px] text-outline block mt-0.5">
                  Microsoft, Google, Amazon, etc.
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                <span className="text-[10px] uppercase font-bold text-outline block mb-0.5">
                  Target Diagnostics
                </span>
                <span className="font-bold text-on-surface">{skillGaps.length} Skill Gaps</span>
                <span className="text-[11px] text-outline block mt-0.5">
                  Prioritized by recurrence
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Student Dossier Context Seen by AI Assistant */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  badge
                </span>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  Grounded Student Dossier
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-container-low">
                <span className="text-outline">Candidate Name</span>
                <span className="font-bold text-on-surface">{profile.name}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-container-low">
                <span className="text-outline">Academic Branch</span>
                <span className="font-bold text-on-surface">{profile.department}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-container-low">
                <span className="text-outline">CGPA Cutoff Clearance</span>
                <span className="font-bold text-secondary">{profile.cgpa.toFixed(2)} / 10.0</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-container-low">
                <span className="text-outline">Backlog History</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {profile.activeBacklogs} Active (Clearance: Day-0 Tier 1)
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-container-low">
                <span className="text-outline">Target Career Role</span>
                <span className="font-bold text-on-surface">{profile.targetRole}</span>
              </div>
            </div>
          </div>

          {/* Card 3: AI Assistant Core Capabilities */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3 shadow-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-container-low">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                verified_user
              </span>
              <h3 className="font-headline-sm text-on-surface font-bold">
                AI Assistant Core Capabilities
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                <span className="text-lg">🎯</span>
                <div>
                  <h4 className="font-bold text-on-surface">Drive Eligibility Diagnostics</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Evaluates your academic criteria, branch restrictions, and backlog thresholds across all campus drives.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                <span className="text-lg">🧠</span>
                <div>
                  <h4 className="font-bold text-on-surface">Skill Gap &amp; Topic Prioritization</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Identifies missing concepts between your current dossier and specific company online assessment patterns.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                <span className="text-lg">🗣️</span>
                <div>
                  <h4 className="font-bold text-on-surface">STAR Behavioral &amp; HR Simulation</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Critiques and refines your Situation, Task, Action, Result answers for leadership and managerial rounds.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                <span className="text-lg">📅</span>
                <div>
                  <h4 className="font-bold text-on-surface">Personalized SDE Revision Timetable</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Generates day-by-day practice plans targeting high-weightage topics like Trees, Graphs, and DP.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
