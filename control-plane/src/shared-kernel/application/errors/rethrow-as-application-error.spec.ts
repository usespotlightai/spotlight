import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import { describe, expect, it } from 'vitest';

class BrokenRule extends Error {
  readonly violation = 'invalid';
}

class UpstreamFailure extends Error {
  readonly violation = 'upstream-error';
}

const thrown = (error: unknown): ApplicationError => {
  try {
    rethrowAsApplicationError(error);
  } catch (caught) {
    return caught as ApplicationError;
  }

  throw new Error('nothing was thrown');
};

describe('rethrowAsApplicationError', () => {
  it('carries a broken rule as the kind it broke', () => {
    const error = thrown(new BrokenRule('a repository is named owner/name'));

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.kind).toBe('invalid');
  });

  it('carries the error of an upstream service, and why', () => {
    const error = thrown(
      new UpstreamFailure(
        'GitHub would not open the pull request: Resource not accessible by integration',
      ),
    );

    expect(error.kind).toBe('upstream-error');
    expect(error.message).toContain('Resource not accessible by integration');
  });

  it('leaves anything it does not know to be a rule violation', () => {
    const surprise = new Error('the disk melted');

    expect(() => rethrowAsApplicationError(surprise)).toThrow(surprise);
  });
});
