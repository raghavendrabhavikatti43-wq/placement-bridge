import React from 'react';
import { CompanyDrive, NavigationPath, SkillGapItem, StudentProfile } from '../types';

interface RecommendationsViewProps {
  profile: StudentProfile;
  companies: CompanyDrive[];
  skillGaps: SkillGapItem[];
  onNavigate: (path: NavigationPath) => void;
  onSelectCompany: (company: CompanyDrive) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  profile,
  companies,
  skillGaps,
  onNavigate,
  onSelectCompany,
}) => {
  const careerTracks = [
    {
      id: 'track-sde',
      rank: '01',
      title: 'Tier-1 Product Software Engineering (SDE-1 / MTS)',
      fitScore: 86,
      salaryBand: '₹28 – 51 LPA',
      rationale:
        'Strong OOP, Java 21, and distributed queue project credentials meet Day-0 product expectations. Closing Tree/Graph and DP gaps raises conversion probability significantly.',
      targetCompanies: ['Microsoft', 'Oracle Server Tech'],
      actionPath: 'coding-practice' as NavigationPath,
      actionText: 'Launch Technical Code Solving Track',
    },
    {
      id: 'track-consulting',
      rank: '02',
      title: 'Enterprise Cloud & Technology Consulting Analyst',
      fitScore: 91,
      salaryBand: '₹7.5 – 11.5 LPA',
      rationale:
        'Your 80%+ quantitative aptitude and SQL foundation exceed baseline benchmarks across consulting and digital transformation recruiters.',
      targetCompanies: ['Deloitte USI', 'TCS Digital', 'Accenture'],
      actionPath: 'interview-prep' as NavigationPath,
      actionText: 'Practice Techno-Managerial Case Rounds',
    },
    {
      id: 'track-backend',
      rank: '03',
      title: 'Database & Distributed Systems Engineering',
      fitScore: 84,
      salaryBand: '₹18 – 32 LPA',
      rationale:
        'Directly leverages your Redis + PostgreSQL job engine project. Adding SQL Window Functions and WAL concurrency notes makes your resume stand out.',
      targetCompanies: ['Oracle Server Tech', 'Microsoft'],
      actionPath: 'resources' as NavigationPath,
      actionText: 'Open SQL & Systems Handbook',
    },
  ];

  const capstoneIdeas = [
    {
      title: 'Add Prometheus Latency Metrics & Rate Limiter to Chronos Queue',
      closesGap: 'System Design & Concurrency',
      timeRequired: '6 hours weekend build',
      resumeBullet:
        'Implemented token-bucket rate limiting and p99 latency histograms across worker nodes, sustaining 99.94% SLA under burst load.',
    },
    {
      title: 'Query Execution Cost Visualizer for PostgreSQL CTEs',
      closesGap: 'Advanced SQL & Indexing',
      timeRequired: '8 hours weekend build',
      resumeBullet:
        'Built EXPLAIN ANALYZE parser highlighting sequential scan bottlenecks and recommending composite B+ Tree index columns.',
    },
  ];

  const sortedMatches = [...companies].sort((a, b) => b.matchScore - a.matchScore);

  return (
    <div id="recommendations-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-outline block mb-1">
            Placement Engine · Personalized Career Fit
          </span>
          <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
            Role, Recruiter &amp; Upskilling Recommendations
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl mt-1">
            Ranked career tracks and high-ROI portfolio upgrades synthesized from {profile.name}&apos;s CGPA ({profile.cgpa.toFixed(2)}), verified stack, and {skillGaps.length} active gaps.
          </p>
        </div>

        <button
          onClick={() => onNavigate('study-plan')}
          className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0"
        >
          View 3-Week Execution Plan
        </button>
      </div>

      {/* Career Role Tracks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm">
        {careerTracks.map((track) => (
          <div
            key={track.id}
            className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="font-mono font-bold text-outline">{track.rank}. Track Fit</span>
                <span className="font-mono font-bold text-secondary">{track.fitScore}% Fit · {track.salaryBand}</span>
              </div>
              <h2 className="font-headline-sm text-on-surface font-bold leading-snug">
                {track.title}
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {track.rationale}
              </p>
              <div className="text-xs text-outline pt-1">
                <strong className="text-on-surface">Top Recruiters:</strong>{' '}
                {track.targetCompanies.join(', ')}
              </div>
            </div>

            <button
              onClick={() => onNavigate(track.actionPath)}
              className="w-full py-2.5 rounded-xl bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors"
            >
              {track.actionText}
            </button>
          </div>
        ))}
      </div>

      {/* Ranked Company Fit + Portfolio Enhancers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
            <h3 className="font-headline-sm text-on-surface font-bold">
              Algorithmically Ranked Campus Drives
            </h3>
            <span className="text-xs text-outline">Sorted by Composite Match</span>
          </div>

          <div className="divide-y divide-surface-container-low">
            {sortedMatches.map((comp, idx) => (
              <div
                key={comp.id}
                onClick={() => onSelectCompany(comp)}
                className="py-3 flex items-center justify-between gap-3 hover:bg-surface-container-low/50 px-2 rounded-xl cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-outline">0{idx + 1}.</span>
                    <span className="font-bold text-on-surface text-sm">{comp.name}</span>
                    <span aria-hidden="true" className="text-outline">·</span>
                    <span className={comp.isEligible ? 'text-emerald-700 font-semibold' : 'text-error font-semibold'}>
                      {comp.isEligible ? 'Eligible' : `Requires ${comp.minCgpa.toFixed(2)} CGPA`}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {comp.role} · {comp.packageLpa}
                  </p>
                </div>

                <span className="font-mono text-sm font-extrabold text-secondary tabular-nums shrink-0">
                  {comp.matchScore}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-3">
          <div className="pb-2 border-b border-surface-container-low">
            <h3 className="font-headline-sm text-on-surface font-bold">
              Recommended Portfolio Upgrades
            </h3>
            <p className="text-xs text-outline">
              Weekend enhancements to boost technical shortlist conversion
            </p>
          </div>

          <div className="space-y-3">
            {capstoneIdeas.map((idea, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-surface-container-low space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-outline">
                  <span className="font-bold text-secondary">{idea.closesGap}</span>
                  <span>{idea.timeRequired}</span>
                </div>
                <h4 className="font-bold text-on-surface text-sm">{idea.title}</h4>
                <p className="text-on-surface-variant leading-relaxed">
                  <strong>Target Resume Bullet:</strong> &ldquo;{idea.resumeBullet}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
