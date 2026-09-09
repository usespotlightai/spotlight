import type { StationKind } from '@domain/entities/station.entity';
export interface StationDto {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly harness: string | null;
  readonly agentPrompt: string | null;
  readonly kind: StationKind;
}

export interface ReactionDto {
  readonly happening: string;
  /** Where the task must stand for it to count. Null is wherever it is. */
  readonly from: string | null;
  readonly to: string;
}

export interface AssemblyLineDto {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
  readonly reactions: readonly ReactionDto[];
  /** The repositories a run on this line works in, as owner/name. */
  readonly repositories: readonly string[];
}
