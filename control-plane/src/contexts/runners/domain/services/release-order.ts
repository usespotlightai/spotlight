const DATED_RELEASE = /^(\d{8})-(\d+)$/;

export const isOlderRelease = (release: string, minimum: string): boolean => {
  const have = DATED_RELEASE.exec(release);
  const need = DATED_RELEASE.exec(minimum);

  if (!have || !need) {
    return false;
  }

  return (
    have[1] < need[1] ||
    (have[1] === need[1] && Number(have[2]) < Number(need[2]))
  );
};
