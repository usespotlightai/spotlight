export type UseCaseFaultKind =
  | 'conflict'
  | 'invalid-input'
  | 'not-allowed'
  | 'not-found'
  | 'refused-upstream';

export class UseCaseFault extends Error {
  constructor(
    readonly kind: UseCaseFaultKind,
    message: string,
  ) {
    super(message);
    this.name = 'UseCaseFault';
  }
}
