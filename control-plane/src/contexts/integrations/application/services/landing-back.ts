const BACK =
  /^\/w\/[A-Za-z0-9-]+\/(inbox|settings)(\/[A-Za-z0-9_~:-][A-Za-z0-9._~:-]*)*$/;

export const landingBack = (
  requested: string | null | undefined,
): string | null =>
  typeof requested === 'string' &&
  requested.length <= 512 &&
  BACK.test(requested)
    ? requested
    : null;
