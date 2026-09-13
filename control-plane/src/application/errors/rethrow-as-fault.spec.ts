import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { UseCaseFault } from '@application/errors/use-case.fault';
import { InvalidRepositoryError } from '@domain/exceptions/invalid-repository.error';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { describe, expect, it } from 'vitest';

const thrown = (error: unknown): UseCaseFault => {
  try {
    rethrowAsFault(error);
  } catch (caught) {
    return caught as UseCaseFault;
  }

  throw new Error('nothing was thrown');
};

describe('rethrowAsFault', () => {
  it('carries a broken rule as the kind it broke', () => {
    const fault = thrown(new InvalidRepositoryError('is named owner/name'));

    expect(fault).toBeInstanceOf(UseCaseFault);
    expect(fault.kind).toBe('invalid-input');
  });

  it('carries what an upstream refused, and why', () => {
    const fault = thrown(
      new UpstreamRefusedError(
        'GitHub would not open the pull request',
        'Resource not accessible by integration',
      ),
    );

    expect(fault.kind).toBe('refused-upstream');
    expect(fault.message).toContain('Resource not accessible by integration');
  });

  it('leaves anything it does not know to be a fault', () => {
    const surprise = new Error('the disk melted');

    expect(() => rethrowAsFault(surprise)).toThrow(surprise);
  });
});
