import { useState, useEffect, useCallback } from 'react';
import {
  ApplicationRecord,
  ApplicationStatus,
  AuthUser,
  CompanyDrive,
  DailyTask,
  NavigationPath,
  PortalSettings,
  StudentProfile,
  StudyPlanModule,
} from './types';
import {
  APTITUDE_QUESTIONS,
  INITIAL_APPLICATIONS,
  INITIAL_COMPANIES,
  INITIAL_PROFILE,
  INITIAL_SETTINGS,
  INITIAL_SKILL_GAPS,
  INITIAL_STUDY_MODULES,
  INITIAL_TASKS,
} from './data/placementData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CompaniesView } from './components/CompaniesView';
import { EligibilityCheckerPage } from './components/EligibilityCheckerPage';
import { SkillGapView } from './components/SkillGapView';
import { AiAssistantView } from './components/AiAssistantView';
import { PracticeSelectorPage } from './components/PracticeSelectorPage';
import { AptitudePracticePage } from './components/AptitudePracticePage';
import { CodingPracticePage } from './components/CodingPracticePage';
import { InterviewPrepView } from './components/InterviewPrepView';
import { RecommendationsView } from './components/EligibilityAndRecsViews';
import { MyProfileView } from './components/MyProfileView';
import { SecondaryViews } from './components/SecondaryViews';
import { EligibilityModal } from './components/EligibilityModal';
import { SearchModal } from './components/SearchModal';
import { AtsAuditModal } from './components/AtsAuditModal';
import { AddGoalModal } from './components/AddGoalModal';
import { CohortModal } from './components/CohortModal';
import { ProfileModal } from './components/ProfileModal';
import { AvatarEditorModal } from './components/AvatarEditorModal';
import { StudentLoginPage } from './components/StudentLoginPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { AdminConsoleApp } from './components/AdminConsoleApp';
import { PlacementBridgeLandingPage } from './components/PlacementBridgeLandingPage';
import { ProjectTitleCoverPage } from './components/ProjectTitleCoverPage';
import {
  authApi,
  placementApi,
  practiceApi,
  studentApi,
} from './services/api';
import {
  AUTH_TOKEN_STORAGE_KEY,
  setStoredAccessToken,
} from './services/api/client';

const AVATAR_STORAGE_KEY = 'placement_portal_custom_avatar_v1';

export default function App() {
  // Authentication & Portal Isolation State
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loginPortalMode, setLoginPortalMode] = useState<'cover' | 'landing' | 'student' | 'admin'>('cover');

  const [currentPath, setCurrentPath] = useState<NavigationPath>('dashboard');
  const [profile, setProfile] = useState<StudentProfile>(() => {
    try {
      const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...INITIAL_PROFILE,
          avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
          avatarBg: typeof parsed.avatarBg === 'string' ? parsed.avatarBg : 'indigo',
        };
      }
    } catch {
      // Ignore storage read errors
    }
    return { ...INITIAL_PROFILE, avatarUrl: '', avatarBg: 'indigo' };
  });

  const [companies, setCompanies] = useState<CompanyDrive[]>(INITIAL_COMPANIES);
  const [skillGaps, setSkillGaps] = useState(INITIAL_SKILL_GAPS);
  const [tasks, setTasks] = useState<DailyTask[]>(INITIAL_TASKS);
  const [applications, setApplications] = useState<ApplicationRecord[]>(INITIAL_APPLICATIONS);
  const [studyModules, setStudyModules] = useState<StudyPlanModule[]>(INITIAL_STUDY_MODULES);
  const [settings, setSettings] = useState<PortalSettings>(INITIAL_SETTINGS);

  // Dedicated Eligibility & Separated Practice States
  const [focusedEligibilityCompanyId, setFocusedEligibilityCompanyId] = useState<string | null>(
    INITIAL_COMPANIES[0]?.id || null
  );
  const [aptitudeAnswers, setAptitudeAnswers] = useState<Record<number, string>>({});
  const [codingSolvedIds, setCodingSolvedIds] = useState<string[]>(['second-largest']);

  // Modals state (Student Portal only)
  const [selectedCompanyModal, setSelectedCompanyModal] = useState<CompanyDrive | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAtsAuditOpen, setIsAtsAuditOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isCohortOpen, setIsCohortOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hydrateStudentProfile = useCallback((user: AuthUser) => {
    setProfile((prev) => ({
      ...prev,
      name: user.name || prev.name,
      email: user.email,
      department: user.department || prev.department,
      cgpa: typeof user.cgpa === 'number' ? user.cgpa : prev.cgpa,
    }));
  }, []);

  // Verify existing session token on mount (with automatic 401 refresh rotation)
  useEffect(() => {
    let active = true;
    const verifyExistingSession = async () => {
      try {
        const storedToken = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (!storedToken) {
          if (active) setAuthChecking(false);
          return;
        }
        const data = await authApi.getMe();
        const latestToken = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || storedToken;
        if (active && data?.user) {
          setAuthToken(latestToken);
          setAuthUser(data.user);
          if (data.user.role === 'student') {
            hydrateStudentProfile(data.user);
          }
        }
      } catch {
        setStoredAccessToken(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    };
    verifyExistingSession();
    return () => {
      active = false;
    };
  }, [hydrateStudentProfile]);

  // Sync live PostgreSQL student profile, companies, applications, roadmap, skill gaps & coding progress
  useEffect(() => {
    if (!authToken || authUser?.role !== 'student') return;
    let active = true;

    const loadStudentPortalData = async () => {
      try {
        const [data, codingData] = await Promise.all([
          studentApi.bootstrap(),
          practiceApi.listCodingProblems().catch(() => null),
        ]);
        if (!active) return;

        if (data.profile) {
          setProfile((prev) => ({
            ...prev,
            ...data.profile!,
            avatarUrl: data.profile!.avatarUrl || prev.avatarUrl || '',
            avatarBg: data.profile!.avatarBg || prev.avatarBg || 'indigo',
          }));
        }
        if (Array.isArray(data.companies) && data.companies.length > 0) {
          setCompanies(data.companies);
          setFocusedEligibilityCompanyId((prev) =>
            prev && data.companies.some((c) => c.id === prev) ? prev : data.companies[0].id
          );
        }
        if (Array.isArray(data.applications)) {
          setApplications(data.applications);
        }
        if (Array.isArray(data.studyModules) && data.studyModules.length > 0) {
          setStudyModules(data.studyModules);
        }
        if (Array.isArray(data.skillGaps) && data.skillGaps.length > 0) {
          setSkillGaps(data.skillGaps);
        }
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings! }));
        }
        if (codingData?.problems) {
          const solvedSlugs = codingData.problems
            .filter((p) => p.isSolved)
            .map((p) => p.slug);
          if (solvedSlugs.length > 0) {
            setCodingSolvedIds(solvedSlugs);
          }
        }
      } catch {
        // Keep initialized fallback data if offline
      }
    };

    loadStudentPortalData();
    return () => {
      active = false;
    };
  }, [authToken, authUser]);

  // Keyboard shortcut for Cmd+K / Ctrl+K (Student Portal only)
  useEffect(() => {
    if (authUser?.role !== 'student') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authUser]);

  const handleAuthenticated = (token: string, user: AuthUser) => {
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage restriction errors
    }
    setAuthToken(token);
    setAuthUser(user);
    if (user.role === 'student') {
      hydrateStudentProfile(user);
      setCurrentPath('dashboard');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    const previousRole = authUser?.role;
    const tokenToRevoke = authToken;

    setAuthToken(null);
    setAuthUser(null);
    setSelectedCompanyModal(null);
    setIsSearchOpen(false);
    setIsProfileOpen(false);
    setMobileMenuOpen(false);
    setCurrentPath('dashboard');
    setLoginPortalMode(previousRole === 'admin' ? 'admin' : 'student');

    try {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    if (tokenToRevoke) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToRevoke}` },
        });
      } catch {
        // Ignore network errors on sign-out
      }
    }
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleAddGoal = (goal: DailyTask) => {
    setTasks((prev) => [goal, ...prev]);
  };

  const handleUpdateProfile = (updated: StudentProfile) => {
    setProfile(updated);
    try {
      localStorage.setItem(
        AVATAR_STORAGE_KEY,
        JSON.stringify({
          avatarUrl: updated.avatarUrl || '',
          avatarBg: updated.avatarBg || 'indigo',
        })
      );
    } catch {
      // Ignore storage quota errors
    }
    setCompanies((prev) =>
      prev.map((comp) => ({
        ...comp,
        isEligible:
          updated.cgpa >= comp.minCgpa && updated.activeBacklogs <= comp.allowedBacklogs,
      }))
    );

    if (authToken && authUser?.role === 'student') {
      studentApi
        .updateMyProfile({
          fullName: updated.name,
          degree: updated.degree,
          department: updated.department,
          cgpa: updated.cgpa,
          graduationYear: updated.gradYear,
          activeBacklogs: updated.activeBacklogs,
          college: updated.collegeName,
          targetRole: updated.targetRole,
          leetcodeSolved: updated.leetcodeSolved,
          avatarUrl: updated.avatarUrl,
          avatarBg: updated.avatarBg,
          resumeSummary: updated.resumeSummary,
          skillsList: updated.skills,
        })
        .then(async (saved) => {
          if (saved?.frontendProfile) {
            setProfile((prev) => ({
              ...prev,
              profileCompletion: saved.frontendProfile.profileCompletion,
              readinessScore: saved.frontendProfile.readinessScore,
            }));
          }
          const refreshed = await studentApi.bootstrap().catch(() => null);
          if (refreshed) {
            if (Array.isArray(refreshed.companies) && refreshed.companies.length > 0) {
              setCompanies(refreshed.companies);
            }
            if (Array.isArray(refreshed.skillGaps) && refreshed.skillGaps.length > 0) {
              setSkillGaps(refreshed.skillGaps);
            }
          }
        })
        .catch(() => {
          // Local optimistic state preserved if transient network issue occurs
        });
    }
  };

  const handleApplyToCompany = (comp: CompanyDrive) => {
    const tempId = `app-${comp.id}-${Date.now()}`;
    setApplications((prev) => {
      if (prev.some((a) => a.companyId === comp.id)) return prev;
      const newApp: ApplicationRecord = {
        id: tempId,
        companyId: comp.id,
        company: comp.name,
        role: comp.role,
        packageLpa: comp.packageLpa,
        status: 'Applied',
        date: comp.driveDate,
        round: comp.hiringFunnel[0] || 'Round 1: Initial Screening',
        notes: `Submitted via campus portal with ${profile.cgpa.toFixed(2)} CGPA.`,
      };
      return [newApp, ...prev];
    });

    if (authToken) {
      placementApi
        .applyToCompany(comp.id, profile.cgpa)
        .then((res) => {
          if (res?.application) {
            setApplications((prev) =>
              prev.map((a) =>
                a.id === tempId || a.companyId === comp.id ? res.application : a
              )
            );
          }
        })
        .catch(() => {
          // Local optimistic application state preserved
        });
    }
  };

  const handleUpdateApplicationStatus = (id: string, status: ApplicationStatus) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    if (authToken) {
      placementApi.updateApplication(id, { status }).catch(() => {
        // Optimistic update preserved
      });
    }
  };

  const handleUpdateApplicationNotes = (id: string, notes: string) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, notes } : a)));
    if (authToken) {
      placementApi.updateApplication(id, { notes }).catch(() => {
        // Optimistic update preserved
      });
    }
  };

  const handleToggleStudyModule = (id: string) => {
    let nextCompleted = false;
    setStudyModules((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          nextCompleted = !m.completed;
          return { ...m, completed: nextCompleted };
        }
        return m;
      })
    );
    if (authToken) {
      placementApi
        .updateTopicProgress(id, nextCompleted ? 'COMPLETED' : 'NOT_STARTED')
        .catch(() => {
          // Custom local-only module or transient offline state
        });
    }
  };

  const handleAddStudyModule = (mod: StudyPlanModule) => {
    setStudyModules((prev) => [...prev, mod]);
  };

  const handleUpdateSettings = (nextSettings: PortalSettings) => {
    setSettings(nextSettings);
    if (authToken && authUser?.role === 'student') {
      studentApi.updateMyProfile({ portalSettings: nextSettings }).catch(() => {
        // Local settings preserved
      });
    }
  };

  const handleResetDemoState = () => {
    try {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setProfile((prev) => ({
      ...INITIAL_PROFILE,
      name: authUser?.name || INITIAL_PROFILE.name,
      email: authUser?.email,
      avatarUrl: '',
      avatarBg: 'indigo',
    }));
    setCompanies(INITIAL_COMPANIES);
    setTasks(INITIAL_TASKS);
    setApplications(INITIAL_APPLICATIONS);
    setStudyModules(INITIAL_STUDY_MODULES);
    setSettings(INITIAL_SETTINGS);
    setAptitudeAnswers({});
    setCodingSolvedIds(['second-largest']);
    setCurrentPath('dashboard');
  };

  const handleNavigate = (path: NavigationPath) => {
    if (path === 'logout') {
      handleLogout();
      return;
    }
    setCurrentPath(path === 'coding-assessments' ? 'coding-practice' : path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckCompanyEligibility = (companyId: string) => {
    setFocusedEligibilityCompanyId(companyId);
    handleNavigate('eligibility-checker');
  };

  // 1. Initial Cryptographic Session Verification Screen
  if (authChecking) {
    return (
      <div className="min-h-screen bg-surface text-on-surface font-hanken flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <span className="font-headline-sm text-on-surface font-bold block">
            Verifying Encrypted Portal Session
          </span>
          <span className="text-xs text-outline block">
            Placement Guidance Authentication Gateway
          </span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State -> Project Title Cover -> Official Placement Bridge Gateway -> Two High-Security Login Pages
  if (!authUser || !authToken) {
    if (loginPortalMode === 'cover') {
      return (
        <ProjectTitleCoverPage
          onGetStarted={() => {
            setLoginPortalMode('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      );
    }
    if (loginPortalMode === 'landing') {
      return (
        <PlacementBridgeLandingPage
          onEnterStudentLogin={() => {
            setLoginPortalMode('student');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onEnterAdminLogin={() => {
            setLoginPortalMode('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBackToCover={() => {
            setLoginPortalMode('cover');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      );
    }
    if (loginPortalMode === 'admin') {
      return (
        <AdminLoginPage
          onAuthenticated={handleAuthenticated}
          onSwitchToStudentLogin={() => setLoginPortalMode('student')}
          onBackToLanding={() => {
            setLoginPortalMode('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      );
    }
    return (
      <StudentLoginPage
        onAuthenticated={handleAuthenticated}
        onSwitchToAdminLogin={() => setLoginPortalMode('admin')}
        onBackToLanding={() => {
          setLoginPortalMode('landing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // 3. Authenticated Administrator -> Strictly Isolated TPO Admin Console ONLY
  if (authUser.role === 'admin') {
    return (
      <AdminConsoleApp
        user={authUser}
        token={authToken}
        onLogout={handleLogout}
        onUpdateAuthUser={setAuthUser}
      />
    );
  }

  // 4. Authenticated Student -> Strictly Isolated Student Career Portal ONLY
  const appliedCompanyIds = applications.map((a) => a.companyId);
  const aptitudeAttemptedCount = Object.keys(aptitudeAnswers).length;
  const aptitudeCorrectCount = APTITUDE_QUESTIONS.filter(
    (q) => aptitudeAnswers[q.id] && aptitudeAnswers[q.id] === q.correctAnswer
  ).length;

  const renderActiveView = () => {
    switch (currentPath) {
      case 'dashboard':
        return (
          <DashboardView
            profile={profile}
            companies={companies}
            skillGaps={skillGaps}
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onOpenAddGoal={() => setIsAddGoalOpen(true)}
            onOpenAtsAudit={() => setIsAtsAuditOpen(true)}
            onNavigate={handleNavigate}
            onSelectCompany={(c) => setSelectedCompanyModal(c)}
          />
        );
      case 'my-profile':
        return (
          <MyProfileView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onOpenAvatarEditor={() => setIsAvatarEditorOpen(true)}
            onOpenAtsAudit={() => setIsAtsAuditOpen(true)}
          />
        );
      case 'companies':
        return (
          <CompaniesView
            profile={profile}
            companies={companies}
            appliedCompanyIds={appliedCompanyIds}
            onCheckCompanyEligibility={handleCheckCompanyEligibility}
            onApplyCompany={handleApplyToCompany}
            onNavigate={handleNavigate}
          />
        );
      case 'eligibility-checker':
        return (
          <EligibilityCheckerPage
            profile={profile}
            companies={companies}
            appliedCompanyIds={appliedCompanyIds}
            focusedCompanyId={focusedEligibilityCompanyId}
            onSelectFocusedCompany={setFocusedEligibilityCompanyId}
            onApplyCompany={handleApplyToCompany}
            onUpdateProfile={handleUpdateProfile}
            onNavigate={handleNavigate}
          />
        );
      case 'skill-gap':
        return (
          <SkillGapView
            profile={profile}
            skillGaps={skillGaps}
            onOpenCohortModal={() => setIsCohortOpen(true)}
            onNavigate={handleNavigate}
          />
        );
      case 'recommendations':
        return (
          <RecommendationsView
            profile={profile}
            companies={companies}
            skillGaps={skillGaps}
            onNavigate={handleNavigate}
            onSelectCompany={(c) => setSelectedCompanyModal(c)}
          />
        );
      case 'practice-hub':
        return (
          <PracticeSelectorPage
            aptitudeAttemptedCount={aptitudeAttemptedCount}
            aptitudeCorrectCount={aptitudeCorrectCount}
            codingSolvedCount={codingSolvedIds.length}
            onNavigate={handleNavigate}
          />
        );
      case 'aptitude-practice':
        return (
          <AptitudePracticePage
            answers={aptitudeAnswers}
            onSelectAnswer={(qId, optKey) =>
              setAptitudeAnswers((prev) => ({ ...prev, [qId]: optKey }))
            }
            onResetAnswers={() => setAptitudeAnswers({})}
            onNavigate={handleNavigate}
          />
        );
      case 'coding-practice':
      case 'coding-assessments':
        return (
          <CodingPracticePage
            solvedIds={codingSolvedIds}
            onMarkSolved={(pId) => {
              setCodingSolvedIds((prev) => (prev.includes(pId) ? prev : [...prev, pId]));
              if (authToken) {
                practiceApi
                  .submitCodingPractice(pId, {
                    languageKey: 'java',
                    sourceCode: '// Marked solved in Coding Practice workspace',
                    selfMarkSolved: true,
                  })
                  .catch(() => {
                    // Local solved state preserved
                  });
              }
            }}
            onNavigate={handleNavigate}
          />
        );
      case 'interview-prep':
        return <InterviewPrepView profile={profile} />;
      case 'ai-assistant':
        return (
          <AiAssistantView
            profile={profile}
            companies={companies}
            skillGaps={skillGaps}
          />
        );
      default:
        return (
          <SecondaryViews
            currentPath={currentPath}
            profile={profile}
            companies={companies}
            applications={applications}
            studyModules={studyModules}
            settings={settings}
            onToggleStudyModule={handleToggleStudyModule}
            onAddStudyModule={handleAddStudyModule}
            onUpdateApplicationStatus={handleUpdateApplicationStatus}
            onUpdateApplicationNotes={handleUpdateApplicationNotes}
            onUpdateSettings={handleUpdateSettings}
            onResetDemoState={handleResetDemoState}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex font-hanken selection:bg-secondary-container selection:text-on-secondary-container">
      <Sidebar
        currentPath={currentPath}
        onNavigate={handleNavigate}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <Header
        profile={profile}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAvatarEditor={() => setIsAvatarEditorOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      <main className="flex-1 lg:ml-72 pt-20 px-4 sm:px-6 lg:px-8 pb-12 w-full max-w-[1600px] overflow-x-hidden">
        {renderActiveView()}
      </main>

      {/* Global Modals & Dialogs (Student Scope Only) */}
      <EligibilityModal
        company={selectedCompanyModal}
        profile={profile}
        isOpen={Boolean(selectedCompanyModal)}
        isApplied={
          selectedCompanyModal ? appliedCompanyIds.includes(selectedCompanyModal.id) : false
        }
        onClose={() => setSelectedCompanyModal(null)}
        onApplyToCompany={handleApplyToCompany}
        onNavigateToApplications={() => {
          setSelectedCompanyModal(null);
          handleNavigate('applications');
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        companies={companies}
        skillGaps={skillGaps}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <AtsAuditModal
        isOpen={isAtsAuditOpen}
        onClose={() => setIsAtsAuditOpen(false)}
        profile={profile}
      />

      <AddGoalModal
        isOpen={isAddGoalOpen}
        onClose={() => setIsAddGoalOpen(false)}
        onAddGoal={handleAddGoal}
      />

      <CohortModal isOpen={isCohortOpen} onClose={() => setIsCohortOpen(false)} />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onOpenAvatarEditor={() => setIsAvatarEditorOpen(true)}
        onNavigateFullProfile={() => handleNavigate('my-profile')}
      />

      <AvatarEditorModal
        isOpen={isAvatarEditorOpen}
        onClose={() => setIsAvatarEditorOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
      />
    </div>
  );
}
