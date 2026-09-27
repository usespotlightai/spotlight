import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const kept = (id: number, paths: string[] = []) =>
  Memory.written({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: `Memory ${id}.`,
    scope: MemoryScope.of({
      teamId: TEAM,
      repository: paths.length > 0 ? API : null,
      paths: paths.map(MemoryPath.of),
    }),
    grounds: null,
    supersedes: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });

const briefing = (held: Memory[]) => {
  const touched = vi.fn(async () => [
    { repository: API, path: 'src/uploads/retry.ts' },
  ]);
  const memories = new MemoriesForBriefing({
    mayReach: async () => held,
  } as unknown as MemoryRepository);

  return {
    touched,
    brief: () =>
      memories.forBriefing({
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
        repositories: [API],
        touched,
      }),
  };
};

describe('MemoriesForBriefing', () => {
  it('never asks what the task touched when no memory in reach is about paths', async () => {
    const { touched, brief } = briefing([kept(1)]);

    expect((await brief()).map((each) => each.handle)).toEqual(['M-1']);
    expect(touched).not.toHaveBeenCalled();
  });

  it('asks what the task touched to reach a memory about paths', async () => {
    const { touched, brief } = briefing([kept(1), kept(2, ['src/uploads'])]);

    expect((await brief()).map((each) => each.handle)).toEqual(['M-2', 'M-1']);
    expect(touched).toHaveBeenCalledOnce();
  });
});
