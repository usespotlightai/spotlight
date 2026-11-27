import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { UpkeepReactions } from '@memory/application/events/handlers/upkeep-reactions.handler';
import type { DeleteMemoryProposalSet } from '@memory/application/services/delete-memory-proposal-set.service';
import type { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import type { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import type { WakeUpkeepSweeps } from '@memory/application/services/wake-upkeep-sweeps.service';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import {
  ASSIST_SESSION_SETTLED,
  type AssistSessionSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/assist-session-settled.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it, vi } from 'vitest';

describe('memory receiving a settled assist session', () => {
  it('wakes the sweep that waits for the session', async () => {
    const settled = vi.fn(async () => {});
    const subscriber = memorySubscribers(
      partial<DeleteMemoryProposalSet>({}),
      partial<DeleteTeamMemories>({}),
      partial<MemoryReactions>({}),
      partial<RecordRunMemoryUses>({}),
      partial<UpkeepReactions>({}),
      partial<WakeUpkeepSweeps>({ settled }),
    ).find((each) => each.kinds.includes(ASSIST_SESSION_SETTLED));
    const event: AssistSessionSettledIntegrationEvent = {
      kind: ASSIST_SESSION_SETTLED,
      workspaceId: 'ws_1',
      purpose: 'memory.consolidate',
      key: 'team_1:1795348367000:1',
      outcome: 'submitted',
    };

    await subscriber?.handle(event, anOutboxRecord());

    expect(subscriber?.name).toBe('memory.wake-on-assist-session-settled');
    expect(settled).toHaveBeenCalledWith({
      purpose: 'memory.consolidate',
      key: 'team_1:1795348367000:1',
    });
  });
});
