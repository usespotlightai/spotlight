import type {
  DependentSource,
  DependentsPort,
} from '@identity/application/ports/dependents.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_DEPENDENTS = Symbol('WORKSPACE_DEPENDENTS');

export type WorkspaceDependentSource = DependentSource<WorkspaceId>;

export type WorkspaceDependentsPort = DependentsPort<WorkspaceId>;
