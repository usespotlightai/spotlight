import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { BuiltInSkillFiles } from '@configuration/infrastructure/skills/built-in-skill-files';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { describe, expect, it } from 'vitest';

const written = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

const readSkill = (folder: string, text: string) =>
  readSkillFolder(folder, [{ path: 'SKILL.md', text }], 'built-in').skill;

const HANDING_OVER = 'spotlight-handover';
const OPENING_PULL_REQUESTS = 'spotlight-pull-request';
const USING_TOOLS = 'spotlight-tools';
const BUILT_IN_SKILL_KEYS = [HANDING_OVER, OPENING_PULL_REQUESTS, USING_TOOLS];

describe('BuiltInSkillFiles', () => {
  const builtIn = new BuiltInSkillFiles(BUILT_IN_SKILL_KEYS);
  const instructionsOf = (key: string) =>
    builtIn.named(key)?.files.find((each) => each.path === 'SKILL.md')?.text ??
    '';

  it('reads every built-in skill', () => {
    for (const key of BUILT_IN_SKILL_KEYS) {
      expect(builtIn.named(key)?.skill.key.value).toBe(key);
    }
  });

  it('says what each is for, under a name only Spotlight uses', () => {
    for (const key of BUILT_IN_SKILL_KEYS) {
      const skill = builtIn.named(key)?.skill;

      expect(skill?.description.length).toBeGreaterThan(20);
      expect(skill?.key.isReserved).toBe(true);
    }
  });

  it('says how to open a pull request', () => {
    const instructions = instructionsOf(OPENING_PULL_REQUESTS);

    expect(instructions).toContain('\n## Opening a pull request');
    expect(instructions).toContain('spotlight tools call pull-request --title');
  });

  it('says how to write a handover note, and leaves what a run must do to its briefing', () => {
    const instructions = instructionsOf(HANDING_OVER);

    expect(instructions).toContain('`--note` is what the next station');
    expect(instructions).toContain('spotlight handover --next');
    expect(instructions).not.toContain('Nobody is watching this terminal');
  });

  it('says how to find, read and call a tool, and that each answers in JSON', () => {
    const instructions = instructionsOf(USING_TOOLS);

    expect(instructions).toContain('spotlight tools search "');
    expect(instructions).toContain('spotlight tools describe ');
    expect(instructions).toContain('--json -');
    expect(instructions).toContain('Every tool answers in JSON');
    expect(instructions).toContain('--intent');
    expect(instructions).toContain('end your turn');
  });

  it('will not start without a built-in skill', () => {
    const directory = mkdtempSync(join(tmpdir(), 'skills-'));
    mkdirSync(join(directory, 'spotlight-pull-request'));
    writeFileSync(
      join(directory, 'spotlight-pull-request', 'SKILL.md'),
      written('spotlight-pull-request', 'Opening pull requests.', 'Run it.'),
    );

    expect(() => new BuiltInSkillFiles(BUILT_IN_SKILL_KEYS, directory)).toThrow(
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

    it('rejects one with no frontmatter', () => {
      expect(() => readSkill('spotlight-example', '# Doing it')).toThrow(
        InvalidSkillError,
      );
    });

    it('rejects one named for another folder', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          written('spotlight-other', 'When to use it.', 'So.'),
        ),
      ).toThrow(/must be named spotlight-example in its frontmatter/);
    });

    it('rejects one that says nothing about when to use it', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          '---\nname: spotlight-example\n---\n\nSo.',
        ),
      ).toThrow(/needs a description/);
    });

    it('rejects one that has nothing to say', () => {
      expect(() =>
        readSkill(
          'spotlight-example',
          written('spotlight-example', 'When to use it.', ''),
        ),
      ).toThrow(/needs instructions/);
    });
  });
});
