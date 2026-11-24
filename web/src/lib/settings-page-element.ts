import type { SettingsPageDto } from '@/lib/api';

// How long a page script has to define its element.
const DEFINE_TIMEOUT_MS = 10_000;

type ImportModule = (url: string) => Promise<unknown>;

const importModule: ImportModule = (url) => import(/* @vite-ignore */ url);

const loads = new Map<string, Promise<void>>();

// The URL of one attempt to load a page script. The browser keeps a failed module import as failed, so each new attempt asks for a different URL. The control plane refuses a script with a query, so the attempt is the only one.
export const scriptUrlOf = (script: string, attempt: number): string =>
  attempt === 0 ? script : `${script}?attempt=${attempt}`;

const definedIn = (element: string, ms: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`The page script did not define <${element}> in time.`),
        ),
      ms,
    );
    void customElements.whenDefined(element).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });

// Loads the script of a settings page once for each attempt, and resolves when its element is defined.
export const loadSettingsPageElement = (
  page: Pick<SettingsPageDto, 'script' | 'element'>,
  attempt: number,
  load: ImportModule = importModule,
  timeoutMs: number = DEFINE_TIMEOUT_MS,
): Promise<void> => {
  if (customElements.get(page.element)) {
    return Promise.resolve();
  }

  const url = scriptUrlOf(page.script, attempt);
  const known = loads.get(url);

  if (known) {
    return known;
  }

  const loading = Promise.all([
    load(url),
    definedIn(page.element, timeoutMs),
  ]).then(() => undefined);

  loads.set(url, loading);
  return loading;
};

// A path in this app that a page element may ask the app to open: on this origin, never another one.
export const isAppPath = (to: unknown): to is string =>
  typeof to === 'string' &&
  to.startsWith('/') &&
  !to.startsWith('//') &&
  !to.includes('\\');

export const NAVIGATE_EVENT = 'spotlight-navigate';

export const CONTRACT_VERSION = '1';
