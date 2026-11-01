import { AsyncLocalStorage } from 'node:async_hooks';
import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

const scope = new AsyncLocalStorage<readonly HostAllowList[]>();

export const OutboundScope = {
  within<T>(hosts: HostAllowList, work: () => T): T {
    return scope.run([...(scope.getStore() ?? []), hosts], work);
  },

  allows(host: string): boolean {
    return (scope.getStore() ?? []).every((each) => each.allows(host));
  },
};
