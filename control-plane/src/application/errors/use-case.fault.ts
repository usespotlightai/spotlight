export type UseCaseFaultKind = 'conflict' | 'invalid-input';

export class UseCaseFault extends Error {
  constructor(
    readonly kind: UseCaseFaultKind,
    message: string,
  ) {
    super(message);
    this.name = 'UseCaseFault';
  }
}
