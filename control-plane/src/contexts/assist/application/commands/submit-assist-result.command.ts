export class SubmitAssistResultCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly result: unknown,
  ) {}
}
