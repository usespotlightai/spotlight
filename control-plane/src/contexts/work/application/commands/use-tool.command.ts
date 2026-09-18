export class UseToolCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly tool: string,
    readonly input: unknown,
  ) {}
}
