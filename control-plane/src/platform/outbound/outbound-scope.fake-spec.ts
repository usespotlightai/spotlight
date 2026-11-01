import { OutboundScope } from '@platform/outbound/outbound-scope';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export const scopedTo = (...hosts: string[]): WorkspaceOutboundScopePort => ({
  within: (_workspaceId, work) =>
    OutboundScope.within(HostAllowList.of(hosts), work),
  withinFresh: (_workspaceId, work) =>
    OutboundScope.within(HostAllowList.of(hosts), work),
});

export const unscoped: WorkspaceOutboundScopePort = scopedTo();
