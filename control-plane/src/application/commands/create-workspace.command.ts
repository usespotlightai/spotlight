export class CreateWorkspaceCommand {
  constructor(
    readonly name: string,
    readonly slug: string,
    readonly ownerId: string,
  ) {}
}
