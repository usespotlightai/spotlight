import { MemberConnections } from '@integrations/application/services/member-connections.service';
import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const ADA = UserId.of('user_ada');

const disconnecting = (owned: readonly IntegrationConnection[]) => {
  const ofPerson = vi.fn(async () => owned);
  const remove = vi.fn(async () => {});
  const warn = vi.fn();
  const connections = new MemberConnections(
    partial<IntegrationConnectionRepository>({ ofPerson, remove }),
    partial<LoggerPort>({ warn }),
  );

  return { connections, ofPerson, remove, warn };
};

describe('MemberConnections', () => {
  it('removes every connection of the person in the workspace', async () => {
    const first = partial<IntegrationConnection>({});
    const second = partial<IntegrationConnection>({});
    const { connections, ofPerson, remove } = disconnecting([first, second]);

    await connections.disconnect(WORKSPACE, ADA);

    expect(ofPerson).toHaveBeenCalledWith(WORKSPACE, ADA);
    expect(remove.mock.calls).toEqual([[first], [second]]);
  });

  it('removes nothing where the person has none', async () => {
    const { connections, remove } = disconnecting([]);

    await connections.disconnect(WORKSPACE, ADA);

    expect(remove).not.toHaveBeenCalled();
  });

  it('warns and fails where a connection cannot be removed, so the delivery tries again', async () => {
    const { connections, remove, warn } = disconnecting([
      partial<IntegrationConnection>({}),
    ]);

    remove.mockRejectedValueOnce(new Error('conflict'));

    await expect(connections.disconnect(WORKSPACE, ADA)).rejects.toThrow(
      'conflict',
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
