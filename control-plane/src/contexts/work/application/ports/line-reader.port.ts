import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StationKind } from '@work/domain/entities/station.entity';

export interface StationSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly agentPrompt: string | null;
  readonly kind: StationKind;
  readonly skills: readonly string[];
}

export interface ReactionSummary {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface LineDetail {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly stations: readonly StationSummary[];
  readonly reactions: readonly ReactionSummary[];
  readonly repositories: readonly string[];
}

export const LINE_READER = Symbol('LINE_READER');

export interface LineReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<LineDetail[] | null>;
}
