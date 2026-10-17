import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('HappeningName', () => {
  it('takes a word named by its integration', () => {
    expect(HappeningName.of('github.pull_request.merged').value).toBe(
      'github.pull_request.merged',
    );
  });

  it('takes one with space around it', () => {
    expect(HappeningName.of('  sentry.alert.firing  ').value).toBe(
      'sentry.alert.firing',
    );
  });

  it('says which integration raises it', () => {
    expect(HappeningName.of('github.pull_request.merged').integration).toBe(
      'github',
    );
    expect(HappeningName.of('sentry.alert.firing').integration).toBe('sentry');
  });

  it.each(['', '   ', 'merged', 'github.', '.merged', 'github..merged'])(
    'rejects %o, which names no integration',
    (raw) => {
      expect(() => HappeningName.of(raw)).toThrow(InvalidIdentifierError);
    },
  );

  it.each([
    'GitHub.merged',
    'github.Merged',
    'github.pull request.merged',
    'github.-merged',
  ])('rejects %o, which is not how a word is written', (raw) => {
    expect(() => HappeningName.of(raw)).toThrow(InvalidIdentifierError);
  });

  it('takes the underscores and dashes services actually use', () => {
    expect(
      HappeningName.of('github.pull_request.changes-requested').value,
    ).toBe('github.pull_request.changes-requested');
  });

  it('is the same word as one written the same way', () => {
    expect(
      HappeningName.of('github.checks.failed').equals(
        HappeningName.of('github.checks.failed'),
      ),
    ).toBe(true);
  });

  it('is not the same word as another integration’s', () => {
    expect(
      HappeningName.of('github.checks.failed').equals(
        HappeningName.of('buildkite.checks.failed'),
      ),
    ).toBe(false);
  });
});
