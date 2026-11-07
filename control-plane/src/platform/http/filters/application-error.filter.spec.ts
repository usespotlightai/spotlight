import { httpExceptionOf } from '@platform/http/filters/application-error.filter';
import {
  ApplicationError,
  type ApplicationErrorKind,
} from '@shared-kernel/application/errors/application-error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import {
  DomainError,
  type DomainErrorKind,
} from '@shared-kernel/domain/exceptions/domain-error';
import { describe, expect, it } from 'vitest';

class SomeApplicationError extends ApplicationError {
  constructor(readonly kind: ApplicationErrorKind) {
    super('refused');
  }
}

class SomeDomainError extends DomainError {
  constructor(readonly kind: DomainErrorKind) {
    super('refused');
  }
}

const statusOf = (error: unknown): number => {
  try {
    rethrowAsApplicationError(error);
  } catch (thrown) {
    return thrown instanceof ApplicationError
      ? httpExceptionOf(thrown).getStatus()
      : 500;
  }
  return 500;
};

describe('the HTTP status of an error', () => {
  it.each([
    ['conflict', 409],
    ['invalid', 422],
    ['not-allowed', 403],
    ['not-found', 404],
    ['upstream-error', 502],
  ] as const)(
    'answers an application error of kind %s with %i',
    (kind, status) => {
      expect(statusOf(new SomeApplicationError(kind))).toBe(status);
    },
  );

  it.each([
    ['conflict', 409],
    ['invalid', 422],
    ['not-allowed', 403],
    ['not-found', 404],
    ['internal', 500],
  ] as const)('answers a domain error of kind %s with %i', (kind, status) => {
    expect(statusOf(new SomeDomainError(kind))).toBe(status);
  });

  it('answers any other error with 500', () => {
    expect(statusOf(new Error('broken'))).toBe(500);
  });
});
