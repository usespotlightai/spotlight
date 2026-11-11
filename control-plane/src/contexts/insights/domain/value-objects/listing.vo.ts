const DEFAULT_SIZE = 50;
const MAX_SIZE = 200;

const positive = (requested: number | null): requested is number =>
  requested !== null && Number.isInteger(requested) && requested > 0;

export const listingSizeOf = (requested: number | null): number =>
  positive(requested) ? Math.min(requested, MAX_SIZE) : DEFAULT_SIZE;

export const listingPageOf = (requested: number | null): number =>
  positive(requested) ? requested : 1;
