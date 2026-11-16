export class GradeRunCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly claims: readonly boolean[],
    readonly viewerId: string,
  ) {}
}
