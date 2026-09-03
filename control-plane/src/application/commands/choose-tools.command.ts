export class ChooseToolsCommand {
  constructor(
    readonly teamId: string,
    /** The hosts this team wants to listen to, by the name each is known by. */
    readonly sources: readonly string[],
    readonly viewerId: string,
  ) {}
}
