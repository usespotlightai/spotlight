export interface DesktopApp {
  readonly platform: string;
  setBadge(count: number): void;
  show(): void;
  authorize(url: string): void;
  setTheme?(theme: 'light' | 'dark' | 'system'): void;
  close?(): void;
  openNotificationSettings?(): void;
  onCommand?(listener: (command: string) => void): () => void;
}

declare global {
  interface Window {
    readonly spotlightDesktop?: DesktopApp;
  }
}

const OPENS_IN_DESKTOP_KEY = 'spotlight.opens-in-desktop';
const HANDOFF_SKIPPED_KEY = 'spotlight.desktop-handoff-skipped';

export const desktopApp = (): DesktopApp | null =>
  typeof window === 'undefined' ? null : (window.spotlightDesktop ?? null);

export const framesWindow = (): boolean => desktopApp()?.platform === 'darwin';

export const frameWindow = (): void => {
  if (framesWindow()) {
    document.documentElement.dataset.desktop = 'mac';
  }
};

export const opensInDesktop = (): boolean => {
  try {
    return localStorage.getItem(OPENS_IN_DESKTOP_KEY) === 'true';
  } catch {
    return false;
  }
};

export const storeOpensInDesktop = (opens: boolean): void => {
  try {
    if (opens) {
      localStorage.setItem(OPENS_IN_DESKTOP_KEY, 'true');
    } else {
      localStorage.removeItem(OPENS_IN_DESKTOP_KEY);
    }
  } catch {}
};

export const handoffSkipped = (): boolean => {
  try {
    return sessionStorage.getItem(HANDOFF_SKIPPED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const skipHandoff = (): void => {
  try {
    sessionStorage.setItem(HANDOFF_SKIPPED_KEY, 'true');
  } catch {}
};

let handedOff = false;

export const openInDesktop = (link: string): void => {
  window.location.assign(link);
};

export const handOffOnce = (link: string): void => {
  if (!handedOff) {
    handedOff = true;
    openInDesktop(link);
  }
};

export const desktopLinkOf = (location: {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}): string | null =>
  location.pathname.startsWith('/w/')
    ? `spotlight://open${location.pathname}${location.search}${location.hash}`
    : null;
