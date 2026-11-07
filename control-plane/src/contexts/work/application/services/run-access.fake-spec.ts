import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunAccess } from '@work/application/services/run-access.service';

export const WORKSPACE = WorkspaceId.of('ws_1');

export const runAccessWhere = (sees: boolean): RunAccess =>
  new RunAccess(
    { find: async () => null } as never,
    {
      seesWorkspace: async () => sees,
      seesWorkspaceOfTeam: async () => false,
      opensChat: async () => false,
    } as never,
  );

export const inWorkspace = <T>(found: T) => ({ workspaceId: WORKSPACE, found });
