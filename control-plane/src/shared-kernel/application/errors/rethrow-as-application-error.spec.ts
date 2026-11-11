import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

class BrokenRule extends DomainError {
  readonly kind = 'invalid' as const;
}

const thrown = (error: unknown): unknown => {
  try {
    rethrowAsApplicationError(error);
  } catch (caught) {
    return caught;
  }

  throw new Error('nothing was thrown');
};

describe('rethrowAsApplicationError', () => {
  it('translates a broken domain rule into the kind it broke', () => {
    const rule = new BrokenRule('a repository is named owner/name');
    const error = thrown(rule);

    expect(error).toBeInstanceOf(TranslatedDomainError);
    expect(error).toMatchObject({
      kind: 'invalid',
      message: 'a repository is named owner/name',
      refusal: rule,
    });
  });

  it('keeps an application error as it is', () => {
    const upstream = new UpstreamError(
      'Open a pull request',
      'Resource not accessible by integration',
    );

    expect(thrown(upstream)).toBe(upstream);
    expect(upstream).toBeInstanceOf(ApplicationError);
  });

  it('leaves an internal domain error, which no caller can act on', () => {
    const inconsistent = new InconsistentStateError('task', 'has no station');

    expect(thrown(inconsistent)).toBe(inconsistent);
  });

  it('leaves an error that is neither a domain nor an application error', () => {
    const surprise = new Error('the disk melted');

    expect(thrown(surprise)).toBe(surprise);
  });

  it('leaves an error that only looks like a domain error', () => {
    const lookalike = Object.assign(new Error('not one of ours'), {
      kind: 'invalid',
    });

    expect(thrown(lookalike)).toBe(lookalike);
  });
});
