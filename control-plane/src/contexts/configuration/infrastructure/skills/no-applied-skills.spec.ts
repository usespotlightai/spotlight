import { randomUUID } from 'node:crypto';
import { NoAppliedSkills } from '@configuration/infrastructure/skills/no-applied-skills';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('NoAppliedSkills', () => {
  it('applies no skill for any team', async () => {
    const teamId = TeamId.of(randomUUID());

    await expect(new NoAppliedSkills().of(teamId)).resolves.toEqual({
      teamId,
      skills: [],
    });
  });
});
