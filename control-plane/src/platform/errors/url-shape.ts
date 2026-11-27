const WORD = /^[a-z][a-z-]{0,23}$/;

const shapedPath = (path: string): string =>
  path
    .split('/')
    .map((segment) => (segment === '' || WORD.test(segment) ? segment : ':id'))
    .join('/');

export function urlShape(url: string): string;
export function urlShape(url: string | undefined): string | undefined;
export function urlShape(url: string | undefined): string | undefined {
  if (url === undefined || url === '') {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${shapedPath(parsed.pathname)}`;
  } catch {
    return shapedPath(url.split(/[?#]/, 1)[0] ?? '');
  }
}

export function originOf(url: string): string;
export function originOf(url: string | undefined): string | undefined;
export function originOf(url: string | undefined): string | undefined {
  if (url === undefined || url === '') {
    return url;
  }

  try {
    return new URL(url).origin;
  } catch {
    return urlShape(url);
  }
}
