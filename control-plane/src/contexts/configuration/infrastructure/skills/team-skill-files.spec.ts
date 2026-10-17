import { ConfigurationFile } from '@configuration/domain/value-objects/configuration-file.vo';
import { TeamSkillFiles } from '@configuration/infrastructure/skills/team-skill-files';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const SKILL = (name: string, description = 'Writing a migration here.') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\nGenerate it; never write the SQL.\n`;

const file = (path: string, text: string) => ConfigurationFile.of(path, text);

const read = (...files: ConfigurationFile[]) =>
  new TeamSkillFiles().read(files);

const reasons = (found: ReturnType<typeof read>) =>
  found.problems.map((each) =>
    [each.path, dottedOf(each.field)]
      .filter(Boolean)
      .join(' ')
      .concat(`: ${each.reason}`),
  );

describe('TeamSkillFiles', () => {
  it('reads each folder as the skill named for it, laid with every file beside SKILL.md', () => {
    const found = read(
      file(
        '.spotlight/skills/our-migrations/SKILL.md',
        SKILL('our-migrations'),
      ),
      file(
        '.spotlight/skills/our-migrations/examples/add-column.md',
        'Add it.',
      ),
    );

    expect(found.problems).toEqual([]);
    expect(found.skills.map((each) => each.skill.key.value)).toEqual([
      'our-migrations',
    ]);
    expect(found.skills[0]?.skill.description).toBe(
      'Writing a migration here.',
    );
    expect(found.skills[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
      'examples/add-column.md',
    ]);
  });

  it('reads none where the team has none', () => {
    expect(read()).toEqual({ skills: [], problems: [] });
  });

  describe('a skill that will not read', () => {
    it('is left out, and said to be wrong on its SKILL.md', () => {
      const found = read(
        file('.spotlight/skills/our-migrations/SKILL.md', '# No frontmatter'),
        file('.spotlight/skills/frontend/SKILL.md', SKILL('frontend')),
      );

      expect(found.skills.map((each) => each.skill.key.value)).toEqual([
        'frontend',
      ]);
      expect(found.problems).toHaveLength(1);
      expect(found.problems[0]).toMatchObject({
        path: '.spotlight/skills/our-migrations/SKILL.md',
        severity: 'error',
      });
      expect(found.problems[0]?.reason).toContain(
        'needs a name and description between --- lines',
      );
    });

    it('is named for its folder, and nothing else', () => {
      const found = read(
        file('.spotlight/skills/our-migrations/SKILL.md', SKILL('migrations')),
      );

      expect(found.skills).toEqual([]);
      expect(reasons(found)[0]).toContain(
        'must be named our-migrations in its frontmatter',
      );
    });

    it('has a SKILL.md to be read from', () => {
      const found = read(
        file('.spotlight/skills/our-migrations/notes.md', 'Some notes.'),
      );

      expect(reasons(found)).toEqual([
        '.spotlight/skills/our-migrations/notes.md: Skill our-migrations has no SKILL.md in our-migrations.',
      ]);
    });

    it('is stored in a folder named the way skills are', () => {
      const found = read(
        file(
          '.spotlight/skills/Our Migrations/SKILL.md',
          SKILL('Our Migrations'),
        ),
      );

      expect(found.skills).toEqual([]);
      expect(reasons(found)[0]).toContain('lowercase words joined by dashes');
    });

    it('is not named as Spotlight names its own', () => {
      const found = read(
        file(
          '.spotlight/skills/spotlight-handover/SKILL.md',
          SKILL('spotlight-handover'),
        ),
      );

      expect(found.skills).toEqual([]);
      expect(reasons(found)[0]).toContain(
        'cannot start with spotlight-. That prefix is reserved for built-in skills',
      );
    });

    it('contains no more than is laid for a run', () => {
      const found = read(
        file('.spotlight/skills/big/SKILL.md', SKILL('big')),
        ...Array.from({ length: 50 }, (_, at) =>
          file(`.spotlight/skills/big/pages/${at}.md`, 'A page.'),
        ),
      );

      expect(found.skills).toEqual([]);
      expect(reasons(found)[0]).toContain('more than 50 files');
    });
  });

  it('warns of a file stored outside any skill’s folder', () => {
    const found = read(file('.spotlight/skills/README.md', 'Our skills.'));

    expect(found.problems).toMatchObject([
      { path: '.spotlight/skills/README.md', severity: 'warning' },
    ]);
  });
});
