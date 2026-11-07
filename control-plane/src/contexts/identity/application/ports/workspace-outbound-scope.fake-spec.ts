import {
  UNLISTED_FOR_WORKSPACE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

interface ScopedTo {
  within<T>(owner: unknown, work: () => Promise<T>): Promise<T>;
  withinFresh<T>(owner: unknown, work: () => Promise<T>): Promise<T>;
}

export const scopedTo = (...hosts: string[]): ScopedTo => ({
  within: (_owner, work) =>
    OutboundScope.within(HostAllowList.of(hosts), UNLISTED_FOR_WORKSPACE, work),
  withinFresh: (_owner, work) =>
    OutboundScope.within(HostAllowList.of(hosts), UNLISTED_FOR_WORKSPACE, work),
});

export const unscoped: ScopedTo = scopedTo();

export const scopeRecorder = () => {
  let current: string | null = null;
  const entered: string[] = [];
  const run = async <T>(
    workspaceId: string,
    reading: string,
    work: () => Promise<T>,
  ): Promise<T> => {
    const was = current;
    current = workspaceId;
    entered.push(reading);

    try {
      return await work();
    } finally {
      current = was;
    }
  };
  const scope: WorkspaceOutboundScopePort = {
    within: (workspaceId, work) => run(workspaceId.value, 'cached', work),
    withinFresh: (workspaceId, work) => run(workspaceId.value, 'fresh', work),
  };

  return { scope, current: () => current, entered: () => entered };
};
