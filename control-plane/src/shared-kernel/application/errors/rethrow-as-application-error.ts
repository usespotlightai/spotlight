import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import {
  ERROR_KINDS,
  type ErrorKind,
} from '@shared-kernel/domain/exceptions/error-kind';

type RuleViolation = Error & { readonly violation: ErrorKind };

const isRuleViolation = (error: unknown): error is RuleViolation =>
  error instanceof Error &&
  'violation' in error &&
  typeof error.violation === 'string' &&
  (ERROR_KINDS as readonly string[]).includes(error.violation);

export function rethrowAsApplicationError(error: unknown): never {
  if (isRuleViolation(error)) {
    throw new ApplicationError(error.violation, error.message);
  }

  throw error;
}
