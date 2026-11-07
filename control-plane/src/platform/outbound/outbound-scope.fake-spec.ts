import { OutboundScope } from '@platform/outbound/outbound-scope';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

interface ScopedTo {
  within<T>(workspaceId: string, work: () => Promise<T>): Promise<T>;
  withinFresh<T>(workspaceId: string, work: () => Promise<T>): Promise<T>;
}

export const scopedTo = (...hosts: string[]): ScopedTo => ({
  within: (_workspaceId, work) =>
    OutboundScope.within(HostAllowList.of(hosts), work),
  withinFresh: (_workspaceId, work) =>
    OutboundScope.within(HostAllowList.of(hosts), work),
});

export const unscoped: ScopedTo = scopedTo();
