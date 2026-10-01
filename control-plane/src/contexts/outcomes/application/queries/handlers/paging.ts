const DEFAULT_SIZE = 50;
const MOST_SIZE = 200;

export const sizeOf = (asked: number | null): number =>
  asked !== null && Number.isInteger(asked) && asked > 0
    ? Math.min(asked, MOST_SIZE)
    : DEFAULT_SIZE;

export const pageOf = (asked: number | null): number =>
  asked !== null && Number.isInteger(asked) && asked > 0 ? asked : 1;
