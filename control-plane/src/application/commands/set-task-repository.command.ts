export class SetTaskRepositoryCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    /** The repository a run works it in, or null for none. */
    readonly repository: string | null,
    readonly viewerId: string,
  ) {}
}
