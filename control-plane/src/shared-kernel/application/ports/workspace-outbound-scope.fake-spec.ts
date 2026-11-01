import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';

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
    within: (workspaceId, work) => run(workspaceId, 'cached', work),
    withinFresh: (workspaceId, work) => run(workspaceId, 'fresh', work),
  };

  return { scope, current: () => current, entered: () => entered };
};
