type ShellRead = {
  readonly paths: readonly string[];
  readonly key: (key: readonly unknown[]) => boolean;
  readonly ownedBy: RegExp;
};

const SHELL_READS: readonly ShellRead[] = [
  {
    paths: ['/workspaces'],
    key: (key) => key[0] === 'workspaces' && key.length === 1,
    ownedBy: /^$/,
  },
  {
    paths: ['/workspaces/:slug'],
    key: (key) => key[0] === 'workspaces' && key.length === 2,
    ownedBy: /\/settings\/general$/,
  },
  {
    paths: ['/workspaces/:slug/runners', '/workspaces/:slug/runner-activity'],
    key: (key) => key[0] === 'runners',
    ownedBy: /\/settings\/runners/,
  },
  {
    paths: ['/teams/:teamId/lines'],
    key: (key) => key[0] === 'lines',
    ownedBy: /\/lines\//,
  },
];

export const readByShellOnly = (path: string, page: string): boolean =>
  SHELL_READS.some(
    (read) => read.paths.includes(path) && !read.ownedBy.test(page),
  );

export const ownedByPage = (key: readonly unknown[], page: string): boolean =>
  SHELL_READS.some((read) => read.key(key) && read.ownedBy.test(page));
