const SEMVER_RELEASE = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

const FINAL = Number.POSITIVE_INFINITY;

const versionOf = (release: string): number[] | null => {
  const parts = SEMVER_RELEASE.exec(release);

  if (!parts) {
    return null;
  }

  const [, major, minor, patch, candidate] = parts;
  return [
    Number(major),
    Number(minor),
    Number(patch),
    candidate === undefined ? FINAL : Number(candidate),
  ];
};

export const isSemverRelease = (release: string): boolean =>
  SEMVER_RELEASE.test(release);

export const isOlderRelease = (release: string, minimum: string): boolean => {
  const have = versionOf(release);
  const need = versionOf(minimum);

  if (!have || !need) {
    return false;
  }

  const differs = have.findIndex((part, at) => part !== need[at]);
  return differs !== -1 && have[differs] < need[differs];
};
