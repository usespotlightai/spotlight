import type { BuiltInSkillsPort } from '@configuration/application/ports/built-in-skills.port';
import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { describe, expect, it } from 'vitest';

const HANDOVER: SkillFolder = {
  skill: Skill.builtIn({
    key: SkillKey.of('spotlight-handover'),
    description: 'Passing a task on.',
    instructions: 'Write the note.',
    tools: [ToolName.of('pull-request')],
    secrets: [],
  }),
  files: [{ path: 'SKILL.md', text: 'Write the note.' }],
};

const builtIn: BuiltInSkillsPort = {
  named: (key) => (key === 'spotlight-handover' ? HANDOVER : null),
};

describe('BuiltInSkills', () => {
  it('hands Work a built-in skill, in plain words', () => {
    expect(new BuiltInSkills(builtIn).named('spotlight-handover')).toEqual({
      skill: {
        key: 'spotlight-handover',
        description: 'Passing a task on.',
        tools: ['pull-request'],
      },
      files: [{ path: 'SKILL.md', text: 'Write the note.' }],
    });
  });

  it('hands nothing for a skill that is not built in', () => {
    expect(new BuiltInSkills(builtIn).named('our-migrations')).toBeNull();
  });
});
