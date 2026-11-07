const SEPARATOR = '/';

export interface ChangedPaths {
  readonly checkouts: readonly string[];
  readonly paths: readonly string[];
}

export const workspacePath = (
  path: string,
  folders: readonly string[],
): string | null => {
  const parts = path.replaceAll('\\', SEPARATOR).split(SEPARATOR);

  if (parts.includes('..')) {
    return null;
  }

  const remaining = parts.filter((each) => each !== '' && each !== '.');
  const at = remaining.findIndex((each) => folders.includes(each));

  if (at >= 0 && remaining.length > at + 1) {
    return remaining.slice(at).join(SEPARATOR);
  }

  return null;
};

export const workspacePathsIn = (changed: ChangedPaths): string[] =>
  changed.paths.flatMap((path) => {
    const within = workspacePath(path, changed.checkouts);
    return within ? [within] : [];
  });
