import React, { useState, useEffect } from 'react';
import { CompanyDrive, NavigationPath, SkillGapItem } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  companies: CompanyDrive[];
  skillGaps: SkillGapItem[];
  onClose: () => void;
  onNavigate: (path: NavigationPath) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  companies,
  skillGaps,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.role.toLowerCase().includes(query.toLowerCase())
  );

  const filteredSkills = skillGaps.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const quickPages: { title: string; path: NavigationPath; icon: string; tag: string }[] = [
    { title: 'Dashboard', path: 'dashboard', icon: 'grid_view', tag: 'Overview' },
    { title: 'Campus Companies', path: 'companies', icon: 'apartment', tag: 'Drive Openings' },
    { title: 'Eligibility Checker', path: 'eligibility-checker', icon: 'fact_check', tag: 'Criteria & Simulator' },
    { title: 'Practice Hub (Choose Track)', path: 'practice-hub', icon: 'tune', tag: 'Aptitude or Coding' },
    { title: 'Aptitude Practice Page', path: 'aptitude-practice', icon: 'calculate', tag: 'Screening Questions' },
    { title: 'Technical Code Solving Page', path: 'coding-practice', icon: 'code', tag: 'DSA Sandbox' },
    { title: 'Skill Gap Matrix', path: 'skill-gap', icon: 'troubleshoot', tag: 'Diagnostics' },
    { title: 'Interview Preparation', path: 'interview-prep', icon: 'groups', tag: 'Mock Panel' },
    { title: 'AI Placement Mentor', path: 'ai-assistant', icon: 'smart_toy', tag: 'Live Coaching' },
  ];

  return (
    <div
      id="search-command-palette-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="search-command-palette"
        className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-surface-container-high"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-surface-container-low">
          <span className="material-symbols-outlined text-outline text-[22px] mr-3">search</span>
          <input
            id="search-palette-input"
            autoFocus
            type="text"
            placeholder="Search company drives, skills, assessments, topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-on-surface font-body-md placeholder:text-outline outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-outline bg-surface-container-low rounded border border-outline-variant font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {!query && (
            <div>
              <span className="px-3 py-1 font-label-sm text-outline block">Quick Navigation</span>
              <div className="space-y-1 mt-1">
                {quickPages.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      onNavigate(item.path);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low text-left group transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-outline group-hover:text-secondary text-[20px]">
                        {item.icon}
                      </span>
                      <span className="font-label-lg text-on-surface">{item.title}</span>
                    </div>
                    <span className="text-xs text-outline group-hover:text-on-surface-variant">
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredCompanies.length > 0 && (
            <div>
              <span className="px-3 py-1 font-label-sm text-outline block tabular-nums">
                Companies ({filteredCompanies.length})
              </span>
              <div className="space-y-1 mt-1">
                {filteredCompanies.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => {
                      onNavigate('companies');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low text-left group transition-colors"
                  >
                    <div>
                      <span className="font-label-lg text-on-surface font-semibold block">
                        {comp.name}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {comp.role} · {comp.packageLpa}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-secondary font-bold tabular-nums">
                      {comp.matchScore}% Match
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredSkills.length > 0 && (
            <div>
              <span className="px-3 py-1 font-label-sm text-outline block tabular-nums">
                Skills &amp; Gaps ({filteredSkills.length})
              </span>
              <div className="space-y-1 mt-1">
                {filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      onNavigate('skill-gap');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low text-left group transition-colors"
                  >
                    <div>
                      <span className="font-label-lg text-on-surface font-semibold block">
                        {skill.title}
                      </span>
                      <span className="text-xs text-on-surface-variant">{skill.subtitle}</span>
                    </div>
                    <span className="text-xs text-error font-semibold tabular-nums">
                      {skill.deficitPercentage}% deficit
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && filteredCompanies.length === 0 && filteredSkills.length === 0 && (
            <div className="p-8 text-center text-outline font-body-md">
              No matching companies or competencies found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
