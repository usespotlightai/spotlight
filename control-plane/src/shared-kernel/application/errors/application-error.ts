export type ApplicationErrorKind =
  | 'conflict'
  | 'invalid'
  | 'not-allowed'
  | 'not-found'
  | 'upstream-error';

export abstract class ApplicationError extends Error {
  abstract readonly kind: ApplicationErrorKind;
}
