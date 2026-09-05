export class ConnectGitHubCommand {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    /** As GitHub named it when it sent the person back from installing. */
    readonly installationId: string,
  ) {}
}
