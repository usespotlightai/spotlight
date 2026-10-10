import { setupWorker } from 'msw/browser';

const RELOADED = 'mock-api-reloaded';

const controlled = () => navigator.serviceWorker?.controller != null;

const takenOver = () =>
  new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => resolve(),
      {
        once: true,
      },
    );
    setTimeout(resolve, 3000);
  });

const reloadedOnce = (): boolean => {
  try {
    if (sessionStorage.getItem(RELOADED)) {
      return false;
    }
    sessionStorage.setItem(RELOADED, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

export const startMockApi = async () => {
  const worker = setupWorker();

  try {
    await worker.start({
      quiet: true,
      onUnhandledRequest: ({ url }) => {
        if (new URL(url).pathname.startsWith('/api/')) {
          console.error(`The mock API has no answer for ${url}.`);
        }
      },
    });
  } catch (failure) {
    console.warn(
      'The mock API is off: its service worker would not start.',
      failure,
    );
    return worker;
  }

  if (!controlled()) {
    await takenOver();
  }
  if (!controlled() && reloadedOnce()) {
    await new Promise(() => undefined);
  }
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {}

  return worker;
};
