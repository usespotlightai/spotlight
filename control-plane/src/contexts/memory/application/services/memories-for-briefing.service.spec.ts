import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import { MemoriesForBriefing } from '@memory/application/services/memories-for-briefing.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
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

const approved = (id: number, paths: string[] = []) =>
  Memory.write({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${id}.`),
    scope: MemoryScope.of({
      teamId: TEAM,
      repository: paths.length > 0 ? API : null,
      paths: paths.map(MemoryPath.of),
    }),
    provenance: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });

const briefing = (
  stored: Memory[],
  ranks: ReadonlyMap<string, number> = new Map(),
  touching: readonly { repository: Repository; path: string }[] = [
    { repository: API, path: 'src/uploads/retry.ts' },
  ],
) => {
  const touched = vi.fn(async () => touching);
  const rank = vi.fn(async () => ranks);
  const relevance = { rank } as unknown as MemoryRelevancePort;
  const memories = new MemoriesForBriefing(
    new ApplicableMemories(
      {
        mayApplyAt: async () => stored,
        successorsOf: async () => [],
      } as unknown as MemoryRepository,
      relevance,
    ),
    relevance,
    { runsUsing: async () => new Map() } as unknown as MemoryUsesPort,
    { findAll: async () => stored } as unknown as MemoryRepository,
  );

  return {
    touched,
    rank,
    brief: () =>
      memories.forBriefing({
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
        repositories: [API],
        about: 'Fix upload retries',
        touched,
      }),
  };
};

describe('MemoriesForBriefing', () => {
  it('never reads what the task touched when no applicable memory is about paths', async () => {
    const { touched, brief } = briefing([approved(1)]);

    expect((await brief()).briefed.map((each) => each.handle)).toEqual(['M-1']);
    expect(touched).not.toHaveBeenCalled();
  });

  it('reads what the task touched to match a memory about paths', async () => {
    const { touched, brief } = briefing([
      approved(1),
      approved(2, ['src/uploads']),
    ]);

    expect((await brief()).briefed.map((each) => each.handle)).toEqual([
      'M-2',
      'M-1',
    ]);
    expect(touched).toHaveBeenCalledOnce();
  });

  it('briefs a memory about paths the task has not touched when its words match the task', async () => {
    const aboutUploads = approved(3, ['src/uploads']);
    const { brief, rank } = briefing(
      [approved(1), aboutUploads],
      new Map([[aboutUploads.id.value, 0.02]]),
      [],
    );

    const chosen = await brief();

    expect(chosen.briefed.map((each) => each.handle)).toEqual(['M-3', 'M-1']);
    expect(rank).toHaveBeenCalledWith(
      [MemoryId.of('memory_1'), aboutUploads.id],
      'Fix upload retries',
    );
  });

  it('points at the memory folder only when some memory applies', async () => {
    expect((await briefing([approved(1)]).brief()).folder).toEqual({
      path: '.spotlight/memory',
      layout: [
        { folder: 'team/', level: 'the whole team' },
        { folder: 'line/', level: 'this line' },
        { folder: 'station/', level: 'this station' },
        {
          folder: 'repositories/<owner>/<name>/<path>/',
          level: 'a repository, or a file or folder in it',
        },
      ],
      repositoryFolder: 'repositories/',
    });
    expect((await briefing([]).brief()).folder).toBeNull();
  });
});
