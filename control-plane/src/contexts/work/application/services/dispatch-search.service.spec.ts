import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  Chosen,
  HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import type { SearchOrder } from '@work/application/ports/search-dispatch.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { DispatchSearch } from '@work/application/services/dispatch-search.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { SEARCH_PRIORITY } from '@work/domain/services/search-priority';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const TEAM = TeamId.of('team_1');
const BUILD = StationId.of('station_build');

const station = (
  id: string,
  key: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed',
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: StationColor.plain(),
    kind,
  });

const DELIVERY = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TEAM,
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  placement: RunnerPlacement.of(['linux']),
  stations: [
    station('station_backlog', 'backlog', 0, 'backlog'),
    station(BUILD.value, 'build', 1, 'work'),
    station('station_done', 'completed', 2, 'completed'),
  ],
});

const ORDER: SearchOrder = {
  id: 'run_9',
  searchId: 'search_1',
  iteration: 2,
  lineId: 'line_1',
  stationId: BUILD.value,
  agent: { harness: 'claude-code', model: 'claude-opus-4-5', effort: 'high' },
  briefing: 'Find a Build station that passes more of its checks.',
};

const dispatching = (over: { launches?: boolean; line?: Line | null } = {}) => {
  const runs = new Map<string, Run>();
  const chosen: Chosen[] = [];
  const dispatch = new DispatchSearch(
    {
      findById: async (id: RunId) => runs.get(id.value) ?? null,
      add: async (run: Run) => {
        runs.set(run.id.value, run);
      },
      save: async (run: Run) => {
        runs.set(run.id.value, run);
      },
    } as unknown as RunRepository,
    {
      find: async () => (over.line === undefined ? DELIVERY : over.line),
    } as unknown as LineRepository,
    {
      commandFor: (_harness: HarnessId, picked: Chosen) => {
        chosen.push(picked);
        return (over.launches ?? true)
          ? HarnessCommand.of({ executable: 'claude-agent-acp' })
          : null;
      },
      catalogue: () => [
        {
          id: 'claude-code',
          name: 'Claude Code',
          executable: 'claude-agent-acp',
          efforts: ['high'],
          discovery: [],
          versionProbe: [],
        },
      ],
    } as unknown as HarnessLaunchPort,
    {
      forSearch: (searchId, runId) => `trace:${searchId.value}:${runId.value}`,
    } as TraceParentPort,
    { inTransaction: (work) => work() },
    { now: () => NOW, sleep: async () => {} },
  );

  return { dispatch, runs, chosen };
};

describe('DispatchSearch', () => {
  it('queues a search run at the station, for its line’s team, placed where its station runs', async () => {
    const { dispatch, runs } = dispatching();

    expect(await dispatch.enqueue(ORDER)).toEqual({ outcome: 'queued' });

    const run = runs.get('run_9');

    expect(run?.isSearch).toBe(true);
    expect(run?.subject?.searchId?.value).toBe('search_1');
    expect(run?.subject?.iteration?.value).toBe(2);
    expect(run?.stationId?.equals(BUILD)).toBe(true);
    expect(run?.ranFor?.equals(TEAM)).toBe(true);
    expect(run?.taskId).toBeNull();
    expect(run?.priority.equals(SEARCH_PRIORITY)).toBe(true);
    expect(run?.placement.equals(DELIVERY.runsIn)).toBe(true);
    expect(run?.harness.equals(HarnessId.of('claude-code'))).toBe(true);
    expect(run?.configuredAs).toBeNull();
  });

  it('places a search run where its station’s own runners are, when the station names them', async () => {
    const gpu = RunnerPlacement.of(['gpu']);
    const line = Line.rehydrate({
      id: LineId.of('line_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      key: LineKey.of('delivery'),
      name: LineName.of('Delivery'),
      placement: RunnerPlacement.of(['linux']),
      stations: [
        station('station_backlog', 'backlog', 0, 'backlog'),
        Station.of({
          id: BUILD,
          key: StationKey.of('build'),
          name: StationName.of('build'),
          position: 1,
          color: StationColor.plain(),
          kind: 'work',
          placement: gpu,
        }),
        station('station_done', 'completed', 2, 'completed'),
      ],
    });
    const { dispatch, runs } = dispatching({ line });

    await dispatch.enqueue(ORDER);

    expect(runs.get('run_9')?.placement.equals(line.placementOf(BUILD))).toBe(
      true,
    );
    expect(runs.get('run_9')?.placement.equals(line.runsIn)).toBe(false);
  });

  it('hands the runner only its own briefing, with nothing to check out, no tools, skills, attachments or memories', async () => {
    const { dispatch, runs } = dispatching();

    await dispatch.enqueue(ORDER);

    const run = runs.get('run_9');

    expect(run?.spec.value).toEqual({
      command: {
        executable: 'claude-agent-acp',
        args: [],
        env: { TRACEPARENT: 'trace:search_1:run_9' },
      },
      briefing: ORDER.briefing,
      handover: { options: [], noteLimit: 0 },
      resume: { key: 'search-run_9' },
      search: {},
    });
    expect(run?.briefedWith.briefed).toEqual([]);
    expect(run?.briefedWith.omitted).toEqual([]);
  });

  it('runs the harness, model and effort the search was started with', async () => {
    const { dispatch, chosen } = dispatching();

    await dispatch.enqueue(ORDER);

    expect(
      chosen.map((each) => [each.model?.value, each.effort?.value]),
    ).toEqual([['claude-opus-4-5', 'high']]);
  });

  it('queues an iteration once, however often it is requested', async () => {
    const { dispatch, runs } = dispatching();

    await dispatch.enqueue(ORDER);
    const first = runs.get('run_9');

    expect(await dispatch.enqueue(ORDER)).toEqual({ outcome: 'queued' });
    expect(runs.get('run_9')).toBe(first);
    await expect(dispatch.enqueue({ ...ORDER, iteration: 3 })).rejects.toThrow(
      InconsistentStateError,
    );
  });

  it('says which of a search’s agent a runner could not start: an unknown harness, an overlong model or an unknown effort', () => {
    const { dispatch } = dispatching();

    expect(dispatch.problemOf(ORDER.agent)).toBeNull();
    expect(
      dispatch.problemOf({ harness: 'claude-code', model: null, effort: null }),
    ).toBeNull();
    expect(dispatch.problemOf({ ...ORDER.agent, harness: 'emacs' })).toEqual({
      field: 'harness',
      reason:
        'Harness emacs is not one that a runner can start. Harnesses: claude-code',
    });
    expect(
      dispatch.problemOf({ ...ORDER.agent, model: 'm'.repeat(61) })?.field,
    ).toBe('model');
    expect(
      dispatch.problemOf({ ...ORDER.agent, effort: 'enormous' })?.field,
    ).toBe('effort');
  });

  it('starts nothing where the line no longer has the station, or no runner can start the harness', async () => {
    for (const [over, order] of [
      [{ line: null }, ORDER],
      [{}, { ...ORDER, stationId: 'station_gone' }],
      [{}, { ...ORDER, stationId: 'station_backlog' }],
      [{ launches: false }, ORDER],
    ] as const) {
      const { dispatch, runs } = dispatching(over);

      expect((await dispatch.enqueue(order)).outcome).toBe('unstartable');
      expect(runs.size).toBe(0);
    }
  });

  it('cancels a queued search run, stops a leased one, and leaves an ended one be', async () => {
    const { dispatch, runs } = dispatching();

    await dispatch.enqueue(ORDER);
    await dispatch.cancel('run_9');

    expect(runs.get('run_9')?.hasEnded).toBe(true);
    expect(runs.get('run_9')?.outcome?.message).toBe(
      'Search stopped before a runner claimed the run.',
    );

    await dispatch.enqueue({ ...ORDER, id: 'run_10' });
    runs.set(
      'run_10',
      (runs.get('run_10') as Run).claim(RunnerId.of('runner_1'), NOW),
    );
    await dispatch.cancel('run_10');

    expect(runs.get('run_10')?.stopRequested).toBe(true);

    const ended = runs.get('run_9');
    await dispatch.cancel('run_9');

    expect(runs.get('run_9')).toBe(ended);
  });

  it('cancels a search run nobody claimed only while it still waits, saying whether an earlier attempt ever started', async () => {
    const { dispatch, runs } = dispatching();

    await dispatch.enqueue(ORDER);
    await dispatch.enqueue({ ...ORDER, id: 'run_10' });
    runs.set(
      'run_10',
      (runs.get('run_10') as Run).claim(RunnerId.of('runner_1'), NOW),
    );

    expect(await dispatch.cancelUnclaimed('run_10')).toEqual({
      outcome: 'claimed',
    });
    expect(runs.get('run_10')?.hasEnded).toBe(false);
    expect(await dispatch.cancelUnclaimed('run_9')).toEqual({
      outcome: 'cancelled',
      started: false,
    });
    expect(runs.get('run_9')?.outcome?.message).toBe(
      'No runner claimed the run in time. Its search cancelled it.',
    );
    expect(await dispatch.cancelUnclaimed('run_9')).toEqual({
      outcome: 'ended',
    });
    expect(await dispatch.cancelUnclaimed('nothing')).toEqual({
      outcome: 'ended',
    });
  });
});
