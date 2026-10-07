export interface TraceStationDto {
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

export interface TeamTraceDto {
  readonly taskId: string;
  readonly title: string;
  readonly station: TraceStationDto | null;
  readonly stations: readonly TraceStationDto[];
  readonly harness: string;
  readonly state: string;
  readonly startedAt: string;
  readonly runs: number;
  readonly input: string | null;
  readonly output: string | null;
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly cost: number | null;
  readonly currency: string | null;
}

interface TraceVolumeBucketDto {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly faults: number;
}

export interface TeamTracesDto {
  readonly range: string;
  readonly from: string;
  readonly to: string;
  readonly volume: readonly TraceVolumeBucketDto[];
  readonly traces: readonly TeamTraceDto[];
}
