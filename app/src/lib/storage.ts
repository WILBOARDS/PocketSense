import type { Data } from './types';

const KEY = 'pocket-sense:data';
const PHOTO_KEY = 'pocket-sense:goal-photo';

export type LoadResult = { ok: true; data: Data | null } | { ok: false };

/** Returns null data for a first launch. Never deletes what is stored, even when it can't be read. */
export function load(): LoadResult {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ok: true, data: null };
    const data = JSON.parse(raw) as Data;
    if (data?.version !== 1 || !Array.isArray(data.purchases)) return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export function save(data: Data): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadPhoto(): string | null {
  try {
    return localStorage.getItem(PHOTO_KEY);
  } catch {
    return null;
  }
}

export function savePhoto(dataUrl: string | null): boolean {
  try {
    if (dataUrl) localStorage.setItem(PHOTO_KEY, dataUrl);
    else localStorage.removeItem(PHOTO_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Shrinks a picked photo so it fits comfortably in localStorage (~100 KB). */
export function resizePhoto(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}
