import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const ELSEWHERE = TeamId.of('team_2');
const AT = new Date('2026-09-27T10:00:00.000Z');
const BY = MemoryDecision.of({ by: UserId.of('user_1'), at: AT });

const SITE: RunSite = {
  teamId: TEAM,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [],
};

const approved = (
  id: number,
  scope: { teamId?: TeamId; lineId?: string } = {},
) =>
  Memory.write({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${id}.`),
    scope: MemoryScope.of({
      teamId: scope.teamId ?? TEAM,
      lineId: scope.lineId ?? null,
    }),
    grounds: null,
    by: BY,
  });

const correcting = (old: Memory, id: number, lineId: string | null = null) =>
  old.correct({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    kind: old.kind,
    body: MemoryBody.of(`Memory ${id}.`),
    scope: MemoryScope.of({ teamId: old.scope.teamId, lineId }),
    by: BY,
  });

const applicable = (input: {
  mayApply?: readonly Memory[];
  stored?: readonly Memory[];
  successors?: readonly Memory[];
  recalled?: readonly MemoryId[];
}) => {
  const stored = input.stored ?? input.mayApply ?? [];
  const recall = vi.fn(async () => input.recalled ?? []);

  return {
    recall,
    memories: new ApplicableMemories(
      {
        mayApplyAt: async () => input.mayApply ?? [],
        findAll: async (ids: readonly MemoryId[]) =>
          ids.flatMap((id) => stored.filter((each) => each.id.equals(id))),
        successorsOf: async (ids: readonly MemoryId[]) =>
          (input.successors ?? []).filter((each) =>
            ids.some((id) => each.supersedes?.equals(id)),
          ),
      } as unknown as MemoryRepository,
      { recall } as unknown as MemoryRelevancePort,
    ),
  };
};

const handles = (memories: readonly Memory[]) =>
  memories.map((each) => each.handle.value);

describe('ApplicableMemories', () => {
  it('keeps only what the scope rule says applies, whatever the store offered', async () => {
    const { memories } = applicable({
      mayApply: [
        approved(1),
        approved(2, { lineId: 'line_other' }),
        approved(3, { teamId: ELSEWHERE }),
        approved(4).retire({
          by: UserId.of('user_1'),
          reason: 'Stale.',
          at: AT,
        }),
      ],
    });

    expect(handles(await memories.at(SITE))).toEqual(['M-1']);
  });

  it('leaves out a memory whose correction is already active, even one that applies elsewhere', async () => {
    const old = approved(1);
    const { memories } = applicable({
      mayApply: [old, approved(2)],
      successors: [correcting(old, 3, 'line_other')],
    });

    expect(handles(await memories.at(SITE))).toEqual(['M-2']);
  });

  it('recalls in the order of relevance, only what is active on the team and is not yet corrected', async () => {
    const old = approved(1);
    const correction = correcting(old, 2);
    const retired = approved(3).retire({
      by: UserId.of('user_1'),
      reason: 'Stale.',
      at: AT,
    });
    const theirs = approved(4, { teamId: ELSEWHERE });
    const plain = approved(5);
    const { memories, recall } = applicable({
      stored: [old, correction, retired, theirs, plain],
      successors: [correction],
      recalled: [plain, old, retired, theirs, correction].map(
        (each) => each.id,
      ),
    });
    const words = RecallWords.of('branches');

    expect(handles(await memories.recalled(TEAM, words, 10))).toEqual([
      'M-5',
      'M-2',
    ]);
    expect(recall).toHaveBeenCalledWith(TEAM, words, 10, null);
  });

  it('recalls for a replay only what was active when the run it replays started', async () => {
    const later = (hours: number) =>
      new Date(AT.getTime() + hours * 60 * 60_000);
    const old = approved(1);
    const correction = old.correct({
      id: MemoryId.of('memory_2'),
      handle: MemoryHandle.of(2),
      kind: old.kind,
      body: MemoryBody.of('Memory 2.'),
      scope: old.scope,
      by: MemoryDecision.of({ by: UserId.of('user_1'), at: later(2) }),
    });
    const superseded = old.supersedeWith(correction.id, later(2));
    const { memories, recall } = applicable({
      stored: [superseded, correction],
      successors: [correction],
      recalled: [superseded, correction].map((each) => each.id),
    });
    const words = RecallWords.of('branches');

    expect(handles(await memories.recalled(TEAM, words, 10, later(1)))).toEqual(
      ['M-1'],
    );
    expect(handles(await memories.recalled(TEAM, words, 10, later(3)))).toEqual(
      ['M-2'],
    );
    expect(handles(await memories.recalled(TEAM, words, 10, AT))).toEqual([
      'M-1',
    ]);
    expect(recall).toHaveBeenCalledWith(TEAM, words, 10, later(1));
  });
});
