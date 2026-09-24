import type {
  Holder,
  HoldingsPort,
} from '@identity/application/ports/holdings.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_HOLDINGS = Symbol('TEAM_HOLDINGS');

export type TeamHolder = Holder<TeamId>;

export type TeamHoldingsPort = HoldingsPort<TeamId>;
