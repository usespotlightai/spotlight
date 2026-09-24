import type { HarnessReview } from '@configuration/application/ports/harness-review.port';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { HarnessProfileCompiler } from '@configuration/infrastructure/profiles/harness-profile.compile';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const HELD = {
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
  it('refuses a profile a harness cannot take when it is written', () => {
    const compiled = DROPPED.compile(HELD);

    expect(compiled.ok).toBe(false);
    expect(
      compiled.ok ? [] : compiled.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['native.gone']);
  });

  it('reads a stored profile back without asking the harnesses again', () => {
    const read = DROPPED.read(HELD);

    expect(read.ok).toBe(true);
    expect(read.ok ? read.settings.permissions : null).toEqual({
      allow: ['read'],
      ask: ['execute(git push *)'],
      deny: [],
    });
  });

  it('refuses a shape that does not read, whichever way it is read', () => {
    const shapeless = { key: 'careful', permissions: { maybe: [] } };

    expect(DROPPED.read(shapeless).ok).toBe(false);
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
      settings: ProfileSettings.written({
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
