import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { InvalidConfigurationError } from '@domain/exceptions/invalid-configuration.error';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const READ_AT = new Date('2026-09-03T08:00:00.000Z');
const TEAM = TeamId.of('team_1');

const file = (path: string, text = 'version: 1') =>
  ConfigurationFile.of(path, text);

const problem = (path: string, reason = 'is not YAML') =>
  ConfigurationProblem.of({ path, at: 'the file', reason });

const read = (
  over: {
    files?: readonly ConfigurationFile[];
    problems?: readonly ConfigurationProblem[];
    repository?: string;
    commit?: string;
  } = {},
) =>
  TeamConfiguration.read({
    teamId: TEAM,
    repository: Repository.of(over.repository ?? 'acme/api'),
    commit: Commit.of(over.commit ?? 'a1b2c3d'),
    files: over.files ?? [file('.spotlight/lines/default/line.yml')],
    problems: over.problems,
    readAt: READ_AT,
  });

describe('TeamConfiguration', () => {
  it('is a reading: a commit, what was at it, and what would not read', () => {
    const held = read({ problems: [problem('x.yml')] });

    expect(held.repository.value).toBe('acme/api');
    expect(held.commit.value).toBe('a1b2c3d');
    expect(held.files).toHaveLength(1);
    expect(held.problems).toHaveLength(1);
  });

  it('refuses to hold one path twice', () => {
    expect(() =>
      read({ files: [file('a.yml'), file('a.yml', 'version: 2')] }),
    ).toThrow(InvalidConfigurationError);
  });

  it('is whole where everything read cleanly', () => {
    expect(read().isWhole).toBe(true);
    expect(read({ problems: [problem('x.yml')] }).isWhole).toBe(false);
  });

  it('is whole where all that was said is a warning', () => {
    const warning = ConfigurationProblem.of({
      path: 'x.yml',
      at: 'on.task.asked.to.thread',
      reason: 'does not check',
      severity: 'warning',
    });

    expect(read({ problems: [warning] }).isWhole).toBe(true);
    expect(read({ problems: [warning, problem('x.yml')] }).isWhole).toBe(false);
  });

  it('is empty where nothing of Spotlight’s was written', () => {
    expect(read({ files: [file('README.md')] }).isEmpty).toBe(true);
    expect(read().isEmpty).toBe(false);
  });

  it('keeps only what is Spotlight’s to read', () => {
    const held = read({
      files: [file('README.md'), file('.spotlight/lines/default/line.yml')],
    });

    expect(held.kept.map((each) => each.path)).toEqual([
      '.spotlight/lines/default/line.yml',
    ]);
  });

  it('finds those beneath one directory of it', () => {
    const held = read({
      files: [
        file('.spotlight/lines/default/line.yml'),
        file('.spotlight/integrations/linear.yml'),
        file('.spotlight/lines/notes.txt'),
      ],
    });

    expect(held.under('.spotlight/lines').map((each) => each.path)).toEqual([
      '.spotlight/lines/default/line.yml',
    ]);
  });

  it('says what is wrong with one file in particular', () => {
    const held = read({
      problems: [problem('a.yml'), problem('b.yml'), problem('a.yml', 'again')],
    });

    expect(held.problemsIn('a.yml')).toHaveLength(2);
    expect(held.problemsIn('c.yml')).toHaveLength(0);
  });

  describe('whether it is newer than another reading', () => {
    it('supersedes a reading of another commit', () => {
      expect(read({ commit: 'e4f5a6b' }).supersedes(read())).toBe(true);
    });

    it('supersedes nothing where the commit is the same', () => {
      expect(read().supersedes(read())).toBe(false);
    });

    it('supersedes a reading of another repository', () => {
      expect(read({ repository: 'acme/other' }).supersedes(read())).toBe(true);
    });

    it('supersedes having read nothing at all', () => {
      expect(read().supersedes(null)).toBe(true);
    });
  });

  it('takes what a later look found wrong', () => {
    const held = read().withProblems([problem('x.yml')]);

    expect(held.problems).toHaveLength(1);
    expect(held.isWhole).toBe(false);
    expect(read().isWhole).toBe(true);
  });

  it('is the same configuration as another of the same team', () => {
    expect(read().equals(read({ commit: 'e4f5a6b' }))).toBe(true);
  });
});
