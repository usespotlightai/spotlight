import { AsyncLocalStorage } from 'node:async_hooks';

import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

type Scope = { readonly hosts: HostAllowList; readonly refusal: string };

const scope = new AsyncLocalStorage<readonly Scope[]>();

export const OutboundScope = {
  within<T>(hosts: HostAllowList, refusal: string, work: () => T): T {
    return scope.run([...(scope.getStore() ?? []), { hosts, refusal }], work);
  },

  // Runs the work under the deployment's allow-list only, also where it starts in the scope of a workspace. Only for calls to a URL that the deployment sets.
  deployment<T>(work: () => T): T {
    return scope.run([], work);
  },

  allows(host: string): boolean {
    return OutboundScope.refusalFor(host) === null;
  },

  refusalFor(host: string): string | null {
    return (
      (scope.getStore() ?? []).find((each) => !each.hosts.allows(host))
        ?.refusal ?? null
    );
  },
};
