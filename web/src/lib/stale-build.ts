const RELOADED_AT = 'spotlight:stale-build-reloaded-at';
const RELOAD_GAP_MS = 10_000;

const reloadAllowed = (storage: Storage, at: number): boolean => {
  try {
    if (at - Number(storage.getItem(RELOADED_AT) ?? 0) < RELOAD_GAP_MS) {
      return false;
    }
    storage.setItem(RELOADED_AT, String(at));
    return true;
  } catch {
    return false;
  }
};

export const reloadOnStaleBuild = (
  target: Window = window,
  now: () => number = Date.now,
): void => {
  target.addEventListener('vite:preloadError', (event) => {
    if (!reloadAllowed(target.sessionStorage, now())) {
      return;
    }

    event.preventDefault();
    target.location.reload();
  });
};
