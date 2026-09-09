import type { StationKind } from '@domain/entities/station.entity';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface StationSummary {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly harness: string | null;
  readonly agentPrompt: string | null;
  readonly kind: StationKind;
}

export interface ReactionSummary {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface AssemblyLineDetail {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationSummary[];
  readonly reactions: readonly ReactionSummary[];
  /** The repositories a run on this line works in, as owner/name. */
  readonly repositories: readonly string[];
}

export const ASSEMBLY_LINE_READER = Symbol('ASSEMBLY_LINE_READER');

export interface AssemblyLineReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<AssemblyLineDetail[] | null>;
}
