import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export interface FactoryRepository {
  add(factory: Factory): Promise<void>;

  ofTeam(teamId: TeamId): Promise<Factory | null>;
}
