import type {
  DependentSource,
  DependentsPort,
} from '@identity/application/ports/dependents.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_DEPENDENTS = Symbol('TEAM_DEPENDENTS');

export type TeamDependentSource = DependentSource<TeamId>;

export type TeamDependentsPort = DependentsPort<TeamId>;
