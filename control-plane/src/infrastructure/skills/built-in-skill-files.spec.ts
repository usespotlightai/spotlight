import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvalidSkillError } from '@domain/exceptions/invalid-skill.error';
import {
  BUILT_IN_SKILL_KEYS,
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
} from '@domain/services/built-in-skills';
import { BuiltInSkillFiles } from '@infrastructure/skills/built-in-skill-files';
import { readSkillFolder } from '@infrastructure/skills/skill-file';
import { describe, expect, it } from 'vitest';

const written = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

const readSkill = (folder: string, text: string) =>
  readSkillFolder(folder, [{ path: 'SKILL.md', text }], 'shipped').skill;

describe('BuiltInSkillFiles', () => {
  const shipped = new BuiltInSkillFiles();

  it('reads every skill Spotlight ships', () => {
    for (const key of BUILT_IN_SKILL_KEYS) {
      expect(shipped.named(key)?.skill.key.value).toBe(key.value);
    }
  });

  it('says what each is for, under a name only Spotlight uses', () => {
    for (const key of BUILT_IN_SKILL_KEYS) {
      const skill = shipped.named(key)?.skill;

      expect(skill?.description.length).toBeGreaterThan(20);
      expect(skill?.key.isSpotlights).toBe(true);
    }
  });

  it('says how to open a pull request', () => {
    const skill = shipped.named(OPENING_PULL_REQUESTS)?.skill;

    expect(skill?.instructions.startsWith('## Opening a pull request')).toBe(
      true,
    );
    expect(skill?.instructions).toContain('spotlight pull-request --title');
  });

  it('says how to write a handover note, and leaves what a run must do to its briefing', () => {
    const skill = shipped.named(HANDING_OVER)?.skill;

    expect(skill?.instructions).toContain('`--note` is what the next station');
    expect(skill?.instructions).toContain('spotlight handover --next');
    expect(skill?.instructions).not.toContain(
      'Nobody is watching this terminal',
    );
  });

  it('will not start without a skill it ships', () => {
    const directory = mkdtempSync(join(tmpdir(), 'skills-'));
    mkdirSync(join(directory, 'spotlight-pull-request'));
    writeFileSync(
      join(directory, 'spotlight-pull-request', 'SKILL.md'),
      written('spotlight-pull-request', 'Opening pull requests.', 'Run it.'),
    );

    expect(() => new BuiltInSkillFiles(directory)).toThrow(
      /spotlight-handover/,
    );
  });

  describe('reading one SKILL.md', () => {
    it('reads its instructions without its frontmatter', () => {
      const skill = readSkill(
        'spotlight-example',
        written('spotlight-example', 'When to use it.', '## Doing it\n\nSo.'),
      );

      expect(skill.description).toBe('When to use it.');
      expect(skill.instructions).toBe('## Doing it\n\nSo.');
    });

    it('refuses one with no frontmatter', () => {
      expect(() => readSkill('spotlight-example', '# Doing it')).toThrow(
        InvalidSkillError,
      );
    });

    it('refuses one named for another folder', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          written('spotlight-other', 'When to use it.', 'So.'),
        ),
      ).toThrow(/must be named for its folder, spotlight-example/);
    });

    it('refuses one that says nothing about when to use it', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          '---\nname: spotlight-example\n---\n\nSo.',
        ),
      ).toThrow(/give it a description/);
    });

    it('refuses one that has nothing to say', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          written('spotlight-example', 'When to use it.', ''),
        ),
      ).toThrow(/nothing to say/);
    });
  });
});
