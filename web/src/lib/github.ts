/**
 * What Spotlight has to remember while somebody is away on GitHub.
 *
 * The App's setup URL is one address for every workspace, so where a person
 * came from travels with them and comes back in the query. It names nothing
 * secret: the control-plane asks GitHub who administers the installation
 * before it believes any of this.
 */
export type Whence = {
  slug: string;
  teamId: string;
  /** The page they left, so they are put back on it rather than near it. */
  from?: string;
};

export const stateFor = ({ slug, teamId, from }: Whence): string =>
  [slug, teamId, from ? encodeURIComponent(from) : '']
    .join(':')
    .replace(/:$/, '');

/**
 * A path this application may send somebody to.
 *
 * Everything here came back through GitHub in a query string, where anybody
 * could have written it. One leading slash and no second one: that is a page
 * of this site, and anything else is somewhere else wearing the shape of one.
 */
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

/** Where a person is sent to install it, carrying where they came from. */
export const installUrlFor = (base: string, whence: Whence): string => {
  const url = new URL(base);
  url.searchParams.set('state', stateFor(whence));

  return url.toString();
};
