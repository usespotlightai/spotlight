export interface MemoryWriting {
  readonly kind: string;
  readonly body: string;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly paths: readonly string[];
}

export class WriteMemoryCommand {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly writing: MemoryWriting,
  ) {}
}
