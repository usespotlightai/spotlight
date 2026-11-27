export const nonEmpty = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== '';
