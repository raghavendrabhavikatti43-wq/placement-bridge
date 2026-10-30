import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';
import { getAvatarBgClass } from './AvatarEditorModal';

interface MyProfileViewProps {
  profile: StudentProfile;
  onUpdateProfile: (updated: StudentProfile) => void;
  onOpenAvatarEditor: () => void;
  onOpenAtsAudit: () => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onOpenAvatarEditor,
  onOpenAtsAudit,
}) => {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department);
  const [cgpa, setCgpa] = useState(profile.cgpa.toString());
  const [activeBacklogs, setActiveBacklogs] = useState(profile.activeBacklogs.toString());
  const [targetRole, setTargetRole] = useState(profile.targetRole);
  const [leetcodeSolved, setLeetcodeSolved] = useState(profile.leetcodeSolved.toString());
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStack, setProjectStack] = useState('');
  const [projectImpact, setProjectImpact] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [profile.avatarUrl]);

  const initials =
    profile.name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST';

  const hasPhoto = Boolean(profile.avatarUrl) && !avatarError;

  const handleSaveAcademic = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCgpa = Math.min(10, Math.max(0, parseFloat(cgpa) || profile.cgpa));
    const parsedBacklogs = Math.max(0, parseInt(activeBacklogs, 10) || 0);
    const parsedLc = Math.max(0, parseInt(leetcodeSolved, 10) || profile.leetcodeSolved);

    onUpdateProfile({
      ...profile,
      name: name.trim() || profile.name,
      department,
      cgpa: parsedCgpa,
      activeBacklogs: parsedBacklogs,
      targetRole: targetRole.trim() || profile.targetRole,
      leetcodeSolved: parsedLc,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkill.trim();
    if (!trimmed || profile.skills.includes(trimmed)) return;
    onUpdateProfile({
      ...profile,
      skills: [...profile.skills, trimmed],
      profileCompletion: Math.min(100, profile.profileCompletion + 3),
    });
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onUpdateProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  const handleAddCertification = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCert.trim();
    if (!trimmed || profile.certifications.includes(trimmed)) return;
    onUpdateProfile({
      ...profile,
      certifications: [...profile.certifications, trimmed],
      profileCompletion: Math.min(100, profile.profileCompletion + 7),
    });
    setNewCert('');
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim() || !projectImpact.trim()) return;
    onUpdateProfile({
      ...profile,
      projects: [
        ...profile.projects,
        {
          id: `proj-${Date.now()}`,
          title: projectTitle.trim(),
          stack: projectStack.trim() || 'Java, SQL, React',
          impact: projectImpact.trim(),
        },
      ],
      profileCompletion: Math.min(100, profile.profileCompletion + 5),
    });
    setProjectTitle('');
    setProjectStack('');
    setProjectImpact('');
  };

  return (
    <div id="my-profile-view" className="space-y-space-md animate-in fade-in duration-200">
      {/* Top Banner with Interactive Avatar Controls */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            type="button"
            onClick={onOpenAvatarEditor}
            title="Upload or modify profile picture"
            className="relative group w-20 h-20 rounded-2xl overflow-hidden shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {hasPhoto ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover border border-surface-container-high"
              />
            ) : (
              <div
                className={`w-full h-full text-white flex items-center justify-center font-headline-lg font-extrabold ${getAvatarBgClass(
                  profile.avatarBg
                )}`}
              >
                {initials}
              </div>
            )}
            <span className="absolute inset-0 bg-primary/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold gap-0.5">
              <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
              <span>{hasPhoto ? 'Modify' : 'Upload'}</span>
            </span>
          </button>

          <div>
            <span className="font-label-sm text-outline block mb-0.5">
              Verified Institutional Dossier · {profile.collegeName}
            </span>
            <h1 className="font-headline-xl text-on-surface font-extrabold tracking-tight">
              {profile.name}
            </h1>
            <p className="font-body-md text-on-surface-variant">
              {profile.degree} {profile.department} · Batch of {profile.gradYear} · Profile {profile.profileCompletion}% Complete
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                onClick={onOpenAvatarEditor}
                className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>{hasPhoto ? 'Change / Modify Profile Picture' : 'Upload Profile Picture'}</span>
              </button>
              {hasPhoto && (
                <button
                  type="button"
                  onClick={() => onUpdateProfile({ ...profile, avatarUrl: '' })}
                  className="px-2.5 py-1.5 rounded-lg text-error hover:bg-error-container/30 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Remove Picture
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onOpenAtsAudit}
          className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 self-start md:self-center"
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>Run AI ATS Resume Audit</span>
        </button>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-secondary-fixed text-on-secondary-fixed text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Academic dossier saved. Campus company eligibility has been recalculated immediately.
        </div>
      )}

      {/* Split Grid: Academic Form (6-col) + Skills & Certifications (6-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
        <form
          onSubmit={handleSaveAcademic}
          className="lg:col-span-6 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-4"
        >
          <h2 className="font-headline-sm text-on-surface font-bold pb-2 border-b border-surface-container-low">
            Academic &amp; Placement Credentials
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-medium outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-medium outline-none focus:border-secondary"
              >
                <option value="Computer Engg (CSE)">Computer Engg (CSE)</option>
                <option value="Information Tech (IT)">Information Tech (IT)</option>
                <option value="Electronics & Comm (ECE)">Electronics &amp; Comm (ECE)</option>
                <option value="Electrical Engg (EE)">Electrical Engg (EE)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Cumulative GPA (CGPA)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono font-bold outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">Active Backlogs</label>
              <input
                type="number"
                min="0"
                max="10"
                value={activeBacklogs}
                onChange={(e) => setActiveBacklogs(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono font-bold outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">Target Role</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-medium outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Coding Problems Solved
              </label>
              <input
                type="number"
                min="0"
                value={leetcodeSolved}
                onChange={(e) => setLeetcodeSolved(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface font-mono font-bold outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-colors"
            >
              Save Academic Credentials
            </button>
          </div>
        </form>

        {/* Right 6-col: Technical Skills & Certifications */}
        <div className="lg:col-span-6 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-4">
          <div className="space-y-3">
            <h2 className="font-headline-sm text-on-surface font-bold pb-2 border-b border-surface-container-low">
              Verified Technical Skills ({profile.skills.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              {profile.skills.map((sk) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() => handleRemoveSkill(sk)}
                  title="Click to remove skill"
                  className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-error-container hover:text-on-error-container text-xs font-medium text-on-surface transition-colors flex items-center gap-1"
                >
                  <span>{sk}</span>
                  <span className="text-[11px] opacity-60">×</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleAddSkill} className="flex gap-2">
              <input
                type="text"
                placeholder="Add skill (e.g., Docker, GraphQL, Kubernetes)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs text-on-surface outline-none focus:border-secondary"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap shrink-0"
              >
                Add Skill
              </button>
            </form>
          </div>

          <div className="space-y-3 pt-3 border-t border-surface-container-low">
            <h3 className="font-headline-sm text-on-surface font-bold">
              Certifications &amp; Honors ({profile.certifications.length})
            </h3>
            <ul className="space-y-1.5 text-xs text-on-surface-variant">
              {profile.certifications.map((cert, i) => (
                <li
                  key={i}
                  className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between"
                >
                  <span className="font-medium text-on-surface">{cert}</span>
                  <span className="text-secondary font-semibold">Verified</span>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddCertification} className="flex gap-2">
              <input
                type="text"
                placeholder="Add new certification to boost Profile Diagnostic..."
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-xs text-on-surface outline-none focus:border-secondary"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-surface-container-highest text-primary text-xs font-bold hover:bg-surface-container-high transition-colors whitespace-nowrap shrink-0"
              >
                Add Certificate
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Portfolio Projects */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container-low space-y-4">
        <h2 className="font-headline-sm text-on-surface font-bold pb-2 border-b border-surface-container-low">
          Engineering Projects on Resume ({profile.projects.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profile.projects.map((proj) => (
            <div key={proj.id} className="p-4 rounded-xl bg-surface-container-low space-y-1.5 text-xs">
              <h3 className="font-bold text-on-surface text-sm">{proj.title}</h3>
              <span className="text-secondary font-semibold block">{proj.stack}</span>
              <p className="text-on-surface-variant leading-relaxed">{proj.impact}</p>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddProject}
          className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-surface-container-low text-xs"
        >
          <input
            type="text"
            placeholder="Project Title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="md:col-span-3 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
          />
          <input
            type="text"
            placeholder="Tech Stack (e.g., Go, gRPC, PostgreSQL)"
            value={projectStack}
            onChange={(e) => setProjectStack(e.target.value)}
            className="md:col-span-3 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
          />
          <input
            type="text"
            placeholder="Quantified Engineering Impact"
            value={projectImpact}
            onChange={(e) => setProjectImpact(e.target.value)}
            className="md:col-span-4 px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface outline-none focus:border-secondary"
          />
          <button
            type="submit"
            className="md:col-span-2 px-3 py-2 rounded-xl bg-secondary text-on-secondary font-bold hover:bg-secondary-container transition-colors whitespace-nowrap"
          >
            Add Project
          </button>
        </form>
      </div>
    </div>
  );
};
