const WORD = /^[a-z][a-z-]{0,23}$/;

const shapedPath = (path: string): string =>
  path
    .split('/')
    .map((segment) => (segment === '' || WORD.test(segment) ? segment : ':id'))
    .join('/');

export function urlShape<T extends string | undefined>(url: T): T {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${shapedPath(parsed.pathname)}` as T;
  } catch {
    return shapedPath(url.split(/[?#]/, 1)[0] ?? '') as T;
  }
}

export function originOf<T extends string | undefined>(url: T): T {
  if (!url) {
    return url;
  }

  try {
    return new URL(url).origin as T;
  } catch {
    return urlShape(url);
  }
}
