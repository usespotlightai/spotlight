import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import { WorkspaceOutboundScope } from '@identity/infrastructure/outbound/workspace-outbound-scope';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { OutboundHostsUnreadError } from '@shared-kernel/application/errors/outbound-hosts-unread.error';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { describe, expect, it, vi } from 'vitest';

const hosts = (over: Partial<WorkspaceOutboundHostsPort> = {}) => ({
  of: vi.fn(async () => HostAllowList.of(['cached.example.com'])),
  fresh: vi.fn(async () => HostAllowList.of(['fresh.example.com'])),
  forget: vi.fn(),
  ...over,
});

const allowedWithin = (
  run: (work: () => Promise<boolean[]>) => Promise<boolean[]>,
) =>
  run(async () => [
    OutboundScope.allows('cached.example.com'),
    OutboundScope.allows('fresh.example.com'),
  ]);

describe('WorkspaceOutboundScope', () => {
  it('runs work within the cached list, or the fresh one when asked', async () => {
    const scope = new WorkspaceOutboundScope(hosts());

    await expect(
      allowedWithin((work) => scope.within('ws_1', work)),
    ).resolves.toEqual([true, false]);
    await expect(
      allowedWithin((work) => scope.withinFresh('ws_1', work)),
    ).resolves.toEqual([false, true]);
  });

  it('runs nothing when it cannot read the list, and says so with its own error', async () => {
    const work = vi.fn(async () => 'sent');
    const scope = new WorkspaceOutboundScope(
      hosts({
        of: async () => {
          throw new Error('workspace ws_gone does not exist');
        },
      }),
    );

    await expect(scope.within('ws_gone', work)).rejects.toThrow(
      OutboundHostsUnreadError,
    );
    expect(work).not.toHaveBeenCalled();
  });
});
