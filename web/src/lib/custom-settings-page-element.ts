import type { CustomSettingsPageDto } from '@/lib/api';

// How long a page script has to define its element.
const DEFINE_TIMEOUT_MS = 10_000;

type ImportModule = (url: string) => Promise<unknown>;

const importModule: ImportModule = (url) => import(/* @vite-ignore */ url);

const loads = new Map<string, Promise<void>>();

// The URL of one attempt to load a page script. The browser keeps a failed module import as failed, so each new attempt asks for a different URL. The control plane refuses a script with a query, so the attempt is the only one.
export const scriptUrlOf = (script: string, attempt: number): string =>
  attempt === 0 ? script : `${script}?attempt=${attempt}`;

// Resolves when the element is defined, and fails when the time is over first. cancel stops the timer, for a script that failed to load.
const definedIn = (element: string, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const defined = new Promise<void>((resolve, reject) => {
    timer = setTimeout(
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

  return { defined, cancel: () => clearTimeout(timer) };
};

// Loads the script of a custom settings page once for each attempt, and resolves when its element is defined.
export const loadCustomSettingsPageElement = (
  page: Pick<CustomSettingsPageDto, 'script' | 'element'>,
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

  const definition = definedIn(page.element, timeoutMs);
  const loading = Promise.all([
    load(url).catch((error: unknown) => {
      definition.cancel();
      throw error;
    }),
    definition.defined,
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
