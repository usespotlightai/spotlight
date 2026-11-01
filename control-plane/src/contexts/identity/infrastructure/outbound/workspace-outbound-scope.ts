import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { OutboundHostsUnreadError } from '@shared-kernel/application/errors/outbound-hosts-unread.error';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export class WorkspaceOutboundScope implements WorkspaceOutboundScopePort {
  constructor(private readonly hosts: WorkspaceOutboundHostsPort) {}

  within<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
    return this.scoped(workspaceId, () => this.hosts.of(workspaceId), work);
  }

  withinFresh<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
    return this.scoped(workspaceId, () => this.hosts.fresh(workspaceId), work);
  }

  private async scoped<T>(
    workspaceId: string,
    read: () => Promise<HostAllowList>,
    work: () => Promise<T>,
  ): Promise<T> {
    let hosts: HostAllowList;

    try {
      hosts = await read();
    } catch (error) {
      throw new OutboundHostsUnreadError(
        workspaceId,
        error instanceof Error ? error.message : String(error),
      );
    }

    return OutboundScope.within(hosts, work);
  }
}
