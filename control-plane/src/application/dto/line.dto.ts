import type { StationKind } from '@domain/entities/station.entity';
export interface StationDto {
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

export interface ReactionDto {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export interface LineDto {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
  readonly reactions: readonly ReactionDto[];
  readonly repositories: readonly string[];
}
