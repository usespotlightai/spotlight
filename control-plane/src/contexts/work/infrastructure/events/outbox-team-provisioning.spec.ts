import type { EventReactions } from '@platform/events/event-reactions';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { OutboxTeamProvisioning } from '@work/infrastructure/events/outbox-team-provisioning';
import { describe, expect, it, vi } from 'vitest';

const provisioning = (owed: number, givenUp: number) => {
  const owedBy = vi.fn().mockResolvedValue({ owed, givenUp });

  return {
    owedBy,
    read: new OutboxTeamProvisioning({
      owedBy,
    } as unknown as EventReactions).of(TeamId.of('team_1')),
  };
};

describe('OutboxTeamProvisioning', () => {
  it('reads as done once nothing is owed', async () => {
    await expect(provisioning(0, 0).read).resolves.toBe('done');
  });

  it('reads as pending while the setup is owed, retries included', async () => {
    await expect(provisioning(1, 0).read).resolves.toBe('pending');
  });

  it('reads as failed once Spotlight gave up', async () => {
    await expect(provisioning(1, 1).read).resolves.toBe('failed');
  });

  it('asks only about a team a person signed up with', async () => {
    const { owedBy, read } = provisioning(0, 0);

    await read;

    expect(owedBy).toHaveBeenCalledWith('work.provision-team', {
      teamId: 'team_1',
      origin: 'sign-up',
    });
  });
});
