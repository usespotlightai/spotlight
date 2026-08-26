import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface StationSummary {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly description: string | null;
  readonly pool: string | null;
  readonly agentPrompt: string | null;
}

export interface AssemblyLineDetail {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationSummary[];
}

export const ASSEMBLY_LINE_READER = Symbol('ASSEMBLY_LINE_READER');

export interface AssemblyLineReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<AssemblyLineDetail[] | null>;
}
