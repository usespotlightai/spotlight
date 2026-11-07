import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import {
  DomainError,
  type RefusalKind,
} from '@shared-kernel/domain/exceptions/domain-error';
import { failedReactionOf } from '@work/application/services/happenings-reaction';
import { describe, expect, it } from 'vitest';

class Refused extends DomainError {
  constructor(
    readonly kind: RefusalKind,
    message: string,
  ) {
    super(message);
  }
}

describe('failedReactionOf', () => {
  it.each<[string, unknown, boolean]>([
    [
      'a service that cannot be reached yet',
      new UpstreamError('reading', 'it did not answer'),
      true,
    ],
    [
      'a service that refuses for good',
      new UpstreamError('reading', 'it said no', 400, false),
      false,
    ],
    ['a change made at the same time', new Refused('conflict', 'later'), true],
    ['a word that names no task', new Refused('invalid', 'no task'), false],
    ['a word it may not act on', new Refused('not-allowed', 'no'), false],
    ['a word about nothing it knows', new Refused('not-found', 'gone'), false],
  ])('says whether %s may pass', (_, thrown, transient) => {
    expect(failedReactionOf(thrown)).toMatchObject({
      kind: 'failed',
      transient,
    });
  });

  it('has no answer for a failure it does not know', () => {
    expect(failedReactionOf(new TypeError('a bug'))).toBeNull();
  });
});
