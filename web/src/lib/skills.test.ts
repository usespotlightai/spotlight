import { describe, expect, it } from 'vitest';
import { pointedSkill, skillPath } from '@/lib/skills';

describe('pointing at a skill', () => {
  it('points a skill at its own row on the team’s Skills page', () => {
    expect(skillPath('acme', 'team_1', 'our-migrations')).toBe(
      '/w/acme/settings/team/team_1/skills#skill-our-migrations',
    );
  });

  it('reads back the skill a link points at, and none from another anchor', () => {
    expect(pointedSkill('#skill-our-migrations')).toBe('our-migrations');
    expect(pointedSkill('#step-3')).toBeNull();
    expect(pointedSkill('')).toBeNull();
  });
});
