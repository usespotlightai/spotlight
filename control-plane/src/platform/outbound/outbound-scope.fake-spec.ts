import { OutboundScope } from '@platform/outbound/outbound-scope';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

interface ScopedTo {
  within<T>(owner: unknown, work: () => Promise<T>): Promise<T>;
  withinFresh<T>(owner: unknown, work: () => Promise<T>): Promise<T>;
}

export const scopedTo = (...hosts: string[]): ScopedTo => ({
  within: (_owner, work) => OutboundScope.within(HostAllowList.of(hosts), work),
  withinFresh: (_owner, work) =>
    OutboundScope.within(HostAllowList.of(hosts), work),
});

export const unscoped: ScopedTo = scopedTo();
