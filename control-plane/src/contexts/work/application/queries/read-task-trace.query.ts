export class ReadTaskTraceQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
