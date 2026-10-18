import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import {
  ERROR_KINDS,
  type ErrorKind,
} from '@shared-kernel/domain/exceptions/error-kind';

type ErrorWithKind = Error & { readonly kind: ErrorKind };

const hasErrorKind = (error: unknown): error is ErrorWithKind =>
  error instanceof Error &&
  !(error instanceof ApplicationError) &&
  'kind' in error &&
  typeof error.kind === 'string' &&
  (ERROR_KINDS as readonly string[]).includes(error.kind);

export function rethrowAsApplicationError(error: unknown): never {
  if (hasErrorKind(error)) {
    throw new ApplicationError(error.kind, error.message);
  }

  throw error;
}
