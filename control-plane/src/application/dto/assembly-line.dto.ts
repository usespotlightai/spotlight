export interface StationDto {
  readonly id: string;
  readonly name: string;
  readonly position: number;
}

export interface AssemblyLineDto {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationDto[];
}
