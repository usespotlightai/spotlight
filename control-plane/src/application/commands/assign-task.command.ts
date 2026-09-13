export class AssignTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly assigneeId: string | null,
    readonly viewerId: string,
  ) {}
}
