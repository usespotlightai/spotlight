import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { KeptFromReplaysError } from '@memory/domain/exceptions/kept-from-replays.error';
import { KeptFromSearchesError } from '@memory/domain/exceptions/kept-from-searches.error';
import {
  type Remembered,
  type RememberedAt,
  Remembering,
} from '@memory/domain/services/remembering';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

const at = (
  change: {
    steps?: readonly { index: number; kind: string }[];
    cited?: readonly number[];
    fromOutside?: boolean;
  } = {},
): RememberedAt => ({
  site: {
    teamId: TEAM,
    lineId: 'line_1',
    stationId: 'station_1',
    repositories: [API, WEB],
  },
  steps: change.steps ?? [
    { index: 2, kind: 'said' },
    { index: 7, kind: 'remember' },
    { index: 9, kind: 'thought' },
  ],
  cited: change.cited ?? [],
  fromOutside: change.fromOutside ?? false,
});

const asked = (change: Partial<Remembered> = {}): Remembered => ({
  kind: 'rationale',
  body: 'Uploads retry in the request, not from a queue.',
  reach: null,
  paths: [],
  supersedes: null,
  ...change,
});

const active = (teamId = TEAM) =>
  Memory.write({
    id: MemoryId.of('memory_old'),
    handle: MemoryHandle.of(7),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'rationale',
    body: MemoryBody.of('Uploads retry from a queue.'),
    scope: MemoryScope.of({ teamId }),
    grounds: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at: NOW }),
  });

const proposed = (
  change: Partial<Remembered> = {},
  over?: Parameters<typeof at>[0],
) =>
  Remembering.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    replay: false,
    isSearch: false,
  }).proposalOf({
    id: MemoryId.of('memory_1'),
    remembered: asked(change),
    at: at(over),
    now: NOW,
  });

describe('Remembering, what an agent asks its team to keep', () => {
  it('is only for a task’s run, sending a chat to the person instead', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        replay: false,
        isSearch: false,
      }),
    ).toThrow(/only from a task's run/);
  });

  it('is never for a replay, which leaves nothing behind', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        replay: true,
        isSearch: false,
      }),
    ).toThrow(KeptFromReplaysError);
  });

  it('is never for a search, which what the team remembers stays out of', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        replay: false,
        isSearch: true,
      }),
    ).toThrow(KeptFromSearchesError);
  });

  it('rests on the step the agent remembered it from, as the run’s own', () => {
    const proposal = proposed();

    expect(proposal.grounds.steps).toEqual([7]);
    expect(proposal.grounds.notes).toEqual([]);
    expect(proposal.origin).toBe('remembered');
    expect(proposal.source).toBe('run');
    expect(proposal.proposed).toBe(true);
  });

  it('rests on the latest step not yet remembered from, or the last thing said', () => {
    expect(
      proposed(
        {},
        {
          steps: [
            { index: 3, kind: 'remember' },
            { index: 8, kind: 'remember' },
          ],
          cited: [8],
        },
      ).grounds.steps,
    ).toEqual([3]);
    expect(
      proposed({}, { steps: [{ index: 4, kind: 'said' }] }).grounds.steps,
    ).toEqual([4]);
  });

  it('refuses a memory from a run that has said nothing yet', () => {
    expect(() => proposed({}, { steps: [] })).toThrow(InvalidMemoryError);
  });

  it('is from outside when its task is', () => {
    expect(proposed({}, { fromOutside: true }).source).toBe('outside');
  });

  it('applies to the run’s line unless told otherwise', () => {
    expect(proposed().scope).toMatchObject({
      lineId: 'line_1',
      stationId: null,
    });
    expect(proposed({ reach: 'station' }).scope).toMatchObject({
      lineId: 'line_1',
      stationId: 'station_1',
    });
    expect(proposed({ reach: 'team' }).scope).toMatchObject({
      lineId: null,
      stationId: null,
    });
  });

  it('bears on paths inside the repository whose checkout they are in', () => {
    const { scope } = proposed({
      paths: ['api/src/uploads', 'api/src/retry.ts'],
    });

    expect(scope.repository?.value).toBe('acme/api');
    expect(scope.paths.map((each) => each.value)).toEqual([
      'src/uploads',
      'src/retry.ts',
    ]);
    expect(proposed({ paths: ['web'] }).scope).toMatchObject({
      repository: WEB,
      paths: [],
    });
  });

  it('refuses a kind or a reach it does not know, naming the ones it does', () => {
    expect(() => proposed({ kind: 'gossip' })).toThrow(
      /one of rationale, rejected-approach, failure, environment, preference, correction, not gossip/,
    );
    expect(() => proposed({ reach: 'world' })).toThrow(
      /one of team, line, station, not world/,
    );
  });

  it('refuses a path outside the run’s repositories, naming the ones it has', () => {
    expect(() => proposed({ paths: ['docs/readme.md'] })).toThrow(
      /\(api, web\), not docs\/readme\.md/,
    );
    expect(() => proposed({ paths: ['api/../web/src'] })).toThrow(
      InvalidMemoryError,
    );
  });

  it('bears on one repository at a time', () => {
    expect(() => proposed({ paths: ['api/src', 'web/src'] })).toThrow(
      /one repository at a time/,
    );
  });

  it('corrects only a memory still active in the run’s team', () => {
    const existing = active();

    expect(
      proposed({ supersedes: existing }).supersedes?.equals(existing.id),
    ).toBe(true);
    expect(() =>
      proposed({ supersedes: active(TeamId.of('team_other')) }),
    ).toThrow(/M-7 is not one/);
    expect(() =>
      proposed({
        supersedes: existing.retire({
          by: UserId.of('user_1'),
          reason: 'No longer true.',
          at: NOW,
        }),
      }),
    ).toThrow(/M-7 is not one/);
  });
});
