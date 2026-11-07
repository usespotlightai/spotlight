export type DomainErrorKind =
  | 'conflict'
  | 'invalid'
  | 'not-allowed'
  | 'not-found'
  | 'internal';

export type RefusalKind = Exclude<DomainErrorKind, 'internal'>;

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  isRefusal(): this is DomainError & { readonly kind: RefusalKind } {
    return this.kind !== 'internal';
  }
}
