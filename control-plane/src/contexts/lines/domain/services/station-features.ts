import type { StationKind } from '@lines/domain/entities/station.entity';

/**
 * Whether a station has its agent features (change stacks, decisions and memories) when its line leaves them out.
 * A station that runs an agent has every one of them, unless the line turns it off; a backlog or the completed
 * station runs no agent and has none.
 */
export const agentFeaturesByDefault = (kind: StationKind): boolean =>
  kind === 'work';
