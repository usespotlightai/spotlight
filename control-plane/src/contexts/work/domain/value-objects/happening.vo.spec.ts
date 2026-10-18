import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { describe, expect, it } from 'vitest';

describe('Happening', () => {
  it('takes a word named by its integration', () => {
    expect(Happening.of('github.pull_request.merged').value).toBe(
      'github.pull_request.merged',
    );
  });

  it('takes one with space around it', () => {
    expect(Happening.of('  sentry.alert.firing  ').value).toBe(
      'sentry.alert.firing',
    );
  });

  it('says which integration raises it', () => {
    expect(Happening.of('github.pull_request.merged').integration).toBe(
      'github',
    );
    expect(Happening.of('sentry.alert.firing').integration).toBe('sentry');
  });

  it.each(['', '   ', 'merged', 'github.', '.merged', 'github..merged'])(
    'rejects %o, which names no integration',
    (raw) => {
      expect(() => Happening.of(raw)).toThrow(InvalidIdentifierError);
    },
  );

  it.each([
    'GitHub.merged',
    'github.Merged',
    'github.pull request.merged',
    'github.-merged',
  ])('rejects %o, which is not how a word is written', (raw) => {
    expect(() => Happening.of(raw)).toThrow(InvalidIdentifierError);
  });

  it('takes the underscores and dashes integrations actually use', () => {
    expect(Happening.of('github.pull_request.changes-requested').value).toBe(
      'github.pull_request.changes-requested',
    );
  });

  it('is the same word as one written the same way', () => {
    expect(
      Happening.of('github.checks.failed').equals(
        Happening.of('github.checks.failed'),
      ),
    ).toBe(true);
  });

  it('is not the same word as another integration’s', () => {
    expect(
      Happening.of('github.checks.failed').equals(
        Happening.of('buildkite.checks.failed'),
      ),
    ).toBe(false);
  });
});
