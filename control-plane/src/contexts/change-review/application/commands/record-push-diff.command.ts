export class RecordPushDiffCommand {
  constructor(
    readonly diffId: string,
    readonly runnerId: string,
    readonly diff: string,
    readonly base: string,
  ) {}
}
