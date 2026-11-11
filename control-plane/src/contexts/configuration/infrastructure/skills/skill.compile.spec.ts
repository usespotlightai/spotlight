import { SkillProblems } from '@configuration/application/rendering/skill-problems';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const MAIN =
  '---\nname: grafana\ndescription: Look up dashboards\nsecrets:\n  GRAFANA_TOKEN: A read-only token\ntools: [grafana.search]\n---\nSearch before you guess.';

const COMPILER = new SkillCompiler();

const invalidAt = (input: unknown) => {
  const compiled = COMPILER.compile(input);

  if (!compiled.ok) {
    return compiled.problems.map((each) => [dottedOf(each.field), each.reason]);
  }

  try {
    COMPILER.skillIn(compiled.key, compiled.files);
    return [];
  } catch (error) {
    if (!(error instanceof InvalidSkillError)) {
      throw error;
    }

    const problem = SkillProblems.invalid(compiled.key.value, error);
    return [[dottedOf(problem.field), problem.reason]];
  }
};

describe('SkillCompiler', () => {
  it('reads a skill from its SKILL.md, keeping every file it contains', () => {
    const compiled = COMPILER.compile({
      key: 'grafana',
      files: { 'SKILL.md': MAIN, 'queries/p99.promql': 'rate(x[5m])' },
    });
    const skill = compiled.ok
      ? COMPILER.skillIn(compiled.key, compiled.files)
      : null;

    expect(skill?.description).toBe('Look up dashboards');
    expect(skill?.tools.map((each) => each.value)).toEqual(['grafana.search']);
    expect(
      compiled.ok && compiled.files.entries.map((each) => each.path),
    ).toEqual(['SKILL.md', 'queries/p99.promql']);
  });

  it('points at the files when there is no SKILL.md', () => {
    expect(
      invalidAt({ key: 'grafana', files: { 'README.md': 'hello' } }),
    ).toEqual([['files', expect.stringContaining('SKILL.md')]]);
  });

  it('points at SKILL.md when what it says does not make a skill', () => {
    expect(
      invalidAt({
        key: 'grafana',
        files: { 'SKILL.md': '---\nname: grafana\n---\nNo description.' },
      }),
    ).toEqual([['files.SKILL.md', expect.stringContaining('description')]]);
  });

  it('rejects a file outside the skill’s folder', () => {
    expect(
      invalidAt({
        key: 'grafana',
        files: { 'SKILL.md': MAIN, '../escape': 'x', '/etc/passwd': 'x' },
      }).map(([at]) => at),
    ).toEqual(['files.../escape', 'files./etc/passwd']);
  });

  it('rejects a key Spotlight reserves for its built-in skills', () => {
    expect(
      invalidAt({ key: 'spotlight-review', files: { 'SKILL.md': MAIN } }),
    ).toEqual([['key', expect.stringContaining('spotlight-')]]);
  });
});
