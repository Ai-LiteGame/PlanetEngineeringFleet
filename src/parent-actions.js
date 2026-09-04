import {
  clearActiveLesson,
  clearActiveStage,
  exportProgress,
  resetProgress,
} from './storage.js';

const PARENT_TABS = ['course', 'settings'];

export function nextParentTab(current, key) {
  const currentIndex = Math.max(0, PARENT_TABS.indexOf(current));
  if (key === 'Home') return PARENT_TABS[0];
  if (key === 'End') return PARENT_TABS.at(-1);
  if (key === 'ArrowRight') return PARENT_TABS[(currentIndex + 1) % PARENT_TABS.length];
  if (key === 'ArrowLeft') {
    return PARENT_TABS[(currentIndex - 1 + PARENT_TABS.length) % PARENT_TABS.length];
  }
  return PARENT_TABS[currentIndex];
}

export function nextResetConfirmation(armed) {
  return armed
    ? { armed: false, confirmed: true }
    : { armed: true, confirmed: false };
}

export function resetGameStorage(storage) {
  return [
    resetProgress(storage),
    clearActiveLesson(storage),
    clearActiveStage(storage),
  ].every(Boolean);
}

export function downloadProgressJson(progress, environment = globalThis) {
  const blob = new environment.Blob(
    [exportProgress(progress)],
    { type: 'application/json' },
  );
  const url = environment.URL.createObjectURL(blob);
  const anchor = environment.document.createElement('a');
  anchor.href = url;
  anchor.download = 'planet-engineering-progress.json';
  environment.document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    environment.URL.revokeObjectURL(url);
  }
}
