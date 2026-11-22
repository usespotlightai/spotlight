import { UpkeepReactions } from '@memory/application/events/handlers/upkeep-reactions.handler';
import { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { MemoryMerged } from '@memory/domain/events/memory-merged.event';
import { MemoryUpkeepSwept } from '@memory/domain/events/memory-upkeep-swept.event';
import { UpkeepProposalApproved } from '@memory/domain/events/upkeep-proposal-approved.event';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryCreation } from '@memory/domain/value-objects/memory-creation';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { UpkeepChange } from '@memory/domain/value-objects/upkeep-change';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_1');

const memory = (handle: number) =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${handle}.`),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

const P1 = UpkeepProposalId.of('p_1');

const upkeepOf = (change: UpkeepChange, memories: string[], approved = true) =>
  MemoryUpkeep.rehydrate({
    id: MemoryUpkeepId.of('upkeep_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    sweptAt: NOW,
    proposals: [
      ((proposal: UpkeepProposal) =>
        approved
          ? proposal.approve(MemoryDecision.of({ by: ADA, at: NOW }))
          : proposal)(
        change === 'merge'
          ? UpkeepProposal.merging({
              id: P1,
              memories: memories.map((each) => MemoryId.of(each)),
              body: MemoryBody.of('One rule.'),
              reason: 'Same rule.',
            })
          : UpkeepProposal.retiring({
              id: P1,
              memory: MemoryId.of(memories[0] ?? ''),
              finding: 'unused',
              reason: 'Not used in 90 days.',
            }),
      ),
    ],
    version: 1,
  });

const instantly: TransactionPort = {
  inTransaction: <T>(work: () => Promise<T>) => work(),
};

const reacting = (
  stored: Memory[],
  schedule: MemoryUpkeepSchedule | null = null,
  upkeep: MemoryUpkeep | null = null,
) => {
  const memories = new Map(stored.map((each) => [each.id.value, each]));
  const schedules: MemoryUpkeepSchedule[] = schedule ? [schedule] : [];
  const upkeeps: MemoryUpkeep[] = upkeep ? [upkeep] : [];
  const noticed: MemoryUpkeepSwept[] = [];
  const settled: MemoryUpkeepId[] = [];
  const reactions = new UpkeepReactions(
    {
      swept: async (event: MemoryUpkeepSwept) => {
        noticed.push(event);
      },
      settled: async (upkeepId: MemoryUpkeepId) => {
        settled.push(upkeepId);
      },
    },
    {
      find: async (id: MemoryId) => memories.get(id.value) ?? null,
      findAll: async (ids: readonly MemoryId[]) =>
        ids.flatMap((id) => memories.get(id.value) ?? []),
      findAllLocked: async (ids: readonly MemoryId[]) =>
        ids.flatMap((id) => memories.get(id.value) ?? []),
      save: async (saved: Memory) => {
        memories.set(saved.id.value, saved);
      },
      add: async (added: Memory) => {
        memories.set(added.id.value, added);
      },
      nextHandle: async () => MemoryHandle.of(50),
    } as unknown as MemoryRepository,
    {
      find: async () => upkeeps[upkeeps.length - 1] ?? null,
      save: async (saved: MemoryUpkeep) => {
        upkeeps.push(saved);
      },
    } as unknown as MemoryUpkeepRepository,
    {
      ofTeam: async () => schedules[schedules.length - 1] ?? null,
      add: async (added: MemoryUpkeepSchedule) => {
        schedules.push(added);
      },
      save: async (saved: MemoryUpkeepSchedule) => {
        schedules.push(saved);
      },
    } as unknown as MemoryUpkeepScheduleRepository,
    instantly,
    { now: () => NOW, sleep: async () => undefined },
  );

  return { reactions, memories, schedules, upkeeps, noticed, settled };
};

const approved = (
  change: UpkeepChange,
  memories: string[],
  merged: string | null = null,
) =>
  new UpkeepProposalApproved(
    MemoryUpkeepId.of('upkeep_1'),
    WorkspaceId.of('ws_1'),
    TEAM,
    P1,
    change,
    memories.map((each) => MemoryId.of(each)),
    change === 'merge' ? MemoryBody.of('One rule.') : null,
    'Not used in 90 days.',
    MemoryDecision.of({ by: ADA, at: NOW }),
    merged ? MemoryId.of(merged) : null,
  );

describe('UpkeepReactions', () => {
  it('keeps an approved retirement applied when its event arrives twice', async () => {
    const { reactions, memories, upkeeps } = reacting(
      [memory(1)],
      null,
      upkeepOf('retire', ['memory_1']),
    );

    await reactions.onApproved(approved('retire', ['memory_1']));
    await reactions.onApproved(approved('retire', ['memory_1']));

    expect(memories.get('memory_1')?.status).toBe('retired');
    expect(upkeeps[upkeeps.length - 1]?.proposal(P1).state).toBe('approved');
  });

  it('retires what an approved retirement names, with its reason', async () => {
    const { reactions, memories } = reacting(
      [memory(1)],
      null,
      upkeepOf('retire', ['memory_1']),
    );

    await reactions.onApproved(approved('retire', ['memory_1']));

    expect(memories.get('memory_1')?.status).toBe('retired');
    expect(memories.get('memory_1')?.retirement?.reason).toBe(
      'Not used in 90 days.',
    );
  });

  it('writes one memory for an approved merge that replaces the first', async () => {
    const { reactions, memories } = reacting(
      [memory(1), memory(2)],
      null,
      upkeepOf('merge', ['memory_1', 'memory_2']),
    );

    await reactions.onApproved(
      approved('merge', ['memory_1', 'memory_2'], 'memory_new'),
    );

    const merged = memories.get('memory_new');
    expect(merged?.body.value).toBe('One rule.');
    expect(merged?.supersedes?.value).toBe('memory_1');
    expect(merged?.handle.value).toBe('M-50');
    expect(memories.get('memory_2')?.status).toBe('active');
  });

  it('lapses an approved merge when one of its memories was retired after the sweep', async () => {
    const { reactions, memories, upkeeps } = reacting(
      [memory(1), memory(2).retire({ by: ADA, reason: 'Gone.', at: NOW })],
      null,
      upkeepOf('merge', ['memory_1', 'memory_2']),
    );

    await reactions.onApproved(
      approved('merge', ['memory_1', 'memory_2'], 'memory_new'),
    );

    expect(memories.has('memory_new')).toBe(false);
    expect(upkeeps[upkeeps.length - 1]?.proposal(P1).state).toBe('lapsed');
  });

  it('supersedes each memory a merge replaces with the merged one', async () => {
    const merged = Memory.merged({
      id: MemoryId.of('memory_new'),
      handle: MemoryHandle.of(50),
      body: MemoryBody.of('One rule.'),
      replacing: [memory(2), memory(3)],
      by: MemoryDecision.of({ by: ADA, at: NOW }),
    });
    const { reactions, memories } = reacting([memory(2), memory(3), merged]);

    await reactions.onMerged(
      new MemoryMerged(
        merged.id,
        merged.handle,
        [MemoryId.of('memory_2'), MemoryId.of('memory_3')],
        MemoryDecision.of({ by: ADA, at: NOW }),
      ),
    );

    expect(
      ['memory_2', 'memory_3'].map(
        (each) => memories.get(each)?.retirement?.supersededBy?.value,
      ),
    ).toEqual(['memory_new', 'memory_new']);
    expect(memories.get('memory_new')?.isActive).toBe(true);
  });

  it('retires the merged memory and supersedes nothing when one it replaces was retired before the merge was made', async () => {
    const merged = Memory.merged({
      id: MemoryId.of('memory_new'),
      handle: MemoryHandle.of(50),
      body: MemoryBody.of('One rule.'),
      replacing: [memory(2), memory(3)],
      by: MemoryDecision.of({ by: ADA, at: NOW }),
    });
    const { reactions, memories } = reacting([
      memory(2),
      memory(3).retire({ by: ADA, reason: 'Gone.', at: NOW }),
      merged,
    ]);

    await reactions.onMerged(
      new MemoryMerged(
        merged.id,
        merged.handle,
        [MemoryId.of('memory_2'), MemoryId.of('memory_3')],
        MemoryDecision.of({ by: ADA, at: NOW }),
      ),
    );

    expect(memories.get('memory_new')?.retirement?.reason).toBe(
      'M-3 changed before the merge was made, so the merge no longer applies.',
    );
    expect(memories.get('memory_3')?.retirement?.reason).toBe('Gone.');
    expect(memories.get('memory_2')?.isActive).toBe(true);
  });

  it('starts the team’s schedule with its first memory, and counts only memories added after', async () => {
    const { reactions, schedules } = reacting([memory(1)]);
    const created = (creation: MemoryCreation) =>
      new MemoryCreated(
        MemoryId.of('memory_1'),
        null,
        TEAM,
        WorkspaceId.of('ws_1'),
        creation,
      );

    await reactions.onCreated(created('added'));
    await reactions.onCreated(created('added'));
    await reactions.onCreated(created('merged'));
    await reactions.onCreated(created('corrected'));

    expect(schedules.map((each) => each.addedSince)).toEqual([1, 2]);
  });

  it('starts no schedule for a memory deleted before its creation was counted', async () => {
    const { reactions, schedules } = reacting([]);

    await reactions.onCreated(
      new MemoryCreated(
        MemoryId.of('memory_1'),
        null,
        TEAM,
        WorkspaceId.of('ws_1'),
        'added',
      ),
    );

    expect(schedules).toEqual([]);
  });

  it('tells the team about a sweep only while its upkeep still exists', async () => {
    const swept = new MemoryUpkeepSwept(
      MemoryUpkeepId.of('upkeep_1'),
      WorkspaceId.of('ws_1'),
      TEAM,
      1,
      0,
    );
    const kept = reacting([], null, upkeepOf('retire', ['memory_1'], false));
    const gone = reacting([]);

    await kept.reactions.onSwept(swept);
    await gone.reactions.onSwept(swept);

    expect(kept.noticed).toEqual([swept]);
    expect(kept.settled).toEqual([]);
    expect(gone.noticed).toEqual([]);
  });

  it('tells the team nothing about a sweep whose changes were all decided first', async () => {
    const upkeep = upkeepOf('retire', ['memory_1'], false);
    const decided = reacting(
      [],
      null,
      upkeep.reject(P1, MemoryDecision.of({ by: ADA, at: NOW })),
    );

    await decided.reactions.onSwept(
      new MemoryUpkeepSwept(upkeep.id, WorkspaceId.of('ws_1'), TEAM, 1, 0),
    );

    expect(decided.noticed).toEqual([]);
  });
});
