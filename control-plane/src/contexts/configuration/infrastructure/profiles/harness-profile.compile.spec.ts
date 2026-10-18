import type { HarnessReview } from '@configuration/application/ports/harness-review.port';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { HarnessProfileCompiler } from '@configuration/infrastructure/profiles/harness-profile.compile';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const DOCUMENT = {
  key: 'careful',
  permissions: { allow: ['read'], ask: ['execute(git push *)'] },
  native: { gone: {} },
};

const reviewed = (review: HarnessReview) =>
  new HarnessProfileCompiler({ review: () => review });

const NATIVE = FieldPath.of(['native', 'gone']);

const DROPPED = reviewed({
  problems: [{ at: NATIVE, reason: 'names no harness Spotlight runs' }],
  warnings: [],
});

describe('HarnessProfileCompiler', () => {
  it('rejects a profile a harness cannot take when it is written', () => {
    const compiled = DROPPED.compile(DOCUMENT);

    expect(compiled.ok).toBe(false);
    expect(
      compiled.ok ? [] : compiled.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['native.gone']);
  });

  it('reads a stored profile back without calling the harnesses again', () => {
    const parsed = DROPPED.parse(DOCUMENT);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.settings.permissions : null).toEqual({
      allow: ['read'],
      ask: ['execute(git push *)'],
      deny: [],
    });
  });

  it('rejects a shape that does not read, whichever way it is read', () => {
    const shapeless = { key: 'careful', permissions: { maybe: [] } };

    expect(DROPPED.parse(shapeless).ok).toBe(false);
    expect(DROPPED.compile(shapeless).ok).toBe(false);
  });

  it('warns where a harness only approximates the profile', () => {
    const [warning] = reviewed({
      problems: [],
      warnings: [
        {
          at: FieldPath.of(['permissions', 'ask', 0]),
          reason: 'is denied there instead',
        },
      ],
    }).warningsOf({
      key: ProfileKey.of('careful'),
      settings: ProfileSettings.fromRaw({
        permissions: { allow: [], ask: ['execute(git push *)'], deny: [] },
        mcpServers: [],
        native: {},
      }),
    });

    expect(warning).toMatchObject({
      path: 'harness-profiles/careful',
      severity: 'warning',
      reason: 'is denied there instead',
    });
    expect(dottedOf(warning?.field)).toBe('permissions.ask.0');
  });
});
