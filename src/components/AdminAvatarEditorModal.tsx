import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AdminProfile } from '../types';

export const ADMIN_AVATAR_SWATCHES = [
  { key: 'indigo', label: 'Indigo', bgClass: 'bg-indigo-600' },
  { key: 'navy', label: 'Slate Navy', bgClass: 'bg-slate-900' },
  { key: 'royal', label: 'Royal Blue', bgClass: 'bg-blue-700' },
  { key: 'teal', label: 'Deep Teal', bgClass: 'bg-teal-700' },
  { key: 'emerald', label: 'Forest', bgClass: 'bg-emerald-700' },
] as const;

export function getAdminAvatarBgClass(avatarBg?: string): string {
  const found = ADMIN_AVATAR_SWATCHES.find((s) => s.key === avatarBg);
  return found ? found.bgClass : 'bg-indigo-600';
}

interface AdminAvatarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminProfile: AdminProfile;
  onSaveAvatar: (avatarUrl: string, avatarBg: string) => void;
}

const OUTPUT_SIZE = 256;

export const AdminAvatarEditorModal: React.FC<AdminAvatarEditorModalProps> = ({
  isOpen,
  onClose,
  adminProfile,
  onSaveAvatar,
}) => {
  const [sourceImage, setSourceImage] = useState<string>(adminProfile.avatarUrl || '');
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [selectedBg, setSelectedBg] = useState<string>(adminProfile.avatarBg || 'indigo');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSourceImage(adminProfile.avatarUrl || '');
      setSelectedBg(adminProfile.avatarBg || 'indigo');
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
      setBrightness(100);
      setErrorMsg(null);
    }
  }, [isOpen, adminProfile.avatarUrl, adminProfile.avatarBg]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    ctx.filter = `brightness(${brightness}%)`;
    ctx.translate(OUTPUT_SIZE / 2 + offsetX, OUTPUT_SIZE / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);

    const baseScale = Math.max(OUTPUT_SIZE / img.width, OUTPUT_SIZE / img.height);
    const finalScale = baseScale * zoom;
    const drawW = img.width * finalScale;
    const drawH = img.height * finalScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [zoom, offsetX, offsetY, rotation, brightness]);

  useEffect(() => {
    if (!sourceImage) {
      loadedImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImgRef.current = img;
      drawPreview();
    };
    img.onerror = () => {
      setErrorMsg('Unable to load the selected image file. Please select another PNG or JPG.');
    };
    img.src = sourceImage;
  }, [sourceImage, drawPreview]);

  useEffect(() => {
    if (loadedImgRef.current) {
      drawPreview();
    }
  }, [drawPreview]);

  if (!isOpen) return null;

  const initials =
    adminProfile.name
      .split(' ')
      .filter((part) => Boolean(part) && !part.endsWith('.'))
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    adminProfile.name.slice(0, 2).toUpperCase() ||
    'AD';

  const handleFileSelect = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP, or GIF).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Image size must be under 8 MB.');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setSourceImage(result);
        setZoom(1);
        setOffsetX(0);
        setOffsetY(0);
        setRotation(0);
        setBrightness(100);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sourceImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const nextX = Math.max(-140, Math.min(140, e.clientX - dragStart.x));
    const nextY = Math.max(-140, Math.min(140, e.clientY - dragStart.y));
    setOffsetX(nextX);
    setOffsetY(nextY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (sourceImage && canvasRef.current && loadedImgRef.current) {
      const exportedDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
      onSaveAvatar(exportedDataUrl, selectedBg);
    } else {
      onSaveAvatar('', selectedBg);
    }
    onClose();
  };

  const handleRemove = () => {
    setSourceImage('');
    loadedImgRef.current = null;
    onSaveAvatar('', selectedBg);
  };

  return (
    <div
      id="admin-avatar-editor-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="admin-avatar-editor-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
              TPO Administrator Identity
            </span>
            <h3 className="font-headline-md text-slate-900 dark:text-slate-100 font-bold mt-0.5">
              Change &amp; Modify Admin Profile Picture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload an official portrait to crop, zoom, rotate, and adjust—or select an officer
              initials badge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          className="hidden"
        />

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files?.[0]);
          }}
          className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-3"
        >
          {sourceImage ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-44 h-44 rounded-full overflow-hidden ring-4 ring-white dark:ring-slate-800 shadow-md cursor-grab active:cursor-grabbing">
                <canvas
                  ref={canvasRef}
                  width={OUTPUT_SIZE}
                  height={OUTPUT_SIZE}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="w-full h-full object-cover touch-none"
                />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Drag inside the circle to reposition your portrait
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 py-2">
              <div
                className={`w-28 h-28 rounded-full text-white flex items-center justify-center font-headline-xl font-extrabold shadow-xs select-none ${getAdminAvatarBgClass(
                  selectedBg
                )}`}
              >
                {initials}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs">
                No portrait uploaded. Drag &amp; drop an image here or click below to upload from
                your device.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
              <span>{sourceImage ? 'Choose Different Photo' : 'Upload Portrait'}</span>
            </button>

            {sourceImage && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Remove Photo</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {sourceImage ? (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs tabular-nums">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-slate-100">Modify Framing &amp; Tone</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">rotate_right</span>
                  <span>Rotate 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setOffsetX(0);
                    setOffsetY(0);
                    setRotation(0);
                    setBrightness(100);
                  }}
                  className="px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold whitespace-nowrap shrink-0"
                >
                  Reset Edits
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Zoom Scale</label>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Brightness</label>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="75"
                  max="125"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
              Officer Initials Badge Color (When no photo is uploaded)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {ADMIN_AVATAR_SWATCHES.map((sw) => (
                <button
                  key={sw.key}
                  type="button"
                  onClick={() => setSelectedBg(sw.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    selectedBg === sw.key
                      ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/60 text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${sw.bgClass}`} />
                  <span>{sw.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            Save Profile Picture
          </button>
        </div>
      </div>
    </div>
  );
};
