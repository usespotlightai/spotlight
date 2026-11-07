import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import {
  recallableBy,
  recordsRecall,
} from '@memory/domain/services/recall-policy';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const APPROVED = new Date('2026-09-27T10:00:00.000Z');
const RETIRED = new Date('2026-09-27T12:00:00.000Z');

const retired = Memory.write({
  id: MemoryId.of('memory_1'),
  handle: MemoryHandle.of(1),
  workspaceId: WorkspaceId.of('ws_1'),
  kind: 'preference',
  body: MemoryBody.of('Squash before merging.'),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: UserId.of('user_1'), at: APPROVED }),
}).retire({ by: UserId.of('user_1'), reason: 'Stale.', at: RETIRED });

describe('recall policy', () => {
  it('lets a run recall any memory of its team by handle, a retired one too', () => {
    expect(recallableBy(retired, { teamId: TEAM, replaysFrom: null })).toBe(
      true,
    );
    expect(
      recallableBy(retired, {
        teamId: TeamId.of('team_2'),
        replaysFrom: null,
      }),
    ).toBe(false);
  });

  it('lets a replay recall only what was active when the run it replays started', () => {
    expect(
      recallableBy(retired, {
        teamId: TEAM,
        replaysFrom: new Date('2026-09-27T11:00:00.000Z'),
      }),
    ).toBe(true);
    expect(recallableBy(retired, { teamId: TEAM, replaysFrom: RETIRED })).toBe(
      false,
    );
  });

  it('records what a run recalls, but not what a replay recalls', () => {
    expect(recordsRecall({ teamId: TEAM, replaysFrom: null })).toBe(true);
    expect(recordsRecall({ teamId: TEAM, replaysFrom: APPROVED })).toBe(false);
  });
});
