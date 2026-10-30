import React, { useState } from 'react';

interface ProjectTitleCoverPageProps {
  onGetStarted: () => void;
}

export const ProjectTitleCoverPage: React.FC<ProjectTitleCoverPageProps> = ({
  onGetStarted,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div
      id="placement-bridge-title-cover"
      className="relative min-h-screen w-full bg-[#06132b] text-white font-hanken antialiased selection:bg-[#e5c372] selection:text-[#06132b] flex flex-col justify-between overflow-hidden"
    >
      {/* Formal Ceremonial Top Tri-Band Ribbon (Royal Sapphire, Champagne Gold & Cobalt) */}
      <div
        aria-hidden="true"
        className="h-1.5 w-full bg-gradient-to-r from-[#0d3b8e] via-[#e5c372] to-[#0d3b8e] shrink-0"
      />

      {/* Rich Formal Institutional Sapphire, Sky-Cobalt & Subtle Gold Illumination */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_14%_18%,rgba(29,78,216,0.34),transparent_68%),radial-gradient(ellipse_58%_52%_at_82%_38%,rgba(37,99,235,0.34),transparent_66%),radial-gradient(ellipse_65%_48%_at_52%_92%,rgba(14,58,138,0.38),transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_36%,rgba(229,195,114,0.09),transparent_42%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.045] bg-[linear-gradient(to_right,#93c5fd_1px,transparent_1px),linear-gradient(to_bottom,#93c5fd_1px,transparent_1px)] bg-[size:64px_64px]"
      />

      {/* Main Single-Screen Official Project Title Charter */}
      <main className="relative z-10 flex-1 flex items-center py-12 sm:py-16">
        <div className="max-w-[1140px] w-full mx-auto px-6 sm:px-10 space-y-11">
          {/* Two-Column Title & Seamless Colored Institutional Logo Composition */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: Institutional Crest, Colored Project Title & Description */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-7">
              <div className="flex items-center gap-4">
                {/* Official Geometric Vector Crest (Academic Mortarboard + Bridge Span) */}
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#102c5e] to-[#091a3a] border border-[#e5c372]/50 shadow-md shadow-black/25 flex items-center justify-center shrink-0"
                >
                  <svg
                    viewBox="0 0 40 40"
                    className="w-7 h-7 fill-none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 7L34 13.5L20 20L6 13.5L20 7Z"
                      stroke="#f3d88b"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M31 15V23.5"
                      stroke="#f3d88b"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7 29.5H33"
                      stroke="#7dd3fc"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M11 29.5C13 24.5 27 24.5 29 29.5"
                      stroke="#ffffff"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="space-y-1 tracking-[0.01em]">
                  <div className="text-xs font-semibold text-[#f0d483] tracking-wide">
                    Directorate of Training &amp; Placement · Academic Year 2026-27
                  </div>
                  <div className="text-xs text-blue-100/80">
                    National Institute of Engineering · Official Campus Placement Charter
                  </div>
                </div>
              </div>

              {/* Project Title with Formal Pearl-White & Academic Champagne-Gold Finish */}
              <div className="space-y-4">
                <h1 className="font-manrope font-extrabold tracking-[-0.035em] text-[clamp(3.1rem,6vw,5.1rem)] leading-[1.04] text-balance">
                  <span className="bg-gradient-to-b from-white via-[#f8fbff] to-[#dbeafe] bg-clip-text text-transparent">
                    Placement{' '}
                  </span>
                  <span className="bg-gradient-to-r from-[#f8e6a6] via-[#e7bf5f] to-[#d4a43c] bg-clip-text text-transparent">
                    Bridge
                  </span>
                </h1>

                <div
                  aria-hidden="true"
                  className="w-28 h-[2px] bg-gradient-to-r from-[#e5c372] via-[#7dd3fc] to-transparent"
                />

                <p className="font-manrope text-base sm:text-xl font-semibold text-[#dbeafe] leading-snug text-balance max-w-2xl tracking-[0.005em]">
                  Institutional Recruitment Governance, Deterministic Eligibility Verification, and
                  Engineering Career Readiness Portal.
                </p>
              </div>

              {/* Concise 2–3 Line Description */}
              <p className="text-sm sm:text-base text-slate-200/90 leading-[1.72] max-w-[65ch] tracking-[0.01em]">
                Connecting graduating engineering cohorts for Academic Year 2026-27 with verified
                campus recruiters through rule-based cutoff screening, weighted role-fit roadmaps,
                dedicated aptitude and coding workspaces, and role-isolated placement governance.
              </p>
            </div>

            {/* Right Column: Background-Removed Institutional Colored Logo Mark */}
            <div className="lg:col-span-5 xl:col-span-4 relative flex items-center justify-center lg:justify-end py-2">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.42)_0%,rgba(229,195,114,0.12)_42%,transparent_72%)]"
              />
              {!logoFailed ? (
                <img
                  src="/assets/placement_bridge_logo_mark.png"
                  alt="Placement Bridge Official Monogram"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="relative z-10 w-56 sm:w-64 lg:w-72 xl:w-[300px] h-auto object-contain select-none pointer-events-none drop-shadow-[0_14px_34px_rgba(3,15,46,0.72)]"
                />
              ) : (
                <svg
                  viewBox="0 0 120 105"
                  aria-label="Placement Bridge Official Monogram"
                  className="relative z-10 w-56 sm:w-64 lg:w-72 h-auto fill-none"
                >
                  <path
                    d="M42 12L74 26L42 40L10 26L42 12Z"
                    stroke="#f3d88b"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M34 42H78C92 42 100 50 100 60C100 70 92 77 78 77H52"
                    stroke="#ffffff"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M34 42V95"
                    stroke="#ffffff"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 95C36 68 68 58 106 54"
                    stroke="#7dd3fc"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Dedicated Formal Royal-Sapphire & Champagne-Gold "Get Started" Block */}
          <div
            onClick={onGetStarted}
            role="region"
            aria-label="Get Started"
            className="bg-gradient-to-r from-[#0c2147]/95 via-[#112e63]/95 to-[#0d244f]/95 backdrop-blur-sm text-white border border-[#e5c372]/40 hover:border-[#f0d483]/75 rounded-xl p-6 sm:p-8 shadow-[0_20px_48px_rgba(2,8,23,0.55)] flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#f0d483] tracking-wide">
                <span>Official Portal Entry</span>
                <span aria-hidden="true">·</span>
                <span>Academic Year 2026-27</span>
              </div>
              <h2 className="font-manrope text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Get Started
              </h2>
              <p className="text-sm text-blue-100/85 max-w-2xl leading-relaxed">
                Enter the Placement Bridge overview to inspect campus architecture, verify cohort
                eligibility, and access student or administrator login gateways.
              </p>
            </div>

            <button
              id="cover-get-started-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGetStarted();
              }}
              className="px-7 py-3.5 rounded-lg bg-gradient-to-r from-[#f3d98b] via-[#e4bc5a] to-[#cfa038] hover:from-[#f8e3a1] hover:to-[#dbb04a] text-[#06132b] text-sm font-bold shadow-lg shadow-black/30 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3d98b]"
            >
              Get Started →
            </button>
          </div>
        </div>
      </main>

      {/* Quiet Formal Institutional Footer */}
      <footer className="relative z-10 w-full border-t border-[#1e3a6e]/65 bg-[#040d21]/85">
        <div className="max-w-[1140px] mx-auto px-6 sm:px-10 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-200/70 tracking-[0.01em]">
          <span className="font-manrope font-bold text-[#f8fbff] tracking-tight">
            Placement Bridge · Office of Training &amp; Placement
          </span>
          <span>Academic Year 2026-27 · Cryptographically Isolated Student &amp; TPO Gateways</span>
        </div>
      </footer>
    </div>
  );
};
