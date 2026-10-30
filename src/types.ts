export type NavigationPath =
  | 'dashboard'
  | 'my-profile'
  | 'companies'
  | 'eligibility-checker'
  | 'skill-gap'
  | 'recommendations'
  | 'practice-hub'
  | 'aptitude-practice'
  | 'coding-practice'
  | 'coding-assessments'
  | 'interview-prep'
  | 'study-plan'
  | 'progress-analytics'
  | 'applications'
  | 'resources'
  | 'ai-assistant'
  | 'settings'
  | 'logout';

export type AuthRole = 'student' | 'admin';

export interface AdminProfile {
  userId: string;
  email: string;
  name: string;
  title: string;
  department: string;
  institutionName: string;
  batchYear: number;
  phone: string;
  officeLocation: string;
  officeHours: string;
  deskEmail: string;
  bio: string;
  avatarUrl: string;
  avatarBg: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  title?: string;
  avatarUrl?: string;
  avatarBg?: string;
  department?: string;
  cgpa?: number;
}

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: 'admin' | 'student' | 'unknown';
  event: string;
  outcome: 'SUCCESS' | 'BLOCKED';
}

export interface StudentProject {
  id: string;
  title: string;
  stack: string;
  impact: string;
}

export interface StudentProfile {
  name: string;
  email?: string;
  degree: string;
  department: string;
  cgpa: number;
  gradYear: number;
  activeBacklogs: number;
  collegeName: string;
  readinessScore: number;
  profileCompletion: number;
  targetRole: string;
  avatarUrl: string;
  avatarBg?: string;
  skills: string[];
  certifications: string[];
  projects: StudentProject[];
  leetcodeSolved: number;
  resumeSummary: string;
}

export interface CompanyDrive {
  id: string;
  name: string;
  logoIcon: string;
  role: string;
  category: string;
  matchScore: number;
  location: string;
  packageLpa: string;
  driveDate: string;
  daysRemaining: number;
  isEligible: boolean;
  minCgpa: number;
  allowedBacklogs: number;
  allowedBranches: string[];
  matchedSkills: string[];
  gapSkills: string[];
  hiringFunnel: string[];
  institutionalNotes?: string;
}

export interface SkillGapItem {
  id: string;
  title: string;
  subtitle: string;
  priority: 'High' | 'Medium' | 'Low';
  priorityTag: string;
  moduleCategory: string;
  currentProficiency: number;
  currentLabel: string;
  targetBenchmark: number;
  targetLabel: string;
  deficitPercentage: number;
  impactedCompanies: string[];
  actionLabel: string;
  actionIcon: string;
}

export interface DailyTask {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  timeEstimate?: string;
  category?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  details?: {
    type?: 'diagnosis' | 'question' | 'feedback';
    priorities?: { num: number; title: string; desc: string }[];
    codeSnippet?: string;
    questionPrompt?: string;
    recommendedTime?: string;
    topic?: string;
  };
}

export interface AptitudeQuestion {
  id: number;
  category:
    | 'Quantitative'
    | 'Logical Reasoning'
    | 'Speed Math'
    | 'Data Interpretation'
    | 'Verbal Ability';
  patternBadge: string;
  question: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

export interface CodingProblem {
  id: string;
  title: string;
  badge: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  complexity: string;
  description: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  javaCode: string;
  pythonCode: string;
  cppCode: string;
  testCasesCount: number;
  runTime: string;
}

export type ApplicationStatus =
  | 'Applied'
  | 'OA Scheduled'
  | 'Shortlisted'
  | 'Tech Round'
  | 'Offer';

export interface ApplicationRecord {
  id: string;
  companyId: string;
  company: string;
  role: string;
  packageLpa: string;
  status: ApplicationStatus;
  date: string;
  round: string;
  notes: string;
}

export interface StudyPlanModule {
  id: string;
  week: 1 | 2 | 3;
  dayRange: string;
  title: string;
  category: string;
  duration: string;
  completed: boolean;
}

export interface InterviewArchive {
  id: string;
  company: string;
  role: string;
  packageLpa: string;
  year: string;
  verdict: 'Selected' | 'Waitlisted';
  difficulty: 'Hard' | 'Medium';
  rounds: {
    roundName: string;
    focus: string;
    keyQuestions: string[];
  }[];
  advice: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  category:
    | 'DSA & Algorithms'
    | 'Core CS (DBMS/OS/CN)'
    | 'Aptitude & Quant'
    | 'Behavioral & Resume';
  readTime: string;
  updatedAt: string;
  summary: string;
  content: string;
}

export interface PortalSettings {
  minTargetCtc: number;
  dailyGoalHours: number;
  driveAlerts: boolean;
  mockReminders: boolean;
  tpoProfileVisible: boolean;
}
