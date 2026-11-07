import { OutboundHostsUnreadError } from '@identity/application/errors/outbound-hosts-unread.error';
import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import {
  UNLISTED_FOR_WORKSPACE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceOutboundScope implements WorkspaceOutboundScopePort {
  constructor(private readonly hosts: WorkspaceOutboundHostsPort) {}

  within<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T> {
    return this.scoped(workspaceId, () => this.hosts.of(workspaceId), work);
  }

  withinFresh<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T> {
    return this.scoped(workspaceId, () => this.hosts.fresh(workspaceId), work);
  }

  private async scoped<T>(
    workspaceId: WorkspaceId,
    read: () => Promise<HostAllowList>,
    work: () => Promise<T>,
  ): Promise<T> {
    let hosts: HostAllowList;

    try {
      hosts = await read();
    } catch (error) {
      throw new OutboundHostsUnreadError(
        workspaceId.value,
        error instanceof Error ? error.message : String(error),
      );
    }

    return OutboundScope.within(hosts, UNLISTED_FOR_WORKSPACE, work);
  }
}
