export class ForgetCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly handle: string,
    readonly because: string,
  ) {}
}
