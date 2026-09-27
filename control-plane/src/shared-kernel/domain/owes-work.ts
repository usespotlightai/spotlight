export interface OwesWork<Self> {
  readonly owesWork: boolean;
  readonly workExhausted: boolean;
  leased(now: Date): Self;
  triedAgainLater(now: Date): Self;
  gaveUp(now: Date): Self;
}
