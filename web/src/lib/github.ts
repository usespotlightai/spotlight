export type Whence = {
  slug: string;
  teamId: string;
  from?: string;
};

export const stateFor = ({ slug, teamId, from }: Whence): string =>
  [slug, teamId, from ? encodeURIComponent(from) : '']
    .join(':')
    .replace(/:$/, '');

/** Untrusted input from GitHub's query string: only same-site paths pass. */
export const somewhereHere = (path: string | undefined): string | null =>
  path && /^\/(?!\/)/.test(path) && !path.includes('\\') ? path : null;

export const whenceFrom = (state: string | null): Whence | null => {
  const [slug, teamId, from, ...rest] = (state ?? '').split(':');

  if (!slug || !teamId || rest.length > 0) {
    return null;
  }

  const left = from && somewhereHere(decodeURIComponent(from));

  return { slug, teamId, ...(left ? { from: left } : {}) };
};

export const installUrlFor = (base: string, whence: Whence): string => {
  const url = new URL(base);
  url.searchParams.set('state', stateFor(whence));

  return url.toString();
};

export const repositoryFileUrl = (repository: string, path: string): string =>
  `https://github.com/${repository}/blob/HEAD/${path}`;

export const repositoryFolderUrl = (repository: string, path: string): string =>
  `https://github.com/${repository}/tree/HEAD/${path}`;
