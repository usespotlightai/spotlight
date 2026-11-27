import { nonEmpty } from '@/lib/non-empty';
export type Whence = {
  slug: string;
  teamId: string;
  from?: string;
};

export const stateFor = ({ slug, teamId, from }: Whence): string =>
  [slug, teamId, nonEmpty(from) ? encodeURIComponent(from) : '']
    .join(':')
    .replace(/:$/, '');

export const somewhereHere = (path: string | undefined): string | null =>
  nonEmpty(path) && /^\/(?!\/)/.test(path) && !path.includes('\\')
    ? path
    : null;

export const whenceFrom = (state: string | null): Whence | null => {
  const parts = (state ?? '').split(':');
  const [slug, teamId] = parts;
  const from = parts.at(2);

  if (!slug || !teamId || parts.length > 3) {
    return null;
  }

  const left = nonEmpty(from) ? somewhereHere(decodeURIComponent(from)) : null;

  return {
    slug,
    teamId,
    ...(nonEmpty(left) ? { from: left } : {}),
  };
};

export const installUrlFor = (base: string, whence: Whence): string => {
  const url = new URL(base);
  url.searchParams.set('state', stateFor(whence));

  return url.toString();
};

export const formatRepos = (count: number): string =>
  count === 1 ? '1 repository' : `${count} repositories`;

export const inaccessibleOf = (
  used: readonly string[],
  accessible: readonly string[],
): Set<string> => {
  const accessibleSet = new Set(accessible);

  return new Set(used.filter((each) => !accessibleSet.has(each)));
};
