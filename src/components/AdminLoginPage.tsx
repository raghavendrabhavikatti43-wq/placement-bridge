import React, { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { ThemeToggleButton } from '../context/ThemeContext';

interface AdminLoginPageProps {
  onAuthenticated: (token: string, user: AuthUser) => void;
  onSwitchToStudentLogin: () => void;
  onBackToLanding?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAuthenticated,
  onSwitchToStudentLogin,
  onBackToLanding,
}) => {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [challengeId, setChallengeId] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    try {
      const res = await fetch('/api/auth/challenge');
      if (res.ok) {
        const data = await res.json();
        setChallengeId(data.challengeId);
        setChallengeCode(data.code);
        setChallengeAnswer('');
      }
    } catch {
      // Challenge refresh error handled on submit if offline
    } finally {
      setChallengeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          email: email.trim(),
          password,
          challengeId,
          challengeAnswer: challengeAnswer.trim().toUpperCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(
          data.error || 'Restricted Admin authentication rejected. Verify all credentials.'
        );
        setSubmitting(false);
        await loadChallenge();
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setErrorMsg('Unable to reach high-security TPO authentication server.');
      setSubmitting(false);
      await loadChallenge();
    }
  };

  return (
    <div
      id="admin-login-page"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-hanken flex flex-col justify-between selection:bg-indigo-500 selection:text-white transition-colors duration-150"
    >
      {/* Top Restricted Header */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">shield_lock</span>
            </div>
            <div>
              <span className="font-headline-sm text-slate-900 dark:text-white font-bold block leading-tight tracking-wide">
                TPO Governance Vault
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block leading-tight">
                Restricted Single-Custodian Administrator Access
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onBackToLanding && (
              <button
                id="admin-back-to-bridge-btn"
                type="button"
                onClick={onBackToLanding}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                ← Placement Bridge
              </button>
            )}
            <ThemeToggleButton compact />
            <button
              id="back-to-student-login-btn"
              type="button"
              onClick={onSwitchToStudentLogin}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">
                arrow_back
              </span>
              <span>Switch to Student Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main High-Security Verification Container */}
      <main className="flex-1 flex items-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Security Policy Brief */}
          <section className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
                <span>Exclusive Officer Clearance</span>
                <span aria-hidden="true">·</span>
                <span>Academic Year 2026-27</span>
                <span aria-hidden="true">·</span>
                <span>Zero Public Sign-Up</span>
              </div>
              <h1 className="font-headline-xl text-slate-900 dark:text-white font-extrabold tracking-tight">
                Chief Placement Officer Authentication
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                This portal is strictly locked to a single authorized custodian. Multi-field
                identity verification (User ID, Official Email, Master Password, and one-time
                security code) is enforced on every sign-in.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-200/80 dark:border-slate-900">
                <span className="text-slate-500 dark:text-slate-400">Authorized Accounts</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  1 Custodian Only
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-200/80 dark:border-slate-900">
                <span className="text-slate-500 dark:text-slate-400">Credential Verification</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  scrypt + timingSafeEqual
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-200/80 dark:border-slate-900">
                <span className="text-slate-500 dark:text-slate-400">Brute-Force Defense</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  5-Attempt Lockout
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Portal Separation</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  Admin Console Only
                </span>
              </div>
            </div>
          </section>

          {/* Right High-Security Single-Admin Form */}
          <section className="lg:col-span-7">
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                  Mandatory 4-Point Custodian Verification
                </span>
                <h2 className="font-headline-md text-slate-900 dark:text-white font-bold mt-0.5">
                  Verify Administrator Credentials
                </h2>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-red-600 dark:text-red-400 shrink-0">
                    gpp_bad
                  </span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="admin-userid-input"
                      className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5 tracking-wide"
                    >
                      Authorized User ID
                    </label>
                    <input
                      id="admin-userid-input"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="TPO-ADMIN-01"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-email-input"
                      className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5 tracking-wide"
                    >
                      Official Custodian Email
                    </label>
                    <input
                      id="admin-email-input"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="admin.tpo@nie-placement.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-password-input"
                    className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5 tracking-wide"
                  >
                    Administrator Master Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="admin-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Enter restricted master password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* Human Verification Security Code */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="admin-challenge-input"
                      className="font-semibold text-slate-800 dark:text-slate-200 tracking-wide"
                    >
                      One-Time Security Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={loadChallenge}
                      disabled={challengeLoading}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">refresh</span>
                      <span>Refresh Code</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div
                      aria-label="Security challenge code"
                      className="sm:col-span-5 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center font-mono text-base font-extrabold tracking-[0.3em] text-indigo-700 dark:text-indigo-300 select-none tabular-nums"
                    >
                      {challengeLoading ? '······' : challengeCode || '------'}
                    </div>
                    <div className="sm:col-span-7">
                      <input
                        id="admin-challenge-input"
                        type="text"
                        required
                        maxLength={6}
                        autoComplete="off"
                        placeholder="Enter 6-character code shown"
                        value={challengeAnswer}
                        onChange={(e) => setChallengeAnswer(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-600 dark:focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="admin-login-submit-btn"
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>
                    {submitting
                      ? 'Authenticating TPO Custodian...'
                      : 'Unlock TPO Administration Console'}
                  </span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>

      {/* Quiet Security Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Restricted Institutional Control Plane · Unauthorized Attempts Logged</span>
          <span>Single-Custodian Policy Active · HMAC-SHA256 Session Guard</span>
        </div>
      </footer>
    </div>
  );
};
