import type { BuiltInSkillsPort } from '@configuration/application/ports/built-in-skills.port';
import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { Skill } from '@configuration/domain/value-objects/skill.vo';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const HANDOVER: ReadSkillFolder = {
  skill: Skill.builtIn({
    key: DefinedSkillKey.of('spotlight-handover'),
    description: 'Passing a task on.',
    instructions: 'Write the note.',
    tools: [Tool.of('pull-request')],
    secrets: [],
  }),
  files: [{ path: 'SKILL.md', text: 'Write the note.' }],
};

const builtIn: BuiltInSkillsPort = {
  named: (key) => (key.value === 'spotlight-handover' ? HANDOVER : null),
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
