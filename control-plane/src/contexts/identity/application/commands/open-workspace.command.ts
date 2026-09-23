export class OpenWorkspaceCommand {
  constructor(
    readonly name: string,
    readonly slug: string,
    readonly teamName: string,
    readonly ownerId: string,
  ) {}
}
