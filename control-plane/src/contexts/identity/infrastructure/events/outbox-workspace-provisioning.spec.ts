import { OutboxWorkspaceProvisioning } from '@identity/infrastructure/events/outbox-workspace-provisioning';
import type { EventReactions } from '@platform/events/event-reactions';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const provisioning = (owed: number, givenUp: number) => {
  const owedBy = vi.fn().mockResolvedValue({ owed, givenUp });

  return {
    owedBy,
    read: new OutboxWorkspaceProvisioning({
      owedBy,
    } as unknown as EventReactions).of(WorkspaceId.of('ws_1')),
  };
};

describe('OutboxWorkspaceProvisioning', () => {
  it('reads as done once the first team is open', async () => {
    await expect(provisioning(0, 0).read).resolves.toBe('done');
  });

  it('reads as pending while the first team is owed, retries included', async () => {
    await expect(provisioning(1, 0).read).resolves.toBe('pending');
  });

  it('reads as failed once Spotlight gave up', async () => {
    await expect(provisioning(1, 1).read).resolves.toBe('failed');
  });

  it('asks about the first team of that workspace', async () => {
    const { owedBy, read } = provisioning(0, 0);

    await read;

    expect(owedBy).toHaveBeenCalledWith('identity.first-team', {
      workspaceId: 'ws_1',
    });
  });
});
