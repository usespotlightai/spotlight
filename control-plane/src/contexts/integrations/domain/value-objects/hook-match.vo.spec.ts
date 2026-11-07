import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import {
  pullRequestMerged,
  pullRequestOpening,
  taskMoved,
  usedTool,
} from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import {
  HookMatch,
  pathPattern,
} from '@integrations/domain/value-objects/hook-match.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { describe, expect, it } from 'vitest';

const NOTHING = {
  tools: [],
  lines: [],
  stations: [],
  repositories: [],
  paths: [],
};

const TASK = {
  line: LineKey.of('delivery'),
  stationKey: StationKey.of('implementation'),
  repositories: [Repository.of('acme/api'), Repository.of('acme/web')],
};

const matching = (
  on: string,
  fields: Partial<Parameters<typeof HookMatch.written>[0]>,
) => HookMatch.written({ ...NOTHING, ...fields }, HookEvent.of(on));

const refused = (
  on: string,
  fields: Partial<Parameters<typeof HookMatch.written>[0]>,
) => {
  try {
    matching(on, fields);
  } catch (error) {
    return error instanceof InvalidHookError ? error.at.rendered : error;
  }

  return null;
};

describe('HookMatch', () => {
  it('matches anything when it names nothing', () => {
    expect(
      HookMatch.anything(HookEvent.of('task.moved')).matches(TASK, taskMoved()),
    ).toBe(true);
  });

  it('matches the tools it names, and no other', () => {
    const match = matching('tool.used', {
      tools: [ToolName.of('grafana.search')],
    });

    expect(match.matches(TASK, usedTool('grafana.search'))).toBe(true);
    expect(match.matches(TASK, usedTool('grafana.dashboard'))).toBe(false);
    expect(match.matches(TASK, usedTool('shell'))).toBe(false);
  });

  it('names each tool once', () => {
    expect(
      matching('tool.used', {
        tools: [ToolName.of('grafana.search'), ToolName.of('grafana.search')],
      }).tools,
    ).toHaveLength(1);
  });

  it('matches the lines and stations of the task', () => {
    expect(
      matching('task.moved', { lines: ['delivery'] }).matches(
        TASK,
        taskMoved(),
      ),
    ).toBe(true);
    expect(
      matching('task.moved', { lines: ['triage'] }).matches(TASK, taskMoved()),
    ).toBe(false);
    expect(
      matching('task.moved', { stations: ['implementation'] }).matches(
        TASK,
        taskMoved(),
      ),
    ).toBe(true);
    expect(
      matching('task.moved', { stations: ['review-code'] }).matches(
        TASK,
        taskMoved(),
      ),
    ).toBe(false);
  });

  it('matches a repository of the task, or of the change for a change event', () => {
    expect(
      matching('task.moved', { repositories: ['acme/web'] }).matches(
        TASK,
        taskMoved(),
      ),
    ).toBe(true);
    expect(
      matching('task.moved', { repositories: ['acme/ops'] }).matches(
        TASK,
        taskMoved(),
      ),
    ).toBe(false);

    const merged = matching('pull-request.merged', {
      repositories: ['acme/web'],
    });

    expect(merged.matches(TASK, pullRequestMerged('acme/web'))).toBe(true);
    expect(merged.matches(TASK, pullRequestMerged('acme/api'))).toBe(false);
  });

  it('matches changed paths by glob, and a folder by its prefix', () => {
    const match = matching('pull-request.opening', {
      paths: ['db/migrations/'],
    });

    expect(
      match.matches(
        TASK,
        pullRequestOpening(['src/app.ts', 'db/migrations/0042_add.sql']),
      ),
    ).toBe(true);
    expect(match.matches(TASK, pullRequestOpening(['src/app.ts']))).toBe(false);
    expect(match.matches(TASK, pullRequestOpening([]))).toBe(false);
  });

  it('refuses tools on an event about no tool, and paths on an event about no change', () => {
    expect(
      refused('task.moved', { tools: [ToolName.of('grafana.search')] }),
    ).toBe('match.tools');
    expect(refused('tool.used', { paths: ['db/**'] })).toBe('match.paths');
  });

  it('refuses a line, station, repository or path it cannot read', () => {
    expect(refused('task.moved', { lines: ['Delivery'] })).toBe(
      'match.lines[0]',
    );
    expect(refused('task.moved', { stations: ['a b'] })).toBe(
      'match.stations[0]',
    );
    expect(refused('task.moved', { stations: ['review'] })).toBe(
      'match.stations[0]',
    );
    expect(refused('task.moved', { repositories: ['acme'] })).toBe(
      'match.repositories[0]',
    );
    expect(refused('pull-request.merged', { paths: [''] })).toBe(
      'match.paths[0]',
    );
  });

  it('is for the event it was written for', () => {
    expect(matching('task.moved', {}).isFor(HookEvent.of('task.moved'))).toBe(
      true,
    );
    expect(matching('task.moved', {}).isFor(HookEvent.of('run.ended'))).toBe(
      false,
    );
  });

  it('equals a match naming the same', () => {
    expect(
      matching('task.moved', { lines: ['delivery'] }).equals(
        matching('task.moved', { lines: ['delivery'] }),
      ),
    ).toBe(true);
    expect(
      matching('task.moved', { lines: ['delivery'] }).equals(
        matching('task.moved', { lines: ['triage'] }),
      ),
    ).toBe(false);
  });
});

describe('pathPattern', () => {
  it.each([
    ['db/migrations/**', 'db/migrations/a/b.sql', true],
    ['db/migrations/*', 'db/migrations/a/b.sql', false],
    ['db/migrations/', 'db/migrations/a.sql', true],
    ['**/*.sql', 'db/x.sql', true],
    ['src/?.ts', 'src/a.ts', true],
    ['a.b', 'axb', false],
  ])('%s against %s is %s', (glob, path, matched) => {
    expect(pathPattern(glob).test(path)).toBe(matched);
  });
});
