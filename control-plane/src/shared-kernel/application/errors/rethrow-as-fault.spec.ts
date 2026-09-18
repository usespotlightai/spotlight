import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { describe, expect, it } from 'vitest';

class BrokenRule extends Error {
  readonly violation = 'invalid';
}

class RefusedUpstream extends Error {
  readonly violation = 'refused';
}

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
    const fault = thrown(new BrokenRule('a repository is named owner/name'));

    expect(fault).toBeInstanceOf(UseCaseFault);
    expect(fault.kind).toBe('invalid-input');
  });

  it('carries what an upstream refused, and why', () => {
    const fault = thrown(
      new RefusedUpstream(
        'GitHub would not open the pull request: Resource not accessible by integration',
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
