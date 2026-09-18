import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { InvalidConfigurationError } from '@configuration/domain/exceptions/invalid-configuration.error';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { ConfiguredIntegration } from '@configuration/domain/value-objects/configured-integration.vo';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const READ_AT = new Date('2026-09-03T08:00:00.000Z');
const TEAM = TeamId.of('team_1');

const file = (path: string, text = 'version: 1') =>
  ConfigurationFile.of(path, text);

const problem = (path: string, reason = 'is not YAML') =>
  ConfigurationProblem.of({ path, at: 'the file', reason });

const linear = (source = 'linear') =>
  ConfiguredIntegration.of({
    source,
    name: 'Linear',
    path: `.spotlight/integrations/${source}.yml`,
    connectable: false,
  });

const read = (files = [file('.spotlight/lines/default/line.yml')]) =>
  TeamConfiguration.read({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    commit: Commit.of('a1b2c3d'),
    files,
    begunAt: READ_AT,
    readAt: READ_AT,
  });

describe('TeamConfiguration', () => {
  it('is a reading: a commit and what was at it', () => {
    const held = read();

    expect(held.repository.value).toBe('acme/api');
    expect(held.commit.value).toBe('a1b2c3d');
    expect(held.files).toHaveLength(1);
    expect(held.isAssessed).toBe(false);
  });

  it('says it was read, with what it holds, so lines can be applied', () => {
    const [event] = read().pullEvents() as ConfigurationRead[];

    expect(event).toBeInstanceOf(ConfigurationRead);
    expect(event?.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/default/line.yml',
    ]);
  });

  it('refuses to hold one path twice', () => {
    expect(() => read([file('a.yml'), file('a.yml', 'version: 2')])).toThrow(
      InvalidConfigurationError,
    );
  });

  it('is assessed once, keeping each problem once, and what it listens to', () => {
    const assessed = read().assessedWith({
      problems: [problem('x.yml'), problem('x.yml')],
      integrations: [linear()],
    });

    expect(assessed.problems).toHaveLength(1);
    expect(assessed.integrations.map((each) => each.source)).toEqual([
      'linear',
    ]);
    expect(assessed.pullEvents()).toEqual([expect.any(ConfigurationRead)]);
    expect(() =>
      assessed.assessedWith({ problems: [], integrations: [] }),
    ).toThrow(InvalidConfigurationError);
  });

  it('refuses an assessment that lists one integration twice', () => {
    expect(() =>
      read().assessedWith({ problems: [], integrations: [linear(), linear()] }),
    ).toThrow(InvalidConfigurationError);
  });

  it('is not a reading to be read back from where it was kept', () => {
    const kept = TeamConfiguration.rehydrate({
      teamId: TEAM,
      repository: Repository.of('acme/api'),
      commit: Commit.of('a1b2c3d'),
      files: [file('a.yml')],
      problems: [problem('a.yml')],
      integrations: [linear()],
      begunAt: READ_AT,
      readAt: READ_AT,
    });

    expect(kept.pullEvents()).toEqual([]);
    expect(kept.isAssessed).toBe(true);
    expect(kept.problems).toHaveLength(1);
  });

  it('refuses to read back one holding a path twice', () => {
    expect(() =>
      TeamConfiguration.rehydrate({
        teamId: TEAM,
        repository: Repository.of('acme/api'),
        commit: Commit.of('a1b2c3d'),
        files: [file('a.yml'), file('a.yml')],
        problems: [],
        integrations: [],
        begunAt: READ_AT,
        readAt: READ_AT,
      }),
    ).toThrow();
  });

  it('remembers when its reading began, so an older reading never replaces a newer one', () => {
    const begunAt = new Date('2026-09-03T07:59:58.000Z');
    const held = TeamConfiguration.read({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      repository: Repository.of('acme/api'),
      commit: Commit.of('a1b2c3d'),
      files: [],
      begunAt,
      readAt: READ_AT,
    });

    expect(held.begunAt).toBe(begunAt);
  });

  it('refuses a reading that finished before it began', () => {
    expect(() =>
      TeamConfiguration.read({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        repository: Repository.of('acme/api'),
        commit: Commit.of('a1b2c3d'),
        files: [],
        begunAt: new Date('2026-09-03T08:00:01.000Z'),
        readAt: READ_AT,
      }),
    ).toThrow(InvalidConfigurationError);
  });
});
