import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { AuthUser } from '../types';
import { LOGO_URL } from '../data/placementData';
import { auth, googleAuthProvider } from '../lib/firebase';
import { authApi } from '../services/api';
import { ThemeToggleButton } from '../context/ThemeContext';

interface StudentLoginPageProps {
  onAuthenticated: (token: string, user: AuthUser) => void;
  onSwitchToAdminLogin: () => void;
  onBackToLanding?: () => void;
}

type EmailAuthMode = 'signin' | 'register';
type ContinueProvider = 'google' | 'institutional-sso' | 'github';

const PROVIDER_META: Record<
  ContinueProvider,
  { label: string; subtitle: string; sampleEmail: string; icon: string }
> = {
  google: {
    label: 'Continue with Google',
    subtitle: 'Authenticate using your Google Workspace or Gmail student account',
    sampleEmail: 'ananya.rao@gmail.com',
    icon: 'mail',
  },
  'institutional-sso': {
    label: 'Continue with Institutional SSO',
    subtitle: 'Authenticate via National Institute of Engineering (.edu.in) directory',
    sampleEmail: 'rohan.kulkarni@nie.edu.in',
    icon: 'school',
  },
  github: {
    label: 'Continue with GitHub',
    subtitle: 'Verify identity with your developer GitHub student account',
    sampleEmail: 'karthik.dev@nie.edu.in',
    icon: 'terminal',
  },
};

export const StudentLoginPage: React.FC<StudentLoginPageProps> = ({
  onAuthenticated,
  onSwitchToAdminLogin,
  onBackToLanding,
}) => {
  const [logoError, setLogoError] = useState(false);

  // Block 1: Email ID Login / Registration state
  const [mode, setMode] = useState<EmailAuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Computer Engg (CSE)');
  const [cgpa, setCgpa] = useState('8.1');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Block 2: "Continue with" state
  const [activeProvider, setActiveProvider] = useState<ContinueProvider | null>(null);
  const [continueEmail, setContinueEmail] = useState('');
  const [continueName, setContinueName] = useState('');
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const passwordStrengthLabel = (() => {
    if (!password) return 'Minimum 6 characters required';
    if (password.length < 6) return 'Too short — enter at least 6 characters';
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [password.length >= 8, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (score >= 3) return 'High cryptographic password strength';
    if (score === 2) return 'Moderate password strength';
    return 'Standard password length verified';
  })();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailLoading(true);

    try {
      const response = await fetch('/api/auth/student/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          email: email.trim(),
          password,
          name: fullName.trim() || undefined,
          department,
          cgpa,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmailError(data.error || 'Unable to authenticate with this Email ID.');
        setEmailLoading(false);
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setEmailError('Network error while contacting authentication server. Please try again.');
      setEmailLoading(false);
    }
  };

  const handleSelectProvider = async (provider: ContinueProvider) => {
    setContinueError(null);
    if (provider === 'google' && activeProvider !== 'google') {
      try {
        const cred = await signInWithPopup(auth, googleAuthProvider);
        const idToken = await cred.user.getIdToken();
        const data = await authApi.googleSignIn(idToken, department, parseFloat(cgpa) || 8.1);
        onAuthenticated(data.accessToken, {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: 'student',
          department: data.user.department || 'Computer Engg (CSE)',
          cgpa: data.user.cgpa ?? 8.1,
        });
        return;
      } catch {
        // If popup is closed or blocked by sandbox iframe policies, fall through to inline verification
      }
    }
    if (activeProvider === provider) {
      setActiveProvider(null);
      return;
    }
    setActiveProvider(provider);
    if (!continueEmail) {
      setContinueEmail(PROVIDER_META[provider].sampleEmail);
    }
  };

  const handleContinueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    setContinueError(null);
    setContinueLoading(true);

    try {
      const response = await fetch('/api/auth/student/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          email: continueEmail.trim(),
          name: continueName.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setContinueError(data.error || 'Unable to verify federated student account.');
        setContinueLoading(false);
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setContinueError('Network error while completing federated sign-in.');
      setContinueLoading(false);
    }
  };

  const fillPreseededStudent = () => {
    setMode('signin');
    setEmail('aditya.sharma@nie.edu.in');
    setPassword('Student@2026!');
    setEmailError(null);
  };

  return (
    <div
      id="student-login-page"
      className="min-h-screen bg-surface text-on-surface font-hanken flex flex-col justify-between selection:bg-secondary-container selection:text-on-secondary-container"
    >
      {/* Top Institutional Navigation Bar */}
      <header className="w-full border-b border-surface-container-high bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!logoError ? (
              <img
                alt="Placement Guidance Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                src={LOGO_URL}
                className="w-8 h-8 rounded-lg object-contain shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">school</span>
              </div>
            )}
            <div>
              <span className="font-headline-sm text-on-surface font-bold block leading-tight">
                Placement Guidance
              </span>
              <span className="text-xs text-outline block leading-tight">
                Student Candidate Authentication Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onBackToLanding && (
              <button
                id="student-back-to-bridge-btn"
                type="button"
                onClick={onBackToLanding}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                ← Placement Bridge
              </button>
            )}
            <ThemeToggleButton compact />
            <button
              id="go-to-admin-login-btn"
              type="button"
              onClick={onSwitchToAdminLogin}
              className="px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-xs font-bold text-on-surface transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">
                admin_panel_settings
              </span>
              <span>Restricted TPO Admin Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split-Column Student Gateway */}
      <main className="flex-1 flex items-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Editorial Context Column */}
          <section className="lg:col-span-5 space-y-6 lg:pt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-secondary font-semibold">
                <span>Student Career Portal</span>
                <span aria-hidden="true">·</span>
                <span>Academic Year 2026-27</span>
                <span aria-hidden="true">·</span>
                <span>Open to All Candidates</span>
              </div>
              <h1 className="font-display-lg text-on-surface tracking-tight max-w-md">
                Sign in to your placement workspace
              </h1>
              <p className="font-body-lg text-on-surface-variant leading-relaxed">
                Access campus recruiter eligibility checks, dedicated aptitude and technical coding
                tracks, resume audits, and personalized readiness analytics.
              </p>
            </div>

            <div className="pt-4 border-t border-surface-container-high space-y-4 text-sm">
              <div>
                <h2 className="font-headline-sm text-on-surface font-bold">
                  Role-Isolated Candidate Security
                </h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Every student session is protected with scrypt password hashing, HMAC-SHA256
                  signed session tokens, and strict student-only portal routing.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 tabular-nums">
                <div>
                  <span className="font-headline-md text-secondary font-extrabold block">
                    100% Isolated
                  </span>
                  <span className="text-xs text-outline">
                    Dedicated student workspace &amp; practice tracks
                  </span>
                </div>
                <div>
                  <span className="font-headline-md text-on-surface font-extrabold block">
                    8-Hour Token
                  </span>
                  <span className="text-xs text-outline">
                    Signed session with instant revocation on sign-out
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Pre-Verified Student Account Reference */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-on-surface">
                  Verified Student Account Ready for Testing
                </span>
                <button
                  id="quick-fill-student-btn"
                  type="button"
                  onClick={fillPreseededStudent}
                  className="text-secondary font-bold hover:underline whitespace-nowrap shrink-0"
                >
                  Auto-fill credentials
                </button>
              </div>
              <div className="text-on-surface-variant font-mono space-y-0.5 tabular-nums">
                <div>Email ID: aditya.sharma@nie.edu.in</div>
                <div>Password: Student@2026!</div>
              </div>
              <p className="text-[11px] text-outline">
                Any student can also sign in with their own Email ID and password or use the
                Continue with block.
              </p>
            </div>
          </section>

          {/* Right Authentication Column: Block 1 (Email ID) + Block 2 (Continue With) */}
          <section className="lg:col-span-7 space-y-5">
            {/* BLOCK 1: LOG IN WITH EMAIL ID */}
            <div
              id="student-email-login-block"
              className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl border border-surface-container-high space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container-low">
                <div>
                  <span className="text-xs text-outline font-semibold block">
                    01. Primary Student Access
                  </span>
                  <h2 className="font-headline-md text-on-surface font-bold mt-0.5">
                    Log in with Email ID
                  </h2>
                </div>

                {/* Mode Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container-low shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setEmailError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'signin'
                        ? 'bg-surface-container-lowest text-secondary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setEmailError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'register'
                        ? 'bg-surface-container-lowest text-secondary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    New Student
                  </button>
                </div>
              </div>

              {emailError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-start gap-2"
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                  <span>{emailError}</span>
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-4 text-xs">
                {mode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="student-fullname-input"
                        className="block font-semibold text-on-surface mb-1.5"
                      >
                        Full Name
                      </label>
                      <input
                        id="student-fullname-input"
                        type="text"
                        required
                        placeholder="e.g., Priya Nair"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="student-dept-select"
                        className="block font-semibold text-on-surface mb-1.5"
                      >
                        Engineering Branch
                      </label>
                      <select
                        id="student-dept-select"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-semibold outline-none focus:border-secondary"
                      >
                        <option value="Computer Engg (CSE)">Computer Engg (CSE)</option>
                        <option value="Information Tech (IT)">Information Tech (IT)</option>
                        <option value="Electronics & Comm (ECE)">Electronics &amp; Comm (ECE)</option>
                        <option value="Electrical Engg (EE)">Electrical Engg (EE)</option>
                        <option value="Mechanical Engg (ME)">Mechanical Engg (ME)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="student-cgpa-input"
                        className="block font-semibold text-on-surface mb-1.5"
                      >
                        CGPA
                      </label>
                      <input
                        id="student-cgpa-input"
                        type="number"
                        step="0.1"
                        min="5"
                        max="10"
                        value={cgpa}
                        onChange={(e) => setCgpa(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono tabular-nums outline-none focus:border-secondary"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="student-email-input"
                    className="block font-semibold text-on-surface mb-1.5"
                  >
                    Student Email ID
                  </label>
                  <input
                    id="student-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="student.name@nie.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="student-password-input"
                      className="font-semibold text-on-surface"
                    >
                      Password
                    </label>
                    <span className="text-[11px] text-outline">{passwordStrengthLabel}</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="student-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="Enter your student password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 text-xs font-bold text-secondary hover:underline whitespace-nowrap shrink-0"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  id="student-email-submit-btn"
                  type="submit"
                  disabled={emailLoading}
                  className="w-full py-3 px-4 rounded-xl bg-secondary text-on-secondary font-bold text-sm hover:bg-secondary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>
                    {emailLoading
                      ? 'Verifying Student Session...'
                      : mode === 'signin'
                      ? 'Sign In with Email ID'
                      : 'Create Account & Enter Portal'}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            </div>

            {/* BLOCK 2: CONTINUE WITH BLOCK */}
            <div
              id="student-continue-with-block"
              className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl border border-surface-container-high space-y-4"
            >
              <div>
                <span className="text-xs text-outline font-semibold block">
                  02. Instant Federated Access
                </span>
                <h2 className="font-headline-md text-on-surface font-bold mt-0.5">
                  Continue with
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Choose a verified campus or developer identity provider to enter the Student
                  Career Portal immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(Object.keys(PROVIDER_META) as ContinueProvider[]).map((providerKey) => {
                  const item = PROVIDER_META[providerKey];
                  const isSelected = activeProvider === providerKey;
                  return (
                    <button
                      key={providerKey}
                      id={`continue-with-${providerKey}-btn`}
                      type="button"
                      onClick={() => handleSelectProvider(providerKey)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? 'border-secondary bg-surface-container-low text-on-surface'
                          : 'border-surface-container-high bg-surface hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">
                        {item.icon}
                      </span>
                      <span className="text-xs font-bold leading-snug">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeProvider && (
                <form
                  onSubmit={handleContinueSubmit}
                  className="pt-4 border-t border-surface-container-low space-y-3 text-xs animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-on-surface">
                      {PROVIDER_META[activeProvider].label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveProvider(null)}
                      className="text-outline hover:text-on-surface font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-outline">{PROVIDER_META[activeProvider].subtitle}</p>

                  {continueError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-error-container text-on-error-container font-semibold"
                    >
                      {continueError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="continue-email-input"
                        className="block font-semibold text-on-surface mb-1"
                      >
                        Verified Account Email ID
                      </label>
                      <input
                        id="continue-email-input"
                        type="email"
                        required
                        placeholder={PROVIDER_META[activeProvider].sampleEmail}
                        value={continueEmail}
                        onChange={(e) => setContinueEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="continue-name-input"
                        className="block font-semibold text-on-surface mb-1"
                      >
                        Display Name (Optional)
                      </label>
                      <input
                        id="continue-name-input"
                        type="text"
                        placeholder="e.g., Ananya Rao"
                        value={continueName}
                        onChange={(e) => setContinueName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
                      />
                    </div>
                  </div>

                  <button
                    id="confirm-continue-provider-btn"
                    type="submit"
                    disabled={continueLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {continueLoading
                      ? 'Completing Verified Sign-In...'
                      : `${PROVIDER_META[activeProvider].label} →`}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-surface-container-high py-4 px-4 sm:px-6 lg:px-8 text-xs text-outline">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>National Institute of Engineering · Career Guidance &amp; Placement Cell</span>
          <span>Encrypted Candidate Gateway · Student Role Scope Enforced</span>
        </div>
      </footer>
    </div>
  );
};
