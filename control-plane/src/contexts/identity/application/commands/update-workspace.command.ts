export class UpdateWorkspaceCommand {
  constructor(
    readonly workspaceId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
