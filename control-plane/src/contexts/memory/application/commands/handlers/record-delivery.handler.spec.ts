import { RecordDeliveryHandler } from '@memory/application/commands/handlers/record-delivery.handler';
import { RecordDeliveryCommand } from '@memory/application/commands/record-delivery.command';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryUses } from '@memory/domain/entities/memory-uses.entity';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const TEAM = TeamId.of('team_1');

const leasedRun = (replay: boolean): LeasedRun => ({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TEAM,
  taskId: null,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  repositories: [],
  asOf: replay ? NOW : null,
  isolated: false,
  trial: false,
});

const stored = (id: string, handle: number, teamId: TeamId) =>
  Memory.write({
    id: MemoryId.of(id),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of('Squash before merging.'),
    scope: MemoryScope.of({ teamId }),
    provenance: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-01T09:00:00.000Z'),
    }),
  });

const handler = (run: LeasedRun) => {
  const recorded: { via: string; memories: string[] }[] = [];
  const memories = [
    stored('memory_1', 1, TEAM),
    stored('memory_2', 2, TeamId.of('team_2')),
  ];
  const recording = new RecordDeliveryHandler(
    new RunnerMemoryLoader(
      partial<WorkPort>({
        leasedBy: () => Promise.resolve(run),
      }),
    ),
    partial<MemoryRepository>({
      withHandles: (teamId: TeamId, handles: readonly MemoryHandle[]) =>
        Promise.resolve(
          memories.filter(
            (each) =>
              each.isTeams(teamId) &&
              handles.some((handle) => handle.equals(each.handle)),
          ),
        ),
    }),
    new RecordMemoryUses(
      partial<MemoryUsesPort>({
        record: (uses: MemoryUses) => {
          recorded.push({
            via: uses.via,
            memories: uses.memories.map((each) => each.value),
          });
          return Promise.resolve();
        },
      }),
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
    ),
  );

  return { recording, recorded };
};

describe('recording what a run showed its agent for a path it used', () => {
  it('counts the memories of its team as delivered to the run', async () => {
    const { recording, recorded } = handler(leasedRun(false));

    await recording.execute(
      new RecordDeliveryCommand('run_1', 'runner_1', ['M-1', 'M-2', 'M-9']),
    );

    expect(recorded).toEqual([{ via: 'delivered', memories: ['memory_1'] }]);
  });

  it('counts nothing when a replay is shown them', async () => {
    const { recording, recorded } = handler(leasedRun(true));

    await recording.execute(
      new RecordDeliveryCommand('run_1', 'runner_1', ['M-1']),
    );

    expect(recorded).toEqual([]);
  });

  it('turns down more than 50 at a time', async () => {
    const { recording } = handler(leasedRun(false));

    await expect(
      recording.execute(
        new RecordDeliveryCommand(
          'run_1',
          'runner_1',
          Array.from({ length: 51 }, (_, at) => `M-${at + 1}`),
        ),
      ),
    ).rejects.toThrow('records at most 50 shown memories at a time');
  });

  it('turns down what is not a handle', async () => {
    const { recording } = handler(leasedRun(false));

    await expect(
      recording.execute(
        new RecordDeliveryCommand('run_1', 'runner_1', ['memory_1']),
      ),
    ).rejects.toThrow('handle must look like M-12, not memory_1');
  });
});
