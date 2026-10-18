import { Skill } from '@configuration/domain/entities/skill.entity';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { describe, expect, it } from 'vitest';

const LIMITS = { files: 2, characters: 100 };

const defined = (over: {
  named?: unknown;
  files?: number;
  characters?: number;
}) =>
  Skill.define({
    key: SkillKey.of('frontend'),
    ...('named' in over ? { named: over.named } : {}),
    description: 'Building the web app.',
    instructions: 'Use the design system.',
    folder: {
      files: over.files ?? 1,
      characters: over.characters ?? 10,
      limits: LIMITS,
    },
    secrets: [],
    tools: [],
  });

describe('Skill', () => {
  it('is named for its folder', () => {
    expect(defined({ named: 'frontend' }).key.value).toBe('frontend');
    expect(() => defined({ named: 'backend' })).toThrow(
      /must be named frontend in its frontmatter/,
    );
    expect(() => defined({ named: undefined })).toThrow(InvalidSkillError);
  });

  it('rejects a folder that contains more than a run receives', () => {
    expect(() => defined({ files: 3 })).toThrow(/more than 2 files/);
    expect(() => defined({ characters: 101 })).toThrow(
      /more than 100 characters/,
    );
  });
});
