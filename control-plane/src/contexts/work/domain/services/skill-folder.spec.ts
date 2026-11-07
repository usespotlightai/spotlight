import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { skillFolderOf } from '@work/domain/services/skill-folder';
import { describe, expect, it } from 'vitest';

describe('skillFolderOf', () => {
  it('keeps a team skill in a folder named by its key', () => {
    expect(skillFolderOf(SkillKey.of('triage'))).toBe('triage');
  });

  it('keeps a catalogued skill in a folder of its own, without its version', () => {
    expect(skillFolderOf(SkillKey.of('catalog.research@1.0.0'))).toBe(
      'spotlight-catalog-research',
    );
  });
});
