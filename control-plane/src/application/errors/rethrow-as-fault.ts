import {
  UseCaseFault,
  type UseCaseFaultKind,
} from '@application/errors/use-case.fault';

type RuleViolation = Error & { readonly violation: 'conflict' | 'invalid' };

const AS_FAULT: Record<RuleViolation['violation'], UseCaseFaultKind> = {
  conflict: 'conflict',
  invalid: 'invalid-input',
};

const isRuleViolation = (error: unknown): error is RuleViolation =>
  error instanceof Error &&
  'violation' in error &&
  typeof error.violation === 'string' &&
  error.violation in AS_FAULT;

export function rethrowAsFault(error: unknown): never {
  if (isRuleViolation(error)) {
    throw new UseCaseFault(AS_FAULT[error.violation], error.message);
  }

  throw error;
}
