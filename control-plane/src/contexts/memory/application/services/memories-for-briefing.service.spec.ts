import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
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

const briefing = (
  held: Memory[],
  matches: ReadonlyMap<string, number> = new Map(),
  touching: readonly { repository: Repository; path: string }[] = [
    { repository: API, path: 'src/uploads/retry.ts' },
  ],
) => {
  const touched = vi.fn(async () => touching);
  const matching = vi.fn(async () => matches);
  const memories = new MemoriesForBriefing(
    {
      mayReach: async () => held,
      matching,
    } as unknown as MemoryRepository,
    { runsUsing: async () => new Map() } as unknown as MemoryUsesPort,
  );

  return {
    touched,
    matching,
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
  it('never asks what the task touched when no memory in reach is about paths', async () => {
    const { touched, brief } = briefing([kept(1)]);

    expect((await brief()).briefed.map((each) => each.handle)).toEqual(['M-1']);
    expect(touched).not.toHaveBeenCalled();
  });

  it('asks what the task touched to reach a memory about paths', async () => {
    const { touched, brief } = briefing([kept(1), kept(2, ['src/uploads'])]);

    expect((await brief()).briefed.map((each) => each.handle)).toEqual([
      'M-2',
      'M-1',
    ]);
    expect(touched).toHaveBeenCalledOnce();
  });

  it('briefs a memory about paths the task has not touched when its words match the task', async () => {
    const aboutUploads = kept(3, ['src/uploads']);
    const { brief, matching } = briefing(
      [kept(1), aboutUploads],
      new Map([[aboutUploads.id.value, 0.2]]),
      [],
    );

    const chosen = await brief();

    expect(chosen.briefed.map((each) => each.handle)).toEqual(['M-3', 'M-1']);
    expect(matching).toHaveBeenCalledWith(
      [MemoryId.of('memory_1'), aboutUploads.id],
      'Fix upload retries',
    );
  });

  it('points at the memory folder only when some memory applies', async () => {
    expect((await briefing([kept(1)]).brief()).folder).toEqual({
      path: '.spotlight/memory',
      layout: [
        { folder: 'team/', holds: 'the whole team' },
        { folder: 'line/', holds: 'this line' },
        { folder: 'station/', holds: 'this station' },
        {
          folder: 'repositories/<owner>/<name>/<path>/',
          holds: 'a repository, or a file or folder in it',
        },
      ],
      mirroring: 'repositories/',
    });
    expect((await briefing([]).brief()).folder).toBeNull();
  });
});
