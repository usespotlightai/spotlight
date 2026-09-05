export class AssignTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    /** The team member to give it to, or null to leave it unclaimed. */
    readonly assigneeId: string | null,
    readonly viewerId: string,
  ) {}
}
