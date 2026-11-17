export class FailPushDiffCommand {
  constructor(
    readonly diffId: string,
    readonly runnerId: string,
    readonly reason: string,
  ) {}
}
