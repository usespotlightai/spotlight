import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { HarnessReviewOfWork } from '@configuration/infrastructure/acl/harness-review.adapter';
import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import { describe, expect, it } from 'vitest';

const READ = {
  key: ProfileKey.of('careful'),
  settings: ProfileSettings.written({
    permissions: {
      allow: ['read', 'execute(npm test *)'],
      ask: ['execute(git push *)'],
      deny: [],
    },
    mcpServers: [],
    native: {},
  }),
};

const reviewing = (warnings: readonly HarnessNote[]) =>
  new HarnessReviewOfWork({
    review: () => ({ problems: [], warnings }),
  }).review(READ).warnings;

describe('what Work says of a harness profile, in Configuration’s fields', () => {
  it('addresses a rule where the profile wrote it', () => {
    const [noted] = reviewing([
      {
        about: 'rule',
        harness: 'cursor',
        rule: { decision: 'allow', kind: 'execute', pattern: 'npm test *' },
        reason: 'Cursor matches a command by its first word',
      },
    ]);

    expect(noted?.at.segments).toEqual(['permissions', 'allow', 1]);
    expect(noted?.reason).toBe('Cursor matches a command by its first word');
  });

  it('addresses native settings and MCP servers under their own fields', () => {
    expect(
      reviewing([
        {
          about: 'native',
          harness: 'codex',
          path: ['approval_policy'],
          reason: 'is replaced',
        },
        { about: 'mcp-servers', harness: 'cursor', reason: 'may not load' },
      ]).map((each) => each.at.segments),
    ).toEqual([['native', 'codex', 'approval_policy'], ['mcpServers']]);
  });
});
