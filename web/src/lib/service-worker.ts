export const WORKER_URL = '/sw.js';

export const registeredWorker = (): Promise<ServiceWorkerRegistration> =>
  navigator.serviceWorker.register(WORKER_URL);

export const keepAppShell = (): void => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  void registeredWorker().catch(() => undefined);
};
