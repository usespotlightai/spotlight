export interface CurrentReview {
  readonly working: boolean;
}

export const showsReviewing = (current: CurrentReview | null): boolean =>
  current?.working ?? false;
