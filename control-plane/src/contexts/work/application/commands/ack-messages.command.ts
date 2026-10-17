export class AckMessagesCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly upTo: number,
  ) {}
}
