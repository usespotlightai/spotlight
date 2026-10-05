const BACK =
  /^\/w\/[A-Za-z0-9-]+\/(inbox|settings)(\/[A-Za-z0-9_~:-][A-Za-z0-9._~:-]*)*$/;

export const landingBack = (asked: string | null | undefined): string | null =>
  typeof asked === 'string' && asked.length <= 512 && BACK.test(asked)
    ? asked
    : null;
