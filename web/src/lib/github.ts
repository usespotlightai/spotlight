export type Whence = {
  slug: string;
  teamId: string;
  from?: string;
};

export const stateFor = ({ slug, teamId, from }: Whence): string =>
  [slug, teamId, from ? encodeURIComponent(from) : '']
    .join(':')
    .replace(/:$/, '');

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

export const formatRepos = (count: number): string =>
  count === 1 ? '1 repository' : `${count} repositories`;

export const unreachedOf = (
  used: readonly string[],
  reached: readonly string[],
): Set<string> => {
  const reachable = new Set(reached);

  return new Set(used.filter((each) => !reachable.has(each)));
};
