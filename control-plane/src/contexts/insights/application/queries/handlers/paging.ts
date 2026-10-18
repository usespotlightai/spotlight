const DEFAULT_SIZE = 50;
const MAX_SIZE = 200;

export const sizeOf = (requested: number | null): number =>
  requested !== null && Number.isInteger(requested) && requested > 0
    ? Math.min(requested, MAX_SIZE)
    : DEFAULT_SIZE;

export const pageOf = (requested: number | null): number =>
  requested !== null && Number.isInteger(requested) && requested > 0
    ? requested
    : 1;
