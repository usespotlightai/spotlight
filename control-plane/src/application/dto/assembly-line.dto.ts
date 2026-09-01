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

export interface AssemblyLineDto {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
}
