export interface StationDto {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly color: string;
  readonly description: string | null;
  readonly harness: string | null;
  readonly agentPrompt: string | null;
  readonly kind: 'backlog' | 'work';
}

export interface AssemblyLineDto {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
}
