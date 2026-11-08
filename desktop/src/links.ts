export const SCHEME = 'spotlight';

export const DEFAULT_ADDRESS = 'https://app.usespotlight.ai';

const SIGN_IN_HOSTS: Readonly<Record<string, readonly string[]>> = {
  'github.com': ['/login', '/session', '/sessions/'],
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const EDITOR_SCHEMES = new Set(['vscode:', 'cursor:']);

export type Navigation = 'inside' | 'sign-in' | 'outside' | 'blocked';

const parsed = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

export const originOf = (address: string): string | null => {
  const url = parsed(address.trim());

  if (!url || url.username || url.password) {
    return null;
  }

  const secure = url.protocol === 'https:';
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);

  return secure || local ? url.origin : null;
};

export const navigationOf = (url: string, origin: string): Navigation => {
  const target = parsed(url);

  if (!target) {
    return 'blocked';
  }

  if (target.origin === origin) {
    return 'inside';
  }

  const signIn = SIGN_IN_HOSTS[target.hostname];

  if (
    target.protocol === 'https:' &&
    signIn?.some(
      (path) =>
        target.pathname === path.replace(/\/$/, '') ||
        target.pathname.startsWith(path.endsWith('/') ? path : `${path}/`),
    )
  ) {
    return 'sign-in';
  }

  return target.protocol === 'https:' ||
    target.protocol === 'http:' ||
    target.protocol === 'mailto:' ||
    EDITOR_SCHEMES.has(target.protocol)
    ? 'outside'
    : 'blocked';
};

export const pageOf = (link: string, origin: string): string | null => {
  const url = parsed(link);

  if (!url || url.protocol !== `${SCHEME}:` || url.hostname !== 'open') {
    return null;
  }

  const path = url.pathname || '/';

  if (!path.startsWith('/w/')) {
    return null;
  }

  const page = parsed(`${origin}${path}${url.search}${url.hash}`);

  return page && page.origin === origin ? page.toString() : null;
};

export const isOrigin = (url: string, origin: string): boolean =>
  parsed(url)?.origin === origin;

export const authorizable = (url: string): boolean =>
  parsed(url)?.protocol === 'https:';

export const deepLinkIn = (argv: readonly string[]): string | null =>
  argv.find((each) => each.startsWith(`${SCHEME}://`)) ?? null;
