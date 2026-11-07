import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunAccess } from '@work/application/services/run-access.service';

export const WORKSPACE = WorkspaceId.of('ws_1');

export const runAccessWhere = (sees: boolean): RunAccess =>
  new RunAccess(
    { of: async () => [] },
    { find: async () => null } as never,
    { mayView: async () => sees } as never,
    { find: async () => null, inWorkspace: async () => [] },
  );

export const inWorkspace = <T>(found: T) => ({ workspaceId: WORKSPACE, found });
