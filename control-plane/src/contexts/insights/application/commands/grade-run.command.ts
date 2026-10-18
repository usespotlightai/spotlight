export class GradeRunCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly value: boolean | number | null,
    readonly claims: readonly boolean[] | null,
    readonly viewerId: string,
  ) {}
}
