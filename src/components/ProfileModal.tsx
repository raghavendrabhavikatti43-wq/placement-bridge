import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';
import { getAvatarBgClass } from './AvatarEditorModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
  onUpdateProfile: (updated: StudentProfile) => void;
  onOpenAvatarEditor: () => void;
  onNavigateFullProfile: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onOpenAvatarEditor,
  onNavigateFullProfile,
}) => {
  const [cgpa, setCgpa] = useState(profile.cgpa.toString());
  const [backlogs, setBacklogs] = useState(profile.activeBacklogs.toString());
  const [targetRole, setTargetRole] = useState(profile.targetRole);
  const [savedMessage, setSavedMessage] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setCgpa(profile.cgpa.toString());
    setBacklogs(profile.activeBacklogs.toString());
    setTargetRole(profile.targetRole);
    setAvatarFailed(false);
  }, [profile]);

  if (!isOpen) return null;

  const initials =
    profile.name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST';

  const hasPhoto = Boolean(profile.avatarUrl) && !avatarFailed;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCgpa = Math.min(10, Math.max(0, parseFloat(cgpa) || profile.cgpa));
    const parsedBacklogs = Math.max(0, parseInt(backlogs, 10) || 0);
    onUpdateProfile({
      ...profile,
      cgpa: parsedCgpa,
      activeBacklogs: parsedBacklogs,
      targetRole,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const handleRemovePhoto = () => {
    onUpdateProfile({
      ...profile,
      avatarUrl: '',
    });
  };

  return (
    <div
      id="profile-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="profile-modal-content"
        className="bg-surface-container-lowest w-full max-w-xl rounded-2xl p-space-lg shadow-xl relative max-h-[90vh] overflow-y-auto flex flex-col gap-space-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-space-sm border-b border-surface-container-low">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onOpenAvatarEditor}
              title="Upload or modify profile picture"
              className="relative group shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              {hasPhoto ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-secondary"
                />
              ) : (
                <div
                  className={`w-14 h-14 rounded-full text-white flex items-center justify-center font-headline-sm font-extrabold ${getAvatarBgClass(
                    profile.avatarBg
                  )}`}
                >
                  {initials}
                </div>
              )}
              <span className="absolute inset-0 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              </span>
            </button>

            <div>
              <h3 className="font-headline-md text-on-surface font-bold">{profile.name}</h3>
              <p className="font-body-sm text-on-surface-variant">
                {profile.degree} {profile.department} · Graduating {profile.gradYear}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={onOpenAvatarEditor}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[14px]">add_a_photo</span>
                  <span>{hasPhoto ? 'Change / Modify Photo' : 'Add Profile Picture'}</span>
                </button>
                {hasPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2 py-1 rounded-lg text-error hover:bg-error-container/30 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {savedMessage && (
          <div className="p-2.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Profile credentials saved and recalculated across all campus drives.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 font-body-sm">
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Academic CGPA
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-mono font-bold focus:border-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Active Backlogs
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={backlogs}
                onChange={(e) => setBacklogs(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-mono font-bold focus:border-secondary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Target Career Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-body-md focus:border-secondary outline-none"
            />
          </div>

          <div className="bg-surface-container-low p-3.5 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-on-surface">Verified Credentials</span>
              <span className="text-secondary font-bold">{profile.certifications.length} Verified</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.certifications.map((cert, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface text-xs font-medium border border-surface-container"
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container-low">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateFullProfile();
              }}
              className="text-xs text-secondary font-bold hover:underline"
            >
              Open Full Portfolio Editor →
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md hover:bg-secondary-container transition-colors font-bold"
              >
                Update Credentials
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
