import type { ShippedSkillsPort } from '@configuration/application/ports/shipped-skills.port';
import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';
import { BuiltInSkills } from '@configuration/application/services/built-in-skills.service';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { describe, expect, it } from 'vitest';

const HANDOVER: SkillFolder = {
  skill: Skill.shipped({
    key: SkillKey.of('spotlight-handover'),
    description: 'Handing a task on.',
    instructions: 'Write the note.',
    tools: [ToolName.of('pull-request')],
  }),
  files: [{ path: 'SKILL.md', text: 'Write the note.' }],
};

const shipped: ShippedSkillsPort = {
  named: (key) => (key === 'spotlight-handover' ? HANDOVER : null),
};

describe('BuiltInSkills', () => {
  it('hands Work a skill Spotlight ships, in plain words', () => {
    expect(new BuiltInSkills(shipped).named('spotlight-handover')).toEqual({
      skill: {
        key: 'spotlight-handover',
        description: 'Handing a task on.',
        tools: ['pull-request'],
      },
      files: [{ path: 'SKILL.md', text: 'Write the note.' }],
    });
  });

  it('hands nothing for a skill Spotlight does not ship', () => {
    expect(new BuiltInSkills(shipped).named('our-migrations')).toBeNull();
  });
});
