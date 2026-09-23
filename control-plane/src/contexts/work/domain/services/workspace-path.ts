const SEPARATOR = '/';

export const workspacePath = (
  path: string,
  folders: readonly string[],
): string | null => {
  const parts = path.replaceAll('\\', SEPARATOR).split(SEPARATOR);

  if (parts.includes('..')) {
    return null;
  }

  const kept = parts.filter((each) => each !== '' && each !== '.');
  const at = kept.findIndex((each) => folders.includes(each));

  if (at >= 0 && kept.length > at + 1) {
    return kept.slice(at).join(SEPARATOR);
  }

  return null;
};
