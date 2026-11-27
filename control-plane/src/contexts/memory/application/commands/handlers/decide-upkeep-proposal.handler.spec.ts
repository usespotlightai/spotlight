import { DecideUpkeepProposalCommand } from '@memory/application/commands/decide-upkeep-proposal.command';
import { DecideUpkeepProposalHandler } from '@memory/application/commands/handlers/decide-upkeep-proposal.handler';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import type { MemoryUpkeepRepository } from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { TeamAccess } from '@memory/domain/services/team-access';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_1');

const memory = (handle: number, retired = false): Memory => {
  const written = Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${handle}.`),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

  return retired
    ? written.retire({ by: ADA, reason: 'Out of date.', at: NOW })
    : written;
};

const deciding = (memories: Memory[]) => {
  const saved: MemoryUpkeep[] = [];
  const upkeep = MemoryUpkeep.swept({
    id: MemoryUpkeepId.of('upkeep_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    sweptAt: NOW,
    proposals: [
      UpkeepProposal.retiring({
        id: UpkeepProposalId.of('p_1'),
        memory: MemoryId.of('memory_1'),
        finding: 'unused',
        reason: 'Not used in 90 days.',
      }),
    ],
  });
  const handler = new DecideUpkeepProposalHandler(
    partial<MemoryAccess>({
      forTeam: () =>
        Promise.resolve(
          TeamAccess.onTeam(TEAM, {
            workspaceId: WorkspaceId.of('ws_1'),
            by: ADA,
          }),
        ),
    }),
    partial<MemoryUpkeepRepository>({
      find: () => Promise.resolve(upkeep),
      save: (each: MemoryUpkeep) => {
        saved.push(each);
        return Promise.resolve();
      },
    }),
    partial<MemoryRepository>({ findAll: () => Promise.resolve(memories) }),
    { generate: () => 'memory_new' },
    { inTransaction: (work) => work() },
    { now: () => NOW, sleep: () => Promise.resolve(undefined) },
  );

  return { handler, saved };
};

const command = (decision: 'approve' | 'reject') =>
  new DecideUpkeepProposalCommand(
    'team_1',
    'upkeep_1',
    'p_1',
    decision,
    'user_1',
  );

describe('DecideUpkeepProposalHandler', () => {
  it('approves a change whose memories are still active', async () => {
    const { handler, saved } = deciding([memory(1)]);

    await handler.execute(command('approve'));

    expect(saved[0]?.proposal(UpkeepProposalId.of('p_1')).state).toBe(
      'approved',
    );
  });

  it('refuses to approve a change whose memory was retired after the sweep', async () => {
    const { handler, saved } = deciding([memory(1, true)]);

    await expect(handler.execute(command('approve'))).rejects.toThrow(
      'M-1 was retired after the sweep',
    );
    expect(saved).toEqual([]);
  });

  it('still keeps a change whose memory was retired', async () => {
    const { handler, saved } = deciding([memory(1, true)]);

    await handler.execute(command('reject'));

    expect(saved[0]?.proposal(UpkeepProposalId.of('p_1')).state).toBe(
      'rejected',
    );
  });
});
