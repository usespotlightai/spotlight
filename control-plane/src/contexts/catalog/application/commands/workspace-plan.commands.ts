export class SetWorkspacePlanCommand {
  constructor(
    readonly workspaceId: string,
    readonly plan: string,
    readonly expiresAt: Date | null,
  ) {}
}

export class DeleteWorkspacePlanCommand {
  constructor(readonly workspaceId: string) {}
}
