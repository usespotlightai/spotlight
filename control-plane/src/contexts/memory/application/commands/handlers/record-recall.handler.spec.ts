import { RecordRecallHandler } from '@memory/application/commands/handlers/record-recall.handler';
import { RecordRecallCommand } from '@memory/application/commands/record-recall.command';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { RecordedMemoryUses } from '@memory/domain/entities/recorded-memory-uses.entity';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
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
  replaysFrom: replay ? NOW : null,
  isSearch: false,
});

const stored = (id: string, teamId: TeamId) =>
  Memory.write({
    id: MemoryId.of(id),
    handle: MemoryHandle.of(1),
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
  const recorded: string[][] = [];
  const memories = [
    stored('memory_1', TEAM),
    stored('memory_2', TeamId.of('team_2')),
  ];
  const recording = new RecordRecallHandler(
    new RunnerMemoryLoader({
      leasedBy: async () => run,
    } as unknown as WorkPort),
    {
      findAll: async (ids: readonly MemoryId[]) =>
        memories.filter((each) => ids.some((id) => id.equals(each.id))),
    } as unknown as MemoryRepository,
    new RecordMemoryUses(
      {
        record: async (uses: RecordedMemoryUses) => {
          recorded.push(uses.memories.map((each) => each.value));
        },
      } as unknown as MemoryUsesPort,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
    ),
  );

  return { recording, recorded };
};

describe('recording what a run recalled', () => {
  it('counts the memories of its team as used by the run that recalled them', async () => {
    const { recording, recorded } = handler(leasedRun(false));

    await recording.execute(
      new RecordRecallCommand('run_1', 'runner_1', ['memory_1', 'memory_2']),
    );

    expect(recorded).toEqual([['memory_1']]);
  });

  it('counts nothing as used when a replay recalls them', async () => {
    const { recording, recorded } = handler(leasedRun(true));

    await recording.execute(
      new RecordRecallCommand('run_1', 'runner_1', ['memory_1']),
    );

    expect(recorded).toEqual([]);
  });
});
