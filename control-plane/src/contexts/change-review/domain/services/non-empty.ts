export const nonEmpty = (text: string | null | undefined): string | null =>
  text === null || text === undefined || text === '' ? null : text;
