export class SetLineRepositoriesCommand {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly lineId: string,
    readonly repositories: readonly string[],
  ) {}
}
