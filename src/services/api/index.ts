/**
 * Placement Bridge — Domain-Organized Frontend API Modules
 * Connects existing Student Portal & TPO Admin Console views to persistent PostgreSQL
 * `/api/v1/*` and `/api/*` endpoints without altering any existing UI/UX components.
 */

import type {
  ApplicationRecord,
  ApplicationStatus,
  AuthUser,
  CompanyDrive,
  PortalSettings,
  SkillGapItem,
  StudentProfile,
  StudyPlanModule,
} from '../../types';
import { apiRequest } from './client';

export interface StudentBootstrapPayload {
  profile: StudentProfile | null;
  companies: CompanyDrive[];
  applications: ApplicationRecord[];
  studyModules: StudyPlanModule[];
  skillGaps: SkillGapItem[];
  settings: PortalSettings | null;
  readiness: {
    overallScore: number;
    category: string;
    isProvisional: boolean;
    coveragePct: number;
    disclaimer: string;
  } | null;
  completion: {
    completionPct: number;
    missingSections: string[];
  } | null;
  capabilities: {
    aiEnabled: boolean;
    executionEnabled: boolean;
    emailEnabled: boolean;
    storageDriver: string;
  };
}

export const authApi = {
  getMe: () =>
    apiRequest<{ user: AuthUser; capabilities?: Record<string, unknown> }>('/auth/me', {
      rawBaseUrl: '/api',
    }),
  googleSignIn: (idToken: string, department?: string, cgpa?: number) =>
    apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        name: string;
        role: 'STUDENT' | 'ADMIN';
        department?: string;
        cgpa?: number;
      };
    }>('/auth/oauth/google', {
      method: 'POST',
      skipAuth: true,
      skipRefresh: true,
      body: { idToken, department, cgpa },
    }),
  logout: () =>
    apiRequest<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      rawBaseUrl: '/api',
      skipRefresh: true,
    }),
};

export const studentApi = {
  bootstrap: () =>
    apiRequest<StudentBootstrapPayload>('/student/bootstrap', {
      rawBaseUrl: '/api',
    }),
  getMyProfile: () => apiRequest<Record<string, unknown>>('/students/me'),
  updateMyProfile: (payload: {
    fullName?: string;
    degree?: string;
    department?: string;
    cgpa?: number;
    graduationYear?: number;
    activeBacklogs?: number;
    college?: string;
    targetRole?: string;
    leetcodeSolved?: number;
    avatarUrl?: string;
    avatarBg?: string;
    resumeSummary?: string;
    skillsList?: string[];
    portalSettings?: PortalSettings;
  }) =>
    apiRequest<{
      frontendProfile: StudentProfile;
      completion: { completionPct: number };
      readiness: { overallScore: number };
    }>('/students/me', {
      method: 'PUT',
      body: payload,
    }),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<{ id: string; url: string; originalName: string }>('/files/resume', {
      method: 'POST',
      body: form,
    });
  },
};

export const placementApi = {
  listCompanies: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest<unknown[]>(`/companies${qs}`);
  },
  applyToCompany: (companyId: string, cgpa: number) =>
    apiRequest<{ application: ApplicationRecord }>('/student/applications', {
      method: 'POST',
      rawBaseUrl: '/api',
      body: { companyId, cgpa },
    }),
  updateApplication: (
    applicationId: string,
    payload: { status?: ApplicationStatus; round?: string; notes?: string }
  ) =>
    apiRequest<Record<string, unknown>>(`/applications/${encodeURIComponent(applicationId)}`, {
      method: 'PUT',
      body: payload,
    }),
  checkEligibility: (companyId?: string) =>
    apiRequest<Record<string, unknown>>('/eligibility/check', {
      method: 'POST',
      body: companyId ? { companyId } : {},
    }),
  runRecommendations: () =>
    apiRequest<Record<string, unknown>>('/recommendations/run', {
      method: 'POST',
      body: {},
    }),
  runSkillGap: (companyId?: string) =>
    apiRequest<Record<string, unknown>>('/skill-gap', {
      method: 'POST',
      body: companyId ? { companyId } : {},
    }),
  updateTopicProgress: (
    topicIdOrSlug: string,
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  ) =>
    apiRequest<Record<string, unknown>>(
      `/preparation/topics/${encodeURIComponent(topicIdOrSlug)}/progress`,
      {
        method: 'PUT',
        body: { status },
      }
    ),
};

export const practiceApi = {
  listCodingProblems: () =>
    apiRequest<{
      executionEnabled: boolean;
      mode: 'SANDBOX' | 'PRACTICE';
      problems: Array<{ id: string; slug: string; isSolved: boolean; studentStatus: string }>;
    }>('/coding/problems?pageSize=100'),
  submitCodingPractice: (
    problemIdOrSlug: string,
    payload: { languageKey?: string; sourceCode: string; selfMarkSolved?: boolean }
  ) =>
    apiRequest<Record<string, unknown>>(
      `/coding/problems/${encodeURIComponent(problemIdOrSlug)}/submissions`,
      {
        method: 'POST',
        body: payload,
      }
    ),
  startAptitudeAttempt: (payload: { category?: string; numQuestions?: number }) =>
    apiRequest<Record<string, unknown>>('/aptitude/attempts', {
      method: 'POST',
      body: payload,
    }),
};

export const progressApi = {
  getDashboard: () => apiRequest<Record<string, unknown>>('/dashboard'),
  getReadiness: () => apiRequest<Record<string, unknown>>('/readiness'),
  recalculateReadiness: () =>
    apiRequest<Record<string, unknown>>('/readiness/recalculate', {
      method: 'POST',
      body: {},
    }),
  getBadges: () => apiRequest<unknown[]>('/progress/badges'),
};
