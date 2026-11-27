import {
  MemoryUpkeepSchedule,
  UPKEEP_EVERY_MS,
} from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryUpkeepSettled } from '@memory/domain/events/memory-upkeep-settled.event';
import { MemoryUpkeepSwept } from '@memory/domain/events/memory-upkeep-swept.event';
import { UpkeepProposalApproved } from '@memory/domain/events/upkeep-proposal-approved.event';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { UpkeepProposalLapsedError } from '@memory/domain/exceptions/upkeep-proposal-lapsed.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const DECISION = MemoryDecision.of({ by: UserId.of('user_1'), at: NOW });

const TEAM = TeamId.of('team_1');
const P1 = UpkeepProposalId.of('p_1');
const P2 = UpkeepProposalId.of('p_2');

const swept = (proposals: UpkeepProposal[]): MemoryUpkeep => {
  const upkeep = MemoryUpkeep.swept({
    id: MemoryUpkeepId.of('upkeep_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    sweptAt: NOW,
    proposals,
  });

  if (upkeep === null) {
    throw new Error('expected an upkeep');
  }
  return upkeep;
};

const memory = (number: number, retired = false): Memory => {
  const written = Memory.write({
    id: MemoryId.of(`memory_${number}`),
    handle: MemoryHandle.of(number),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${number}.`),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: DECISION,
  });

  return retired
    ? written.retire({ by: UserId.of('user_1'), reason: 'Old.', at: NOW })
    : written;
};

const RETIRING = UpkeepProposal.retiring({
  id: P1,
  memory: MemoryId.of('memory_1'),
  finding: 'unused',
  reason: 'Not used in 90 days.',
});

const MERGING = UpkeepProposal.merging({
  id: P2,
  memories: [MemoryId.of('memory_2'), MemoryId.of('memory_3')],
  body: MemoryBody.of('One rule.'),
  reason: 'M-2 and M-3 say the same.',
});

describe('a memory upkeep sweep', () => {
  it('says what it found, so the team hears of it', () => {
    const events = swept([RETIRING, MERGING]).pullEvents();

    expect(events).toEqual([
      new MemoryUpkeepSwept(
        MemoryUpkeepId.of('upkeep_1'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        1,
        1,
      ),
    ]);
  });

  it('is no sweep at all when it found nothing', () => {
    expect(
      MemoryUpkeep.swept({
        id: MemoryUpkeepId.of('upkeep_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        sweptAt: NOW,
        proposals: [],
      }),
    ).toBeNull();
  });

  it('approves a merge with the id of the memory it writes', () => {
    const approved = swept([RETIRING, MERGING]).approve({
      proposalId: P2,
      decision: DECISION,
      newMemoryId: () => MemoryId.of('memory_new'),
      current: [memory(2), memory(3)],
    });

    const [, event] = approved.pullEvents();
    if (!(event instanceof UpkeepProposalApproved)) {
      throw new Error('expected an UpkeepProposalApproved');
    }
    expect(event.merged?.value).toBe('memory_new');
    expect(approved.proposal(P2).state).toBe('approved');
  });

  it('is settled once no change waits for a decision', () => {
    const upkeep = swept([RETIRING, MERGING]);
    upkeep.pullEvents();
    const one = upkeep.reject(P1, DECISION);

    expect(
      one.pullEvents().some((each) => each instanceof MemoryUpkeepSettled),
    ).toBe(false);
    expect(one.reject(P2, DECISION).pullEvents()).toEqual([
      new MemoryUpkeepSettled(upkeep.id, TEAM),
    ]);
  });

  it('decides each proposal once', () => {
    const decided = swept([RETIRING]).reject(P1, DECISION);

    expect(() => decided.reject(P1, DECISION)).toThrow(
      MemoryAlreadyDecidedError,
    );
  });

  it('refuses to approve a change once one of its memories was retired', () => {
    expect(() =>
      swept([MERGING]).approve({
        proposalId: P2,
        decision: DECISION,
        newMemoryId: () => MemoryId.of('memory_new'),
        current: [memory(2), memory(3, true)],
      }),
    ).toThrow(UpkeepProposalLapsedError);
  });

  it('lapses an approved change that could not be made', () => {
    const lapsed = swept([RETIRING])
      .approve({
        proposalId: P1,
        decision: DECISION,
        newMemoryId: () => MemoryId.of('memory_new'),
        current: [memory(1)],
      })
      .lapse(P1);

    expect(lapsed.proposal(P1).state).toBe('lapsed');
    expect(() => swept([RETIRING]).lapse(P1)).toThrow(InconsistentStateError);
  });

  it('never holds a merge of one memory, or a retirement with a body', () => {
    expect(() =>
      UpkeepProposal.rehydrate({
        id: UpkeepProposalId.of('p_9'),
        change: 'merge',
        finding: 'overlap',
        memories: [MemoryId.of('memory_1')],
        body: MemoryBody.of('One rule.'),
        reason: 'Same.',
        state: 'pending',
        decision: null,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      UpkeepProposal.rehydrate({
        id: UpkeepProposalId.of('p_9'),
        change: 'retire',
        finding: 'unused',
        memories: [MemoryId.of('memory_1')],
        body: MemoryBody.of('One rule.'),
        reason: 'Unused.',
        state: 'pending',
        decision: null,
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('the memory upkeep schedule', () => {
  const first = () =>
    MemoryUpkeepSchedule.first({
      teamId: TeamId.of('team_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      now: NOW,
    });

  it('sweeps a week after the team’s first memory, and a week after each sweep', () => {
    const later = new Date(NOW.getTime() + UPKEEP_EVERY_MS);

    expect(first().dueAt).toEqual(later);
    expect(first().isDue(NOW)).toBe(false);
    expect(first().swept(later).dueAt).toEqual(
      new Date(later.getTime() + UPKEEP_EVERY_MS),
    );
  });

  it('sweeps early once 20 memories were added since the last sweep', () => {
    let schedule = first();
    for (let each = 0; each < 19; each += 1) {
      schedule = schedule.memoryAdded(NOW);
    }

    expect(schedule.isDue(NOW)).toBe(false);
    expect(schedule.memoryAdded(NOW).isDue(NOW)).toBe(true);
    expect(schedule.memoryAdded(NOW).swept(NOW).addedSince).toBe(0);
  });

  it('skips to the next week when a sweep kept failing', () => {
    expect(first().deadLetter(NOW).dueAt).toEqual(
      new Date(NOW.getTime() + UPKEEP_EVERY_MS),
    );
  });
});
