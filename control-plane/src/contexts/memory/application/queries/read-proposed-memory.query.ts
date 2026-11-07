export class ReadProposedMemoryQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly memoryId: string,
  ) {}
}
