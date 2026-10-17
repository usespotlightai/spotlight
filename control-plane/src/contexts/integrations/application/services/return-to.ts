const RETURN_PATH =
  /^\/w\/[A-Za-z0-9-]+\/(inbox|settings)(\/[A-Za-z0-9_~:-][A-Za-z0-9._~:-]*)*$/;

export const returnPathOf = (
  requested: string | null | undefined,
): string | null =>
  typeof requested === 'string' &&
  requested.length <= 512 &&
  RETURN_PATH.test(requested)
    ? requested
    : null;
