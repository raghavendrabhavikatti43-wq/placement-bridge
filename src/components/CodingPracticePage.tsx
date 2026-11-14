import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { CodingProblem, NavigationPath } from '../types';
import { CODING_PROBLEMS } from '../data/placementData';
import { filterCodingProblems } from '../server/engines/codingFilters';

interface CodingPracticePageProps {
  solvedIds: string[];
  onMarkSolved: (problemId: string) => void;
  onNavigate: (path: NavigationPath) => void;
}

type SupportedLanguage = 'java' | 'python' | 'cpp' | 'c' | 'javascript';

interface TestResultItem {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  runtimeMs: number;
  stdout?: string;
  stderr?: string;
}

interface ExecutionVerdict {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED';
  passed: boolean;
  totalCases: number;
  passedCases: number;
  compileError?: string | null;
  runtimeError?: string | null;
  testResults: TestResultItem[];
}

const CATEGORIES = [
  'All',
  'Arrays',
  'Strings',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Sorting',
  'Monotonic Stack',
  'Trees',
  'Graphs',
  'Dynamic Programming',
] as const;

interface SkillTrackDef {
  id: string;
  name: string;
  icon: string;
  badge?: string;
  description: string;
  subdomains: string[];
  filter: (prob: CodingProblem) => boolean;
}

const PRACTICE_SKILLS: SkillTrackDef[] = [
  {
    id: 'algorithms',
    name: 'Algorithms',
    icon: 'schema',
    description: 'Dynamic programming, graphs, sorting, searching, recursion and two-pointer paradigms.',
    subdomains: ['All', 'Warmup', 'Arrays', 'Strings', 'Sorting', 'Search', 'Dynamic Programming', 'Graph Theory', 'Greedy', 'Bit Manipulation'],
    filter: (p) => p.topic.includes('Arrays') || p.topic.includes('Sliding') || p.topic.includes('DP') || p.topic.includes('Graph') || p.topic.includes('Two Pointers') || p.topic.includes('Sorting') || p.topic.includes('Warmup') || p.topic.includes('Arithmetic'),
  },
  {
    id: 'data-structures',
    name: 'Data Structures',
    icon: 'lan',
    description: 'Arrays, Linked Lists, Trees, Stacks, Queues, Graphs, and Heaps mastery.',
    subdomains: ['All', 'Arrays', 'Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Heaps', 'Hashing'],
    filter: (p) => p.topic.includes('Arrays') || p.topic.includes('Stack') || p.topic.includes('Tree') || p.topic.includes('Graph') || p.topic.includes('Hashing') || p.topic.includes('Linked List') || p.topic.includes('Warmup'),
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: 'functions',
    description: 'Number theory, combinatorics, modular arithmetic, probability and geometry.',
    subdomains: ['All', 'Warmup', 'Fundamentals', 'Number Theory', 'Combinatorics', 'Geometry'],
    filter: (p) => p.topic.includes('Math') || p.topic.includes('DP') || p.topic.includes('Single Pass') || p.topic.includes('Warmup') || p.topic.includes('Arithmetic'),
  },
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    icon: 'psychology',
    description: 'Search agents, heuristic pathfinding, minimax games, NLP, and bot challenges.',
    subdomains: ['All', 'Bot Building', 'Search', 'Graph Traversal', 'Reinforcement'],
    filter: (p) => p.topic.includes('Graph') || p.topic.includes('AI') || p.topic.includes('Search') || p.topic.includes('Cycle') || p.topic.includes('DP'),
  },
  {
    id: 'c',
    name: 'C',
    icon: 'code',
    badge: 'C',
    description: 'Pointers, memory management, arrays, strings, struct memory layout and systems basics.',
    subdomains: ['All', 'Warmup', 'Arrays & Strings', 'Functions', 'Pointers'],
    filter: (p) => Boolean(p.cCode) || p.topic.includes('Arrays') || p.topic.includes('Warmup'),
  },
  {
    id: 'cpp',
    name: 'C++',
    icon: 'code_blocks',
    badge: 'C++',
    description: 'Modern C++ 20, STL vectors, maps, memory allocators, templates, and algorithms.',
    subdomains: ['All', 'Warmup', 'STL', 'Classes', 'Inheritance', 'Algorithms'],
    filter: (p) => Boolean(p.cppCode),
  },
  {
    id: 'java',
    name: 'Java',
    icon: 'local_cafe',
    badge: 'Java',
    description: 'Core Java 21, OOP principles, Collections framework, Generics, and exception handling.',
    subdomains: ['All', 'Warmup', 'Object Oriented', 'Collections & Generics', 'Data Structures', 'Advanced'],
    filter: (p) => Boolean(p.javaCode),
  },
  {
    id: 'python',
    name: 'Python',
    icon: 'terminal',
    badge: 'Py',
    description: 'Idiomatic Python 3, list comprehensions, lambdas, generators, math, and data handling.',
    subdomains: ['All', 'Warmup', 'Basic Data Types', 'Strings', 'Sets & Dicts', 'Itertools'],
    filter: (p) => Boolean(p.pythonCode),
  },
  {
    id: 'ruby',
    name: 'Ruby',
    icon: 'diamond',
    badge: 'Ruby',
    description: 'Blocks, procs, mixins, symbols, hashes, enumerable methods, and object-oriented elegance.',
    subdomains: ['All', 'Warmup', 'Control Structures', 'Arrays & Hashes', 'Methods', 'Strings'],
    filter: (p) => p.topic.includes('Strings') || p.topic.includes('Arrays') || p.topic.includes('Warmup'),
  },
  {
    id: 'sql',
    name: 'SQL',
    icon: 'database',
    badge: 'SQL',
    description: 'Relational queries, window functions, JOINs, indexing, aggregation, and performance tuning.',
    subdomains: ['All', 'Basic Select', 'Advanced Select', 'Aggregation', 'Basic Join', 'Advanced Join'],
    filter: (p) => p.topic.includes('Select') || p.topic.includes('SQL') || p.topic.includes('Database') || p.topic.includes('Hashing'),
  },
  {
    id: 'react',
    name: 'React',
    icon: 'deployed_code',
    badge: 'React',
    description: 'Component architecture, state, effect hooks, performance optimization, and UI state flows.',
    subdomains: ['All', 'Components', 'State & Hooks', 'Routing', 'Context & Performance'],
    filter: (p) => p.topic.includes('Component') || p.topic.includes('React') || p.topic.includes('Frontend') || p.topic.includes('State'),
  },
];

interface MockInterviewTrack {
  id: string;
  title: string;
  duration: string;
  description: string;
  isLocked: boolean;
}

const MOCK_INTERVIEWS: MockInterviewTrack[] = [
  {
    id: 'tech-screen',
    title: 'Technical Screen',
    duration: '30 mins',
    description: 'Practice a recruiter screening to identify gaps in CS fundamentals, role fit, and interview readiness.',
    isLocked: true,
  },
  {
    id: 'coding-screen',
    title: 'Coding',
    duration: '60 mins',
    description: 'Solve algorithmic and data structure problems designed to test your problem-solving skills.',
    isLocked: true,
  },
  {
    id: 'system-design',
    title: 'System Design',
    duration: '60 mins',
    description: 'Improve your ability to design scalable systems and clearly justify architectural decisions.',
    isLocked: true,
  },
  {
    id: 'ai-fluency',
    title: 'AI Fluency',
    duration: '30 mins',
    description: 'Demonstrate your ability to build with AI and use AI tools to solve problems and improve your workflow.',
    isLocked: true,
  },
];

export const CodingPracticePage: React.FC<CodingPracticePageProps> = ({
  solvedIds,
  onMarkSolved,
  onNavigate,
}) => {
  // Navigation mode: 'list' (dashboard/skills) or 'workspace' (split editor)
  const [viewMode, setViewMode] = useState<'list' | 'workspace'>('list');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSubdomain, setSelectedSubdomain] = useState<string>('All');

  // HackerRank sidebar filters
  const [sidebarStatus, setSidebarStatus] = useState<{ solved: boolean; unsolved: boolean }>({ solved: false, unsolved: false });
  const [sidebarDifficulties, setSidebarDifficulties] = useState<string[]>([]);
  const [sidebarSubdomains, setSidebarSubdomains] = useState<string[]>([]);

  // Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Solved' | 'Unsolved' | 'Attempted' | 'Bookmarked'>('All');

  // Workspace State
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [language, setLanguage] = useState<SupportedLanguage>('java');
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [attemptedIds, setAttemptedIds] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(45 * 60);
  const [isPaused, setIsPaused] = useState(false);

  // Workspace Tabs
  const [workspaceLeftTab, setWorkspaceLeftTab] = useState<'description' | 'hints' | 'submissions'>('description');
  const [workspaceConsoleTab, setWorkspaceConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState<number>(0);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');

  // Execution & Feedback State
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<ExecutionVerdict | null>(null);
  const [submissionSuccessModal, setSubmissionSuccessModal] = useState<boolean>(false);

  // Active problem
  const problem: CodingProblem = CODING_PROBLEMS[activeIndex] || CODING_PROBLEMS[0];

  // Timer Effect
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

  // Get boilerplate starter code for the problem and language
  const getStarterCode = (prob: CodingProblem, lang: SupportedLanguage): string => {
    switch (lang) {
      case 'java':
        return prob.javaCode;
      case 'python':
        return prob.pythonCode;
      case 'cpp':
        return prob.cppCode;
      case 'c':
        return prob.cCode || `// Starter code for ${prob.title}\nint solution() {\n    // Write your solution here\n    return 0;\n}`;
      case 'javascript':
        return prob.jsCode || `/**\n * @return {any}\n */\nvar solution = function() {\n    // Write your solution here\n    \n};`;
      default:
        return prob.javaCode;
    }
  };

  const draftKey = `${problem.id}_${language}`;
  const activeCode = codeDrafts[draftKey] ?? getStarterCode(problem, language);

  const handleCodeChange = (val: string) => {
    setCodeDrafts((prev) => ({ ...prev, [draftKey]: val }));
    if (!attemptedIds.includes(problem.id)) {
      setAttemptedIds((prev) => [...prev, problem.id]);
    }
  };

  const handleResetCode = () => {
    if (window.confirm('Reset code to starter boilerplate? Your current changes for this language will be discarded.')) {
      setCodeDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setVerdict(null);
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  // Filtered problem list for Dashboard
  const filteredProblems = useMemo(() => {
    return filterCodingProblems(CODING_PROBLEMS, {
      difficulty: selectedDifficulty,
      category: selectedCategory,
      status: selectedStatusFilter,
      searchQuery,
      solvedIds,
      attemptedIds,
      bookmarkedIds: bookmarks,
    });
  }, [selectedDifficulty, selectedCategory, selectedStatusFilter, searchQuery, solvedIds, attemptedIds, bookmarks]);

  const currentSkill = useMemo(() => {
    return PRACTICE_SKILLS.find((s) => s.id === selectedSkillId) || null;
  }, [selectedSkillId]);

  const skillChallenges = useMemo(() => {
    if (!currentSkill) return [];
    return CODING_PROBLEMS.filter((p) => {
      // 1. Skill filter
      if (!currentSkill.filter(p)) return false;

      // 2. Subdomain tab filter
      if (selectedSubdomain !== 'All') {
        const matchesSub =
          p.topic.toLowerCase().includes(selectedSubdomain.toLowerCase()) ||
          p.badge.toLowerCase().includes(selectedSubdomain.toLowerCase());
        if (!matchesSub) return false;
      }

      // 3. Sidebar status
      const isSolved = solvedIds.includes(p.id);
      if (sidebarStatus.solved && !sidebarStatus.unsolved && !isSolved) return false;
      if (sidebarStatus.unsolved && !sidebarStatus.solved && isSolved) return false;

      // 4. Sidebar difficulty
      if (sidebarDifficulties.length > 0 && !sidebarDifficulties.includes(p.difficulty)) return false;

      // 5. Sidebar subdomains
      if (sidebarSubdomains.length > 0) {
        const matchesSubdomain = sidebarSubdomains.some(
          (sub) =>
            p.topic.toLowerCase().includes(sub.toLowerCase()) ||
            p.badge.toLowerCase().includes(sub.toLowerCase())
        );
        if (!matchesSubdomain) return false;
      }

      return true;
    });
  }, [currentSkill, selectedSubdomain, sidebarStatus, sidebarDifficulties, sidebarSubdomains, solvedIds]);

  // Statistics
  const totalCount = CODING_PROBLEMS.length;
  const solvedCount = solvedIds.filter((id) => CODING_PROBLEMS.some((p) => p.id === id)).length;
  const attemptedCount = attemptedIds.length;
  const accuracyPct = attemptedCount > 0 ? Math.round((solvedCount / Math.max(solvedCount, attemptedCount)) * 100) : 100;

  const easyTotal = CODING_PROBLEMS.filter((p) => p.difficulty === 'Easy').length;
  const easySolved = CODING_PROBLEMS.filter((p) => p.difficulty === 'Easy' && solvedIds.includes(p.id)).length;
  const medTotal = CODING_PROBLEMS.filter((p) => p.difficulty === 'Medium').length;
  const medSolved = CODING_PROBLEMS.filter((p) => p.difficulty === 'Medium' && solvedIds.includes(p.id)).length;
  const hardTotal = CODING_PROBLEMS.filter((p) => p.difficulty === 'Hard').length;
  const hardSolved = CODING_PROBLEMS.filter((p) => p.difficulty === 'Hard' && solvedIds.includes(p.id)).length;

  // Language mapping for Monaco
  const monacoLanguage = language === 'cpp' || language === 'c' ? 'cpp' : language;

  // Helper for fast local syntax validation
  const checkClientSyntax = (code: string, lang: SupportedLanguage): string | null => {
    const trimmed = code.trim();
    if (trimmed.length < 10) {
      return 'Code is empty or too short to compile.';
    }

    // Check for broken syntax like `classSolution` without a space
    if (/\bclass[A-Za-z0-9_]+/i.test(code) && !/\bclass\s+[A-Za-z0-9_]+/i.test(code)) {
      const m = code.match(/\bclass([A-Za-z0-9_]+)/i);
      return `Compilation Error: Missing space between keyword 'class' and '${m ? m[1] : 'Solution'}'.\nLine 1: error: class, interface, enum, or record expected\n${m ? m[0] : 'classSolution'} {\n^`;
    }
    if (/\bdef[A-Za-z0-9_]+/i.test(code) && !/\bdef\s+[A-Za-z0-9_]+/i.test(code)) {
      const m = code.match(/\bdef([A-Za-z0-9_]+)/i);
      return `SyntaxError: invalid syntax. Missing space between keyword 'def' and '${m ? m[1] : 'function'}'.`;
    }

    // Check brace balance in C-like languages
    if (lang === 'java' || lang === 'cpp' || lang === 'c' || lang === 'javascript') {
      let balance = 0;
      for (const ch of code) {
        if (ch === '{') balance++;
        if (ch === '}') balance--;
      }
      if (balance !== 0) {
        return `Compilation Error: Unbalanced braces detected (difference: ${balance}).`;
      }
    }

    return null;
  };

  // Run Code
  const handleRun = async () => {
    setIsRunning(true);
    setWorkspaceConsoleTab('result');

    // 1. Client-side quick check
    const clientErr = checkClientSyntax(activeCode, language);
    if (clientErr) {
      setTimeout(() => {
        setIsRunning(false);
        setVerdict({
          status: 'COMPILATION_ERROR',
          passed: false,
          totalCases: 1,
          passedCases: 0,
          compileError: clientErr,
          testResults: [],
        });
      }, 350);
      return;
    }

    try {
      const res = await fetch(`/api/v1/coding/problems/${problem.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageKey: language,
          sourceCode: activeCode,
          customInput: useCustomInput ? customInputValue : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVerdict(data.data);
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.data && typeof errData.data === 'object' && errData.data.status) {
          setVerdict(errData.data);
        } else {
          const isStarter = activeCode.trim() === getStarterCode(problem, language).trim();
          setVerdict({
            status: isStarter ? 'WRONG_ANSWER' : 'RUNTIME_ERROR',
            passed: false,
            totalCases: 1,
            passedCases: 0,
            compileError: null,
            runtimeError: errData?.message || (isStarter ? 'Starter boilerplate code does not solve the problem.' : 'Execution failed.'),
            testResults: [
              {
                testCaseId: 'case-1',
                input: useCustomInput && customInputValue ? customInputValue : problem.sampleInput,
                expectedOutput: problem.sampleOutput,
                actualOutput: isStarter ? '-1' : 'Execution Error',
                passed: false,
                runtimeMs: 14,
              },
            ],
          });
        }
      }
    } catch (err: any) {
      const isStarter = activeCode.trim() === getStarterCode(problem, language).trim();
      setVerdict({
        status: isStarter ? 'WRONG_ANSWER' : 'RUNTIME_ERROR',
        passed: false,
        totalCases: 1,
        passedCases: 0,
        compileError: null,
        runtimeError: isStarter ? 'Starter boilerplate code does not solve the problem.' : (err?.message || 'Failed to reach execution service.'),
        testResults: [
          {
            testCaseId: 'case-1',
            input: useCustomInput && customInputValue ? customInputValue : problem.sampleInput,
            expectedOutput: problem.sampleOutput,
            actualOutput: isStarter ? '-1' : 'No Output',
            passed: false,
            runtimeMs: 16,
          },
        ],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Submit Code
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setWorkspaceConsoleTab('result');

    // 1. Client-side quick check
    const clientErr = checkClientSyntax(activeCode, language);
    if (clientErr) {
      setTimeout(() => {
        setIsSubmitting(false);
        setVerdict({
          status: 'COMPILATION_ERROR',
          passed: false,
          totalCases: problem.testCasesCount,
          passedCases: 0,
          compileError: clientErr,
          testResults: [],
        });
      }, 400);
      return;
    }

    try {
      const res = await fetch(`/api/v1/coding/problems/${problem.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageKey: language,
          sourceCode: activeCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const v: ExecutionVerdict = data.data?.verdict || {
          status: data.data?.submission?.status === 'PASSED' ? 'ACCEPTED' : 'WRONG_ANSWER',
          passed: data.data?.submission?.status === 'PASSED',
          totalCases: problem.testCasesCount,
          passedCases: data.data?.submission?.testsPassed || 0,
          testResults: [],
        };
        setVerdict(v);
        if (v.passed && v.status === 'ACCEPTED') {
          onMarkSolved(problem.id);
          setSubmissionSuccessModal(true);
        }
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.data && typeof errData.data === 'object' && errData.data.status) {
          setVerdict(errData.data);
        } else {
          const isStarter = activeCode.trim() === getStarterCode(problem, language).trim();
          setVerdict({
            status: isStarter ? 'WRONG_ANSWER' : 'RUNTIME_ERROR',
            passed: false,
            totalCases: problem.testCasesCount,
            passedCases: 0,
            compileError: null,
            runtimeError: errData?.message || (isStarter ? 'Starter template submitted without algorithm implementation.' : 'Submission verification failed.'),
            testResults: [
              {
                testCaseId: 'case-1',
                input: problem.sampleInput,
                expectedOutput: problem.sampleOutput,
                actualOutput: isStarter ? '-1' : 'Error',
                passed: false,
                runtimeMs: 18,
              },
            ],
          });
        }
      }
    } catch (err: any) {
      const isStarter = activeCode.trim() === getStarterCode(problem, language).trim();
      setVerdict({
        status: isStarter ? 'WRONG_ANSWER' : 'RUNTIME_ERROR',
        passed: false,
        totalCases: problem.testCasesCount,
        passedCases: 0,
        compileError: null,
        runtimeError: isStarter ? 'Starter template submitted without algorithm implementation.' : (err?.message || 'Network error during submission.'),
        testResults: [
          {
            testCaseId: 'case-1',
            input: problem.sampleInput,
            expectedOutput: problem.sampleOutput,
            actualOutput: isStarter ? '-1' : 'Error',
            passed: false,
            runtimeMs: 18,
          },
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentSolved = solvedIds.includes(problem.id);

  // --------------------------------------------------------------------------
  // RENDER: DASHBOARD VIEW (Problems List)
  // --------------------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div id="coding-practice-dashboard" className="space-y-6 animate-in fade-in duration-200">
        {/* ============================================================== */}
        {/* VIEW A: DEDICATED SKILL CHALLENGE ENVIRONMENT (Images 2 & 3)   */}
        {/* ============================================================== */}
        {currentSkill ? (
          <div className="space-y-6">
            {/* Top Breadcrumb & Points Banner */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkillId(null);
                      setSelectedSubdomain('All');
                    }}
                    className="hover:underline flex items-center gap-1 font-bold text-outline hover:text-on-surface"
                  >
                    <span>Prepare</span>
                  </button>
                  <span className="text-outline">›</span>
                  <span className="text-on-surface font-extrabold">{currentSkill.name}</span>
                </div>
                <h1 className="text-2xl font-black text-on-surface tracking-tight">{currentSkill.name}</h1>
                <p className="text-xs text-on-surface-variant max-w-xl">{currentSkill.description}</p>
              </div>

              {/* HackerRank Points & Star Banner */}
              <div className="flex items-center gap-4 bg-surface-container-low/50 px-4 py-2.5 rounded-xl border border-surface-container-high/40 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    30 more points to get your first star!
                  </div>
                  <div className="text-[11px] text-outline font-mono">
                    Rank: <strong className="text-on-surface font-sans">6444280</strong> | Points: <strong className="text-on-surface font-sans">{solvedCount * 10}/30</strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-500 shrink-0">
                  <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
                </div>
              </div>
            </div>

            {/* Subdomain Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {currentSkill.subdomains.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubdomain(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    selectedSubdomain === sub
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-surface-container-low'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Main 2-Column Grid (Challenges List + Filter Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Challenge Cards (8 Cols) */}
              <div className="lg:col-span-8 space-y-4">
                {skillChallenges.length === 0 ? (
                  <div className="bg-surface-container-lowest p-12 rounded-2xl border border-surface-container-low text-center space-y-3">
                    <span className="material-symbols-outlined text-4xl text-outline/50">inbox</span>
                    <h3 className="font-bold text-on-surface">No challenges found</h3>
                    <p className="text-xs text-outline max-w-sm mx-auto">
                      No challenges in {currentSkill.name} match your selected filters. Try unchecking some filters or selecting &quot;All&quot;.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubdomain('All');
                        setSidebarStatus({ solved: false, unsolved: false });
                        setSidebarDifficulties([]);
                        setSidebarSubdomains([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-bold"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  skillChallenges.map((prob) => {
                    const isSolved = solvedIds.includes(prob.id);
                    const globalIdx = CODING_PROBLEMS.findIndex((p) => p.id === prob.id);

                    return (
                      <div
                        key={prob.id}
                        className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-low hover:border-emerald-500/40 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3
                            onClick={() => {
                              setActiveIndex(globalIdx !== -1 ? globalIdx : 0);
                              setViewMode('workspace');
                              setVerdict(null);
                            }}
                            className="text-lg font-extrabold text-on-surface hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            {prob.title}
                          </h3>

                          <div className="flex items-center gap-2 text-xs text-outline flex-wrap font-medium">
                            <span
                              className={`font-bold ${
                                prob.difficulty === 'Easy'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : prob.difficulty === 'Medium'
                                  ? 'text-amber-500 dark:text-amber-400'
                                  : 'text-rose-500 dark:text-rose-400'
                              }`}
                            >
                              {prob.difficulty}
                            </span>
                            <span>•</span>
                            <span>Problem Solving (Basic)</span>
                            <span>•</span>
                            <span>Max Score: 10</span>
                            <span>•</span>
                            <span>
                              Success Rate: {prob.difficulty === 'Easy' ? '97.56%' : prob.difficulty === 'Medium' ? '74.20%' : '48.15%'}
                            </span>
                            {isSolved && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  Solved
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
                            {prob.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => toggleBookmark(prob.id)}
                            className={`p-2 rounded-xl transition-colors ${
                              bookmarks.includes(prob.id)
                                ? 'text-amber-400 bg-amber-400/10'
                                : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
                            }`}
                            title="Bookmark challenge"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {bookmarks.includes(prob.id) ? 'star' : 'star_border'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveIndex(globalIdx !== -1 ? globalIdx : 0);
                              setViewMode('workspace');
                              setVerdict(null);
                            }}
                            className="px-5 py-2.5 rounded-lg bg-[#007a3d] hover:bg-[#006030] text-white font-bold text-xs tracking-wide transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <span>Solve Challenge</span>
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: HackerRank Filter Sidebar (4 Cols) */}
              <div className="lg:col-span-4 space-y-6 bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low text-xs sticky top-4">
                {/* STATUS */}
                <div className="space-y-2.5">
                  <h4 className="font-bold uppercase tracking-wider text-outline text-[11px]">STATUS</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-on-surface">
                      <input
                        type="checkbox"
                        checked={sidebarStatus.solved}
                        onChange={(e) => setSidebarStatus((prev) => ({ ...prev, solved: e.target.checked }))}
                        className="rounded border-surface-container-high text-emerald-600 focus:ring-0"
                      />
                      <span>Solved</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer text-on-surface">
                      <input
                        type="checkbox"
                        checked={sidebarStatus.unsolved}
                        onChange={(e) => setSidebarStatus((prev) => ({ ...prev, unsolved: e.target.checked }))}
                        className="rounded border-surface-container-high text-emerald-600 focus:ring-0"
                      />
                      <span>Unsolved</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-surface-container-low pt-4 space-y-2.5">
                  <h4 className="font-bold uppercase tracking-wider text-outline text-[11px]">DIFFICULTY</h4>
                  <div className="space-y-2">
                    {['Easy', 'Medium', 'Hard'].map((diff) => (
                      <label key={diff} className="flex items-center gap-2.5 cursor-pointer text-on-surface">
                        <input
                          type="checkbox"
                          checked={sidebarDifficulties.includes(diff)}
                          onChange={(e) => {
                            if (e.target.checked) setSidebarDifficulties((prev) => [...prev, diff]);
                            else setSidebarDifficulties((prev) => prev.filter((d) => d !== diff));
                          }}
                          className="rounded border-surface-container-high text-emerald-600 focus:ring-0"
                        />
                        <span>{diff}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-surface-container-low pt-4 space-y-2.5">
                  <h4 className="font-bold uppercase tracking-wider text-outline text-[11px]">SUBDOMAINS</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {currentSkill.subdomains
                      .filter((s) => s !== 'All')
                      .map((sub) => (
                        <label key={sub} className="flex items-center gap-2.5 cursor-pointer text-on-surface">
                          <input
                            type="checkbox"
                            checked={sidebarSubdomains.includes(sub)}
                            onChange={(e) => {
                              if (e.target.checked) setSidebarSubdomains((prev) => [...prev, sub]);
                              else setSidebarSubdomains((prev) => prev.filter((s) => s !== sub));
                            }}
                            className="rounded border-surface-container-high text-emerald-600 focus:ring-0"
                          />
                          <span>{sub}</span>
                        </label>
                      ))}
                  </div>
                </div>

                {/* Back to all skills button */}
                <div className="border-t border-surface-container-low pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkillId(null);
                      setSelectedSubdomain('All');
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-surface-container-high hover:bg-surface-container-low text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                    <span>View All Practice Skills</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: PRACTICE SKILLS GRID & MOCK INTERVIEWS (Images 1 & 4)  */
          /* ============================================================== */
          <div className="space-y-8">
            {/* Top AI-Powered Mock Interviews Section (Image 4) */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-low space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-on-surface tracking-tight">AI-powered Mock Interviews</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      No Mock Interview Credits Available
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Ace your next job interview by practicing with AI-powered mock interviews.{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('interview-prep')}
                      className="text-secondary font-bold hover:underline ml-1"
                    >
                      Know More
                    </button>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="h-2 w-2 rounded-full bg-surface-container-high" />
                  <span className="h-2 w-2 rounded-full bg-surface-container-high" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {MOCK_INTERVIEWS.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => onNavigate('interview-prep')}
                    className="p-4 rounded-xl border border-surface-container-low bg-surface-container-low/30 hover:border-secondary/40 hover:bg-surface-container-low transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                  >
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-sm text-on-surface group-hover:text-secondary transition-colors">
                        {track.title}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-3">
                        {track.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-container-low/60 text-[11px] text-outline">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>{track.duration}</span>
                      </span>

                      <span className="p-1 rounded bg-surface-container-high/40 text-outline">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Practice Skills 11 Blocks Grid (Image 1) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-on-surface tracking-tight">Practice Skills</h2>
                  <p className="text-xs text-outline mt-0.5">Select any skill block below to explore curated challenges, test suites, and subdomains.</p>
                </div>
                <span className="text-xs font-semibold text-secondary">
                  {PRACTICE_SKILLS.length} Skill Tracks
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PRACTICE_SKILLS.map((skill) => {
                  const matchCount = CODING_PROBLEMS.filter(skill.filter).length;
                  const solvedInSkill = CODING_PROBLEMS.filter(skill.filter).filter((p) => solvedIds.includes(p.id)).length;
                  return (
                    <div
                      key={skill.id}
                      onClick={() => {
                        setSelectedSkillId(skill.id);
                        setSelectedSubdomain('All');
                        setSidebarDifficulties([]);
                        setSidebarSubdomains([]);
                      }}
                      className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-low hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-surface-container-low/60 dark:bg-surface-container flex items-center justify-center text-on-surface group-hover:text-emerald-600 group-hover:scale-105 transition-all shrink-0">
                          {skill.badge ? (
                            <span className="font-black text-xs tracking-tighter text-secondary">
                              {skill.badge}
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[22px]">
                              {skill.icon}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-on-surface group-hover:text-emerald-600 transition-colors truncate">
                            {skill.name}
                          </h3>
                          <p className="text-[11px] text-outline truncate max-w-[200px]">
                            {matchCount} Challenges • {solvedInSkill} Solved
                          </p>
                        </div>
                      </div>

                      <span className="material-symbols-outlined text-outline group-hover:text-emerald-600 group-hover:translate-x-1 transition-all text-[20px]">
                        chevron_right
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Access LeetCode Table Strip */}
            <div className="space-y-4 pt-4 border-t border-surface-container-low">
              {/* Category and Search Strip */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-black text-sm text-on-surface uppercase tracking-wider">All Problems Directory</h3>
                {/* Search */}
                <div className="relative min-w-[240px]">
                  <span className="material-symbols-outlined text-outline absolute left-3 top-2.5 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search all problems..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface pl-9 pr-3 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-secondary border border-transparent focus:border-secondary"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-low overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-surface-container-low text-[11px] font-bold text-outline uppercase tracking-wider bg-surface-container-low/40">
                      <th className="py-3 px-4 w-12 text-center">Status</th>
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4 w-28">Difficulty</th>
                      <th className="py-3 px-4 w-28">Acceptance</th>
                      <th className="py-3 px-4 w-44">Topic</th>
                      <th className="py-3 px-4 w-24 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low text-xs">
                    {filteredProblems.map((p, idx) => {
                      const isSolved = solvedIds.includes(p.id);
                      const isAttempted = attemptedIds.includes(p.id);
                      const globalIdx = CODING_PROBLEMS.findIndex((orig) => orig.id === p.id);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setActiveIndex(globalIdx !== -1 ? globalIdx : 0);
                            setViewMode('workspace');
                            setVerdict(null);
                          }}
                          className="hover:bg-surface-container-low/60 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 text-center">
                            {isSolved ? (
                              <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                            ) : isAttempted ? (
                              <span className="material-symbols-outlined text-amber-500 text-base">timelapse</span>
                            ) : (
                              <span className="text-outline/40 font-mono text-sm">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-on-surface group-hover:text-secondary transition-colors">
                                {idx + 1}. {p.title}
                              </span>
                              <span className="text-[10px] text-outline bg-surface-container-low px-1.5 py-0.5 rounded">
                                {p.badge}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                p.difficulty === 'Easy'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : p.difficulty === 'Medium'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {p.difficulty}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-outline">
                            {p.difficulty === 'Easy' ? '97.5%' : p.difficulty === 'Medium' ? '74.2%' : '48.1%'}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant font-medium">{p.topic}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveIndex(globalIdx !== -1 ? globalIdx : 0);
                                setViewMode('workspace');
                                setVerdict(null);
                              }}
                              className="px-2.5 py-1 rounded bg-[#007a3d] hover:bg-[#006030] text-white text-xs font-bold transition-all shadow-xs"
                            >
                              Solve
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: WORKSPACE VIEW (LeetCode-Style Split Screen)
  // --------------------------------------------------------------------------
  return (
    <div id="coding-practice-workspace" className="space-y-3 animate-in fade-in duration-200">
      {/* Top Workspace Header */}
      <div className="bg-surface-container-lowest px-4 py-2.5 rounded-xl border border-surface-container-low flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-bold text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span>{currentSkill ? `Back to ${currentSkill.name}` : 'Practice Skills'}</span>
          </button>

          <div className="h-4 w-px bg-surface-container-high" />

          {/* Prev / Next Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveIndex((prev) => (prev - 1 + CODING_PROBLEMS.length) % CODING_PROBLEMS.length);
                setVerdict(null);
              }}
              title="Previous Problem"
              className="p-1 rounded hover:bg-surface-container-low text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-on-surface font-mono">
              {activeIndex + 1} / {CODING_PROBLEMS.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveIndex((prev) => (prev + 1) % CODING_PROBLEMS.length);
                setVerdict(null);
              }}
              title="Next Problem"
              className="p-1 rounded hover:bg-surface-container-low text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <h2 className="text-xs sm:text-sm font-bold text-on-surface truncate max-w-[280px] sm:max-w-md">
            {problem.title}
          </h2>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              problem.difficulty === 'Easy'
                ? 'bg-emerald-500/10 text-emerald-600'
                : problem.difficulty === 'Medium'
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-rose-500/10 text-rose-600'
            }`}
          >
            {problem.difficulty}
          </span>
        </div>

        {/* Right Header: Timer, Solved Status, Bookmark */}
        <div className="flex items-center gap-3">
          {isCurrentSolved && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Solved
            </span>
          )}

          <button
            type="button"
            onClick={() => toggleBookmark(problem.id)}
            title={bookmarks.includes(problem.id) ? 'Saved' : 'Bookmark problem'}
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              {bookmarks.includes(problem.id) ? 'bookmark_added' : 'bookmark'}
            </span>
          </button>

          <div className="h-4 w-px bg-surface-container-high" />

          {/* Session Timer */}
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-on-surface">
            <span className="material-symbols-outlined text-[15px] text-outline">timer</span>
            <span>{formatTimer(timerSeconds)}</span>
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="text-[10px] text-secondary hover:underline ml-1"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Screen Workspace: Left (Problem Details) + Right (Code Editor & Console) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* ================================================================== */}
        {/* LEFT PANEL: Problem Details (5 Cols) */}
        {/* ================================================================== */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-surface-container-low flex flex-col h-[740px] overflow-hidden">
          {/* Left Tabs */}
          <div className="flex items-center border-b border-surface-container-low px-3 pt-2 gap-2 bg-surface-container-low/30 shrink-0">
            <button
              type="button"
              onClick={() => setWorkspaceLeftTab('description')}
              className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 ${
                workspaceLeftTab === 'description'
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-outline hover:text-on-surface'
              }`}
            >
              Description
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceLeftTab('hints')}
              className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 ${
                workspaceLeftTab === 'hints'
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-outline hover:text-on-surface'
              }`}
            >
              Editorial & Hints
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceLeftTab('submissions')}
              className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 ${
                workspaceLeftTab === 'submissions'
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-outline hover:text-on-surface'
              }`}
            >
              Submissions
            </button>
          </div>

          {/* Left Tab Content */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
            {workspaceLeftTab === 'description' && (
              <>
                <div>
                  <span className="text-[11px] text-outline block">{problem.badge}</span>
                  <h1 className="text-lg font-black text-on-surface">{problem.title}</h1>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      problem.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : problem.difficulty === 'Medium'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {problem.difficulty}
                  </span>
                  <span className="text-outline text-[11px] bg-surface-container-low px-2 py-0.5 rounded font-medium">
                    {problem.topic}
                  </span>
                </div>

                <p className="text-on-surface-variant leading-relaxed text-xs">
                  {problem.description}
                </p>

                {/* Example 1 */}
                <div className="space-y-2">
                  <span className="font-bold text-on-surface block">Example 1:</span>
                  <div className="bg-surface-container-low p-3 rounded-xl font-mono text-[11px] space-y-1.5 border border-surface-container-high/40">
                    <div>
                      <span className="text-outline block font-sans text-[10px]">Input:</span>
                      <code className="text-on-surface">{problem.sampleInput}</code>
                    </div>
                    <div>
                      <span className="text-outline block font-sans text-[10px]">Output:</span>
                      <code className="text-secondary font-bold">{problem.sampleOutput}</code>
                    </div>
                    {problem.explanation && (
                      <div>
                        <span className="text-outline block font-sans text-[10px]">Explanation:</span>
                        <span className="font-sans text-on-surface-variant">{problem.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Constraints */}
                <div className="space-y-1.5 pt-2 border-t border-surface-container-low">
                  <span className="font-bold text-on-surface block">Constraints:</span>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-on-surface-variant">
                    {problem.constraints.split(',').map((c, i) => (
                      <li key={i}>{c.trim()}</li>
                    ))}
                  </ul>
                </div>

                {/* Expected Complexity */}
                <div className="space-y-1 pt-2 border-t border-surface-container-low">
                  <span className="font-bold text-on-surface block">Expected Complexity:</span>
                  <span className="font-mono text-secondary font-semibold">{problem.complexity}</span>
                </div>
              </>
            )}

            {workspaceLeftTab === 'hints' && (
              <div className="space-y-3">
                <h3 className="font-bold text-on-surface">Step-by-Step Problem Hints</h3>
                {problem.hints && problem.hints.length > 0 ? (
                  problem.hints.map((hint, idx) => (
                    <details
                      key={idx}
                      className="group bg-surface-container-low p-3 rounded-xl border border-surface-container-high/40"
                    >
                      <summary className="font-semibold text-secondary cursor-pointer list-none flex items-center justify-between">
                        <span>Hint {idx + 1}</span>
                        <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">
                          expand_more
                        </span>
                      </summary>
                      <p className="mt-2 text-on-surface-variant leading-relaxed text-[11px]">
                        {hint}
                      </p>
                    </details>
                  ))
                ) : (
                  <p className="text-outline text-xs">No hints available for this problem yet.</p>
                )}
              </div>
            )}

            {workspaceLeftTab === 'submissions' && (
              <div className="space-y-3">
                <h3 className="font-bold text-on-surface">Submission History</h3>
                {isCurrentSolved ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Accepted
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      You have successfully solved this problem in Placement Bridge!
                    </p>
                  </div>
                ) : (
                  <p className="text-outline text-xs">No accepted submissions recorded yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* RIGHT PANEL: Monaco Code Editor + Bottom Testcase Console (7 Cols) */}
        {/* ================================================================== */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-surface-container-low flex flex-col h-[740px] overflow-hidden">
          {/* Top Editor Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-container-low bg-surface-container-low/30 shrink-0">
            {/* Language Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-outline font-semibold mr-1">Language:</span>
              {(['java', 'python', 'cpp', 'c', 'javascript'] as SupportedLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setLanguage(lang);
                    setVerdict(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    language === lang
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {lang === 'java'
                    ? 'Java'
                    : lang === 'python'
                    ? 'Python'
                    : lang === 'cpp'
                    ? 'C++'
                    : lang === 'c'
                    ? 'C'
                    : 'JavaScript'}
                </button>
              ))}
            </div>

            {/* Reset Code Button */}
            <button
              type="button"
              onClick={handleResetCode}
              title="Reset code to clean starter boilerplate"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
              <span>Reset Code</span>
            </button>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 bg-[#1e1e1e] overflow-hidden relative min-h-[350px]">
            <Editor
              height="100%"
              language={monacoLanguage}
              theme="vs-dark"
              value={activeCode}
              onChange={(val) => handleCodeChange(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                lineNumbers: 'on',
                bracketPairColorization: { enabled: true },
                autoClosingBrackets: 'always',
                formatOnPaste: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Bottom Console Tabs (Testcase | Test Result) */}
          <div className="h-[250px] border-t border-surface-container-low flex flex-col bg-surface-container-lowest shrink-0">
            {/* Console Tab Headers */}
            <div className="flex items-center justify-between px-3 pt-2 border-b border-surface-container-low bg-surface-container-low/20 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceConsoleTab('testcase')}
                  className={`pb-1.5 px-2.5 text-xs font-bold transition-all border-b-2 ${
                    workspaceConsoleTab === 'testcase'
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-outline hover:text-on-surface'
                  }`}
                >
                  Testcase
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceConsoleTab('result')}
                  className={`pb-1.5 px-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                    workspaceConsoleTab === 'result'
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-outline hover:text-on-surface'
                  }`}
                >
                  <span>Test Result</span>
                  {verdict && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        verdict.status === 'ACCEPTED'
                          ? 'bg-emerald-500'
                          : verdict.status === 'COMPILATION_ERROR'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                      }`}
                    />
                  )}
                </button>
              </div>

              {workspaceConsoleTab === 'testcase' && (
                <label className="flex items-center gap-1.5 text-[11px] text-outline cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomInput}
                    onChange={(e) => setUseCustomInput(e.target.checked)}
                    className="rounded text-secondary focus:ring-0"
                  />
                  <span>Custom Testcase</span>
                </label>
              )}
            </div>

            {/* Console Body */}
            <div className="p-3 overflow-y-auto flex-1 font-mono text-xs">
              {workspaceConsoleTab === 'testcase' ? (
                useCustomInput ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-outline block font-sans font-semibold">
                      Enter Custom Testcase Input:
                    </span>
                    <textarea
                      value={customInputValue}
                      onChange={(e) => setCustomInputValue(e.target.value)}
                      placeholder={problem.sampleInput}
                      className="w-full h-24 bg-surface-container-low p-2 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-secondary border border-surface-container-high"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTestCaseIdx(0)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          activeTestCaseIdx === 0
                            ? 'bg-surface-container-high text-on-surface'
                            : 'bg-surface-container-low text-outline hover:text-on-surface'
                        }`}
                      >
                        Case 1
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-outline block font-sans">Input:</span>
                      <div className="bg-surface-container-low p-2 rounded-lg text-on-surface break-words">
                        {problem.sampleInput}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Tab 2: Test Result */
                <div>
                  {!verdict ? (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-outline text-xs font-sans">
                      <span className="material-symbols-outlined text-2xl mb-1 text-outline/50">play_circle</span>
                      <span>Click &quot;Run&quot; or &quot;Submit&quot; to compile and execute your code.</span>
                    </div>
                  ) : verdict.status === 'COMPILATION_ERROR' ? (
                    /* COMPILATION ERROR BANNER */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-500 font-bold font-sans">
                        <span className="material-symbols-outlined text-lg">error</span>
                        <span>Compilation Error</span>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-700 dark:text-rose-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                        {verdict.compileError || 'Syntax or compiler error detected in your solution.'}
                      </div>
                    </div>
                  ) : verdict.status === 'ACCEPTED' ? (
                    /* ACCEPTED BANNER */
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold font-sans text-sm">
                          <span className="material-symbols-outlined text-xl">check_circle</span>
                          <span>Accepted</span>
                        </div>
                        <span className="text-[11px] text-outline font-mono">
                          Runtime: {verdict.testResults[0]?.runtimeMs ?? 14} ms
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] text-outline block font-sans">Input:</span>
                        <div className="bg-surface-container-low p-2 rounded-lg text-on-surface">
                          {verdict.testResults[0]?.input || problem.sampleInput}
                        </div>

                        <span className="text-[10px] text-outline block font-sans">Output:</span>
                        <div className="bg-surface-container-low p-2 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold">
                          {verdict.testResults[0]?.actualOutput || problem.sampleOutput}
                        </div>

                        <span className="text-[10px] text-outline block font-sans">Expected:</span>
                        <div className="bg-surface-container-low p-2 rounded-lg text-secondary">
                          {problem.sampleOutput}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* WRONG ANSWER / RUNTIME ERROR */
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-500 font-bold font-sans text-sm">
                          <span className="material-symbols-outlined text-xl">cancel</span>
                          <span>{verdict.status === 'RUNTIME_ERROR' ? 'Runtime Error' : 'Wrong Answer'}</span>
                        </div>
                        <span className="text-[11px] text-outline font-mono">
                          {verdict.passedCases} / {verdict.totalCases} Cases Passed
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] text-outline block font-sans">Your Output:</span>
                        <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-rose-600 dark:text-rose-400">
                          {verdict.testResults[0]?.actualOutput || 'Empty or mismatching return value'}
                        </div>

                        <span className="text-[10px] text-outline block font-sans">Expected Output:</span>
                        <div className="bg-surface-container-low p-2 rounded-lg text-secondary">
                          {problem.sampleOutput}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Console Actions (Run & Submit Buttons) */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-surface-container-low bg-surface-container-low/20 shrink-0">
              <span className="text-[11px] text-outline">
                {problem.testCasesCount} Public Test Suites
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning || isSubmitting}
                  className="px-4 py-1.5 rounded-xl border border-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isRunning ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                      <span>Run</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isRunning || isSubmitting}
                  className="px-5 py-1.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[15px]">send</span>
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Success Modal */}
      {submissionSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest max-w-md w-full p-6 rounded-2xl border border-surface-container-low shadow-xl space-y-4 text-center">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">emoji_events</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-on-surface">Solution Accepted!</h3>
              <p className="text-xs text-on-surface-variant">
                Congratulations! You successfully solved <strong className="text-on-surface">{problem.title}</strong>.
              </p>
            </div>

            <div className="bg-surface-container-low p-3 rounded-xl flex justify-around text-xs font-mono">
              <div>
                <span className="text-[10px] text-outline block font-sans">Runtime</span>
                <span className="font-bold text-secondary">{verdict?.testResults[0]?.runtimeMs ?? 14} ms</span>
              </div>
              <div className="h-6 w-px bg-surface-container-high self-center" />
              <div>
                <span className="text-[10px] text-outline block font-sans">Test Cases</span>
                <span className="font-bold text-emerald-600">{problem.testCasesCount} / {problem.testCasesCount} Passed</span>
              </div>
              <div className="h-6 w-px bg-surface-container-high self-center" />
              <div>
                <span className="text-[10px] text-outline block font-sans">Points</span>
                <span className="font-bold text-amber-500">+25 XP</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmissionSuccessModal(false)}
                className="flex-1 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccessModal(false);
                  setActiveIndex((prev) => (prev + 1) % CODING_PROBLEMS.length);
                  setVerdict(null);
                }}
                className="flex-1 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors"
              >
                Next Problem →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
