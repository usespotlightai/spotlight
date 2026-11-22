import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-21T10:00:00.000Z');

describe('RepositoryStack', () => {
  it('is the same stack for the same repository, whatever its case, started at the same time', () => {
    const api = RepositoryStack.of({
      repository: RepositoryName.of('api'),
      startedAt: AT,
    });

    expect(
      api.equals(
        RepositoryStack.of({
          repository: RepositoryName.of('API'),
          startedAt: new Date(AT),
        }),
      ),
    ).toBe(true);
    expect(
      api.equals(
        RepositoryStack.of({
          repository: RepositoryName.of('api'),
          startedAt: new Date(AT.getTime() + 1),
        }),
      ),
    ).toBe(false);
    expect(
      api.equals(RepositoryStack.of({ repository: null, startedAt: AT })),
    ).toBe(false);
  });

  it('refuses a stack that does not say when it started', () => {
    expect(() =>
      RepositoryStack.of({ repository: null, startedAt: new Date(Number.NaN) }),
    ).toThrow(InvalidChangeStackError);
  });
});
