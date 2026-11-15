export const ALL_CLAIMS = 1;

const LEEWAY = 1e-9;

export const isShare = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export const isPassThreshold = (value: number): boolean =>
  Number.isFinite(value) && value > 0 && value <= 1;

export const claimShareOf = (claimResults: readonly boolean[]): number =>
  claimResults.length === 0
    ? 0
    : claimResults.filter(Boolean).length / claimResults.length;

export const passesAt = (share: number, passThreshold: number): boolean =>
  share + LEEWAY >= passThreshold;

export const claimsPass = (
  claimResults: readonly boolean[],
  passThreshold: number,
): boolean =>
  claimResults.length > 0 &&
  passesAt(claimShareOf(claimResults), passThreshold);
