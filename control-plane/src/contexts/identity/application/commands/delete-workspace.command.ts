export class DeleteWorkspaceCommand {
  constructor(
    readonly workspaceId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
