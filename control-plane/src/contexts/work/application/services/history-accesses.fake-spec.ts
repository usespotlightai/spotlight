import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunLeasesPort } from '@work/application/ports/run-leases.port';
import type { TraceScope } from '@work/application/ports/trace-scopes.port';
import { HistoryAccesses } from '@work/application/services/history-accesses.service';
import { TraceScopes } from '@work/application/services/trace-scopes.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface LeasedHistoryFixture {
  readonly team?: string | null;
  readonly trialAsOf?: Date | null;
  readonly scope?: TraceScope | null;
}

const CONFIG = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const trialOf = (runId: RunId, asOf: Date | null): Dispatch =>
  Dispatch.trialOrdered({
    id: runId,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: null,
    subject: {
      kind: 'trial',
      basedOn: RunId.of('run_original'),
      taskId: TaskId.of('task_original'),
      stationId: StationId.of('station_1'),
      asOf,
      repositories: [],
      followUp: null,
    },
    configuredAs: CONFIG,
    order: DispatchOrder.of({}),
    now: new Date('2026-09-01T09:00:00.000Z'),
  });

export const historyAccessesOf = (
  fixture: LeasedHistoryFixture = {},
): HistoryAccesses => {
  const team = fixture.team === undefined ? 'team_1' : fixture.team;
  const isolated =
    fixture.trialAsOf !== undefined || fixture.scope !== undefined;
  const scopes = new TraceScopes();

  scopes.register({
    owner: 'replays',
    scopeOf: async () => fixture.scope ?? null,
  });

  return new HistoryAccesses(
    {
      leasedBy: async (runId: RunId) =>
        team
          ? {
              runId,
              team: TeamId.of(team),
              requester: {
                owner: isolated ? 'replays' : 'work',
                kind: fixture.trialAsOf !== undefined ? 'replay' : 'search',
                id: runId.value,
                token: null,
                team,
              },
              policy: { actsBeyondItself: !isolated },
            }
          : null,
    } as unknown as RunLeasesPort,
    {
      find: async (runId: RunId) =>
        fixture.trialAsOf === undefined
          ? null
          : trialOf(runId, fixture.trialAsOf),
    } as unknown as DispatchRepository,
    scopes,
  );
};
