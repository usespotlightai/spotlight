export class SetWorkspacePlanCommand {
  constructor(
    readonly workspaceId: string,
    readonly plan: string,
    readonly expiresAt: Date | null,
  ) {}
}

export class RemoveWorkspacePlanCommand {
  constructor(readonly workspaceId: string) {}
}
